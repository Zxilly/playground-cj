import { initialize } from '@codingame/monaco-vscode-api'
import type { IWorkbenchConstructionOptions } from '@codingame/monaco-vscode-api'
import {
  ExtensionHostKind,
  getBuiltinExtensions,
  registerExtension,
} from '@codingame/monaco-vscode-api/extensions'
import type { IExtensionManifest, RegisterExtensionResult } from '@codingame/monaco-vscode-api/extensions'
import { DisposableStore, setUnexpectedErrorHandler } from '@codingame/monaco-vscode-api/monaco'
import getConfigurationServiceOverride, { initUserConfiguration } from '@codingame/monaco-vscode-configuration-service-override'
import getLogServiceOverride from '@codingame/monaco-vscode-log-service-override'
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import type { OpenEditor } from '@codingame/monaco-vscode-editor-service-override'
import * as vscode from 'vscode'
import 'vscode/localExtensionHost'
import { encodeStringOrUrlToDataUrl } from './data-url'
import { getEnhancedMonacoEnvironment, mergeServices } from './environment'
import type { ExtensionConfig, MonacoVscodeApiConfig } from './types'

// We never open editors via the editor service (the app drives editors
// directly), so the open-editor hook is a no-op.
const openEditorStub: OpenEditor = async () => undefined

function buildDefaultWorkspaceConfig(): IWorkbenchConstructionOptions {
  return {
    workspaceProvider: {
      trusted: true,
      workspace: { workspaceUri: vscode.Uri.file('/workspace.code-workspace') },
      async open() {
        window.open(window.location.href)
        return true
      },
    },
  }
}

/**
 * Boots the global monaco-vscode-api services for this project's needs:
 * `extended` highlighting (textmate/theme/languages), one of EditorService or
 * ViewsService, the user-configuration blob, and a single (Cangjie) extension.
 *
 * The vscode services are a process-wide singleton — `start()` is idempotent
 * and only the first caller on a page performs the boot. Later editors await
 * the in-flight boot (or find it done) and just (re-)register their extension
 * via `initExtensions()`.
 */
export class MonacoVscodeApiWrapper {
  private readonly config: MonacoVscodeApiConfig
  private readonly serviceOverrides: monaco.editor.IEditorOverrideServices
  private readonly extensionRegisterResults = new Map<string, RegisterExtensionResult>()
  private disposableStore = new DisposableStore()

  constructor(config: MonacoVscodeApiConfig) {
    this.config = config
    this.serviceOverrides = { ...(config.serviceOverrides ?? {}) }
  }

  async start(): Promise<void> {
    const env = getEnhancedMonacoEnvironment()
    // Install the worker factory on every mount: the global env persists across
    // HMR, but a remount must re-seed getWorker before monaco spawns workers.
    this.config.monacoWorkerFactory?.()

    // The vscode services are a process-wide singleton. Coordinate concurrent
    // editors: wait for an in-flight boot; if it failed, fall through and retry
    // ourselves instead of hanging forever on a dead promise.
    while (true) {
      if (env.vscodeApiInitialised) {
        return
      }
      if (env.vscodeApiInitialising) {
        await env.vscodeApiGlobalInitAwait
        continue
      }

      env.vscodeApiInitialising = true
      this.markGlobalInit()
      try {
        // extended highlighting services
        const [getLanguages, getTextmate, getTheme] = await Promise.all([
          import('@codingame/monaco-vscode-languages-service-override').then(m => m.default),
          import('@codingame/monaco-vscode-textmate-service-override').then(m => m.default),
          import('@codingame/monaco-vscode-theme-service-override').then(m => m.default),
        ])
        mergeServices(this.serviceOverrides, { ...getLanguages(), ...getTextmate(), ...getTheme() })

        // views: EditorService (default) or ViewsService
        await this.configureViewsServices()

        // apply the editor-settings JSON before initialize()
        if (this.config.userConfiguration?.json) {
          await initUserConfiguration(this.config.userConfiguration.json)
        }

        // required services + extension host, then initialize the workbench
        await this.initAllServices()

        // attach workbench parts to the injected DOM (ViewsService mode)
        await this.applyViewsPostConfig()

        // register the project extension(s) after services are up
        await this.initExtensions()

        this.markGlobalInitDone()
        return
      }
      catch (e) {
        // A failed boot must not leave the global-init promise pending forever —
        // EditorWrapper parks every editor on env.vscodeApiGlobalInitAwait. Settle
        // it and reset the flags so parked/later editors retry the boot instead of
        // hanging on the loading shell permanently.
        env.vscodeApiInitialising = false
        env.vscodeApiGlobalInitResolve?.()
        env.vscodeApiGlobalInitAwait = undefined
        env.vscodeApiGlobalInitResolve = undefined
        throw e
      }
    }
  }

  private async configureViewsServices(): Promise<void> {
    if (this.config.viewsConfig.$type === 'ViewsService') {
      if (!this.config.viewsConfig.htmlContainer) {
        throw new Error('ViewsService requires an htmlContainer')
      }
      const getViewsServiceOverride = (await import('@codingame/monaco-vscode-views-service-override')).default
      mergeServices(this.serviceOverrides, getViewsServiceOverride(openEditorStub))
    }
    else {
      const getEditorServiceOverride = (await import('@codingame/monaco-vscode-editor-service-override')).default
      mergeServices(this.serviceOverrides, getEditorServiceOverride(openEditorStub))
    }
  }

  private async applyViewsPostConfig(): Promise<void> {
    // ViewsService mode injects the workbench DOM skeleton (defaultViewsHtml);
    // viewsInitFunc (initializeMonacoViewsService) attaches the workbench parts
    // (sidebar/panel/editor/statusbar) to it. Without this the workbench is empty.
    if (this.config.viewsConfig.$type === 'ViewsService') {
      await this.config.viewsConfig.viewsInitFunc?.()
    }
  }

  private async initAllServices(): Promise<void> {
    // monaco-vscode-api auto-loads layout/environment/extension/files/quickAccess;
    // we always add configuration/log/model + the extension host.
    const services: monaco.editor.IEditorOverrideServices = {
      ...getConfigurationServiceOverride(),
      ...getLogServiceOverride(),
      ...getModelServiceOverride(),
    }
    mergeServices(services, this.serviceOverrides)

    const getExtensionServiceOverride = (await import('@codingame/monaco-vscode-extensions-service-override')).default
    mergeServices(services, getExtensionServiceOverride())

    this.checkServiceConsistency(services)

    const workspaceConfig = buildDefaultWorkspaceConfig()
    if (this.config.viewsConfig.$type === 'ViewsService') {
      await initialize(services, this.config.viewsConfig.htmlContainer, workspaceConfig)
    }
    else {
      await initialize(services, undefined, workspaceConfig)
    }

    setUnexpectedErrorHandler((e) => {
      // monaco-vscode-api surfaces internal, non-fatal errors through this hook
      // (background tokenization races, platform probes). monaco-languageclient
      // keeps these off the console by default (logLevel Off); mirror that and
      // surface them only at debug level so they don't drown real errors.
      console.debug('[vscode-api] non-fatal internal error', e)
    })
  }

  // The original monaco-languageclient enforced these before initialize(); a
  // missing dependency otherwise fails deep inside initialize() with an opaque
  // error instead of a clear precondition message.
  private checkServiceConsistency(services: monaco.editor.IEditorOverrideServices): void {
    const has = (key: string): boolean => Object.hasOwn(services, key)
    if (has('themeService') && !has('textMateTokenizationFeature')) {
      throw new Error('vscode-api: "theme" service requires the "textmate" service')
    }
    if (has('markersService') && !has('viewsService')) {
      throw new Error('vscode-api: "markers" service requires the "views" service')
    }
  }

  async initExtensions(): Promise<void> {
    // default theme extension (extended mode)
    await import('@codingame/monaco-vscode-theme-defaults-default-extension')

    const extensions = this.config.extensions ?? []
    if (extensions.length === 0) {
      return
    }

    const builtinIds = new Set(getBuiltinExtensions().map(ext => ext.identifier.id))
    await Promise.all(
      extensions
        .filter(ext => !builtinIds.has(`${ext.config.publisher}.${ext.config.name}`))
        .map(ext => this.initExtension(ext)),
    )
  }

  private initExtension(extensionConfig: ExtensionConfig): Promise<void> {
    const manifest = extensionConfig.config as IExtensionManifest
    const result = registerExtension(manifest, ExtensionHostKind.LocalProcess)
    this.extensionRegisterResults.set(manifest.name, result)
    if (extensionConfig.filesOrContents && Object.hasOwn(result, 'registerFileUrl')) {
      for (const [path, content] of extensionConfig.filesOrContents) {
        this.disposableStore.add(result.registerFileUrl(path, encodeStringOrUrlToDataUrl(content)))
      }
    }
    return result.whenReady()
  }

  private markGlobalInit(): void {
    const env = getEnhancedMonacoEnvironment()
    env.vscodeApiGlobalInitAwait = new Promise<void>((resolve) => {
      env.vscodeApiGlobalInitResolve = resolve
    })
  }

  private markGlobalInitDone(): void {
    const env = getEnhancedMonacoEnvironment()
    env.vscodeApiGlobalInitResolve?.()
    env.vscodeApiInitialised = true
    env.vscodeApiGlobalInitAwait = undefined
    env.vscodeApiGlobalInitResolve = undefined
  }

  dispose(): void {
    this.extensionRegisterResults.forEach(r => r.dispose())
    this.extensionRegisterResults.clear()
    this.disposableStore.dispose()
    this.disposableStore = new DisposableStore()
  }
}
