import type { CSSProperties, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { getEnhancedMonacoEnvironment, MonacoVscodeApiWrapper } from '@/lib/monaco/vscode-api'
import type { CodeResources, MonacoLanguageClient } from '@/lib/monaco/vscode-api'
import {
  acquireLanguageService,
  createEditorAppConfig,
  createMonacoVscodeApiConfig,
  ensureLanguageClient,
  isLanguageClientAvailable,
} from '@/lib/monaco'
import type { EditorPresentationOptions } from '@/lib/monaco'
import { ensureMonacoFontRemeasure } from '@/lib/monaco/font-remeasure'
import { ensureMonacoThemeSync } from '@/lib/monaco/theme-sync'
import { acquireModel } from '@/lib/monaco/model-lifecycle'
import { createModelFileMirror } from '@/lib/monaco/model-file-mirror'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { getCurrentEditorPort, subscribeLspStatus } from '@/lib/lsp'
import { registerLspCommands } from '@/lib/lsp-commands'
import { LspStatusIndicator } from '@/modules/cangjie-editor/components/LspStatusIndicator'
import { Button } from '@/components/ui/button'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { markEditorStartup } from '@/lib/monaco/startup-timing'

markEditorStartup('module-evaluated')

export interface MonacoEditorHandle {
  getEditor: () => monaco.editor.IStandaloneCodeEditor | undefined
  dispose: () => Promise<void> | void
  updateCodeResources?: (codeResources?: CodeResources) => Promise<boolean> | boolean
  relayout?: () => void
}

export interface MonacoEditorProps {
  style?: CSSProperties
  code?: string
  onLoad?: (editorApp: MonacoEditorHandle) => void
  onError?: (error: Error) => void
  locale?: string
  enableLanguageClient?: boolean
  /** Compact/embedded preset (wordWrap on, no scrollBeyondLastLine, wheel passthrough). */
  compact?: boolean
  wordWrap?: monaco.editor.IStandaloneEditorConstructionOptions['wordWrap']
  scrollBeyondLastLine?: boolean
  alwaysConsumeMouseWheel?: boolean
  // Mount-time presentation options; language services remain enabled separately.
  statusBarCompactHeight?: number
  // Resolved lazily when mounting the status bar; an external host owns its own layout space.
  statusBarHostRef?: RefObject<HTMLElement | null>
  // Disambiguator that becomes part of the model URI so multiple editors on
  // the same page hold independent models. Reuse across React mounts requires
  // retainModelOnUnmount plus a parent modelScope.
  uriHint?: string
  // Models retained across editor-only unmounts belong to a parent lifecycle
  // scope (for example one lesson) which disposes them on route/view exit.
  modelScope?: string
  retainModelOnUnmount?: boolean
}

function measureContentBox(element: HTMLElement): { width: number, height: number } {
  const { width: outerWidth, height: outerHeight } = element.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(element)
  const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0
  const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0
  const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
  const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0
  return {
    width: Math.max(0, outerWidth - paddingLeft - paddingRight),
    height: Math.max(0, outerHeight - paddingTop - paddingBottom),
  }
}

async function createStandaloneEditorHandle(
  container: HTMLElement,
  editorAppConfig: ReturnType<typeof createEditorAppConfig>,
  modelScope?: string,
  retainModelOnUnmount = false,
): Promise<MonacoEditorHandle> {
  const resource = editorAppConfig.codeResources?.modified
  const uri = monaco.Uri.parse(resource?.uri ?? 'file:///playground/src/main.cj')
  const leaseOptions = { scope: modelScope, retainWhenUnused: retainModelOnUnmount }
  const existingModel = monaco.editor.getModel(uri)
  let modelFileMirror = await createModelFileMirror(
    uri.toString(),
    existingModel?.getValue() ?? resource?.text ?? '',
  )
  markEditorStartup('model-file-ready')
  let modelLease = acquireModel(uri.toString(), () => {
    if (existingModel)
      return { resource: existingModel, owned: false }
    return {
      resource: monaco.editor.createModel(
        resource?.text ?? '',
        editorAppConfig.editorOptions?.language,
        uri,
      ),
      owned: true,
    }
  }, leaseOptions)
  let model = modelLease.resource as monaco.editor.ITextModel
  let modelFileSubscription = model.onDidChangeContent(() => {
    modelFileMirror.update(model.getValue())
  })

  let editor: monaco.editor.IStandaloneCodeEditor
  try {
    editor = monaco.editor.create(container, {
      ...editorAppConfig.editorOptions,
      model,
    })
    markEditorStartup('created')
  }
  catch (error) {
    modelFileSubscription.dispose()
    await modelFileMirror.dispose()
    modelLease.release()
    throw error
  }

  let disposed = false
  let resourceEpoch = 0

  return {
    getEditor: () => (disposed ? undefined : editor),
    relayout: () => {
      if (disposed || !container.isConnected)
        return
      editor.layout(measureContentBox(container), true)
    },
    updateCodeResources: async (codeResources) => {
      const nextResource = codeResources?.modified
      if (!nextResource || disposed)
        return false

      const epoch = ++resourceEpoch
      const nextUri = monaco.Uri.parse(nextResource.uri ?? model.uri.toString())
      if (nextUri.toString() === model.uri.toString()) {
        if (nextResource.enforceLanguageId)
          monaco.editor.setModelLanguage(model, nextResource.enforceLanguageId)
        return true
      }
      const existingNextModel = monaco.editor.getModel(nextUri)
      const nextModelFileMirror = await createModelFileMirror(
        nextUri.toString(),
        existingNextModel?.getValue() ?? nextResource.text ?? model.getValue(),
      )
      if (disposed || epoch !== resourceEpoch) {
        await nextModelFileMirror.dispose()
        return false
      }

      const currentExistingNextModel = monaco.editor.getModel(nextUri)
      const nextLease = acquireModel(nextUri.toString(), () => {
        if (currentExistingNextModel)
          return { resource: currentExistingNextModel, owned: false }
        return {
          resource: monaco.editor.createModel(
            nextResource.text ?? model.getValue(),
            nextResource.enforceLanguageId ?? model.getLanguageId(),
            nextUri,
          ),
          owned: true,
        }
      }, leaseOptions)
      const nextModel = nextLease.resource as monaco.editor.ITextModel

      // Critical: do NOT setValue on a pre-existing model. The model URI
      // identifies the learner's draft; an unconditional setValue here would
      // clobber typed code whenever upstream props change (e.g. on a locale
      // toggle the editorAppConfig regenerates with a localized starter, and
      // the same-URI model already exists). The caller seeds a fresh model
      // via createModel above when there is none — preserving in-flight
      // edits is the intentional behavior of model reuse.

      if (nextResource.enforceLanguageId)
        monaco.editor.setModelLanguage(nextModel, nextResource.enforceLanguageId)

      try {
        editor.setModel(nextModel)
      }
      catch (error) {
        await nextModelFileMirror.dispose()
        nextLease.release()
        throw error
      }
      const previousLease = modelLease
      const previousModelFileMirror = modelFileMirror
      modelFileSubscription.dispose()
      modelLease = nextLease
      model = nextModel
      modelFileMirror = nextModelFileMirror
      modelFileSubscription = model.onDidChangeContent(() => {
        modelFileMirror.update(model.getValue())
      })
      previousLease.release()
      await previousModelFileMirror.dispose()
      return true
    },
    dispose: async () => {
      if (disposed)
        return
      disposed = true
      resourceEpoch += 1
      editor.dispose()
      modelFileSubscription.dispose()
      await modelFileMirror.dispose()
      modelLease.release()
    },
  }
}

export function MonacoEditorReactComp({
  style,
  onLoad,
  onError,
  code,
  locale,
  enableLanguageClient = true,
  compact,
  wordWrap,
  scrollBeyondLastLine,
  alwaysConsumeMouseWheel,
  statusBarCompactHeight = 44,
  statusBarHostRef,
  uriHint,
  modelScope,
  retainModelOnUnmount = false,
}: MonacoEditorProps) {
  const presentation = useMemo<EditorPresentationOptions | undefined>(() => {
    if (
      compact === undefined
      && wordWrap === undefined
      && scrollBeyondLastLine === undefined
      && alwaysConsumeMouseWheel === undefined
    ) {
      return undefined
    }
    return { compact, wordWrap, scrollBeyondLastLine, alwaysConsumeMouseWheel }
  }, [alwaysConsumeMouseWheel, compact, scrollBeyondLastLine, wordWrap])

  const editorAppConfig = useMemo(
    () => (presentation
      ? createEditorAppConfig(code, locale, uriHint, presentation)
      : createEditorAppConfig(code, locale, uriHint)),
    [code, locale, presentation, uriHint],
  )
  const hasLanguageClient = enableLanguageClient && isLanguageClientAvailable()

  const isInitializedRef = useRef(false)
  const cleanupPromiseRef = useRef<Promise<void>>(Promise.resolve())
  const languageClientRef = useRef<MonacoLanguageClient | null>(null)
  const editorAppRef = useRef<MonacoEditorHandle | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mirror callbacks/config/lifecycle props into refs so the init effect does
  // not tear down + rebuild the editor when a parent re-renders with a fresh
  // callback identity or memoized config.
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const editorAppConfigRef = useRef(editorAppConfig)
  editorAppConfigRef.current = editorAppConfig
  const statusBarCompactHeightRef = useRef(statusBarCompactHeight)
  statusBarCompactHeightRef.current = statusBarCompactHeight
  const statusBarHostRefRef = useRef(statusBarHostRef)
  statusBarHostRefRef.current = statusBarHostRef
  const modelScopeRef = useRef(modelScope)
  modelScopeRef.current = modelScope
  const retainModelOnUnmountRef = useRef(retainModelOnUnmount)
  retainModelOnUnmountRef.current = retainModelOnUnmount

  const [indicatorHost, setIndicatorHost] = useState<HTMLElement | null>(null)
  const [initError, setInitError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Unified init + dispose effect: a local `cancelled` flag + serialized
  // `cleanupPromiseRef` guarantees React StrictMode double-mounts and
  // `hasLanguageClient` toggles never deadlock or leak resources.
  useEffect(() => {
    let cancelled = false
    let localEditorHandle: MonacoEditorHandle | null = null
    let localStatusBar: StatusBarHandle | null = null
    let localLspUnsubscribe: (() => void) | null = null
    let localReleaseLanguageService: (() => Promise<void>) | null = null
    let localResizeObserver: ResizeObserver | null = null
    let localLayoutFrame: number | null = null
    let boundGeneration = 0
    let rebuildPromise: Promise<void> | null = null
    let lastLayout: { width: number, height: number } | undefined

    const getLiveContainer = () => {
      const container = containerRef.current
      if (cancelled || !container || !container.isConnected)
        return null
      return container
    }

    const updateEditorLayout = (force = false) => {
      const container = getLiveContainer()
      if (!container || !localEditorHandle)
        return
      const { width, height } = measureContentBox(container)
      if (!force && lastLayout?.width === width && lastLayout.height === height)
        return
      lastLayout = { width, height }
      localEditorHandle.getEditor()?.layout({ width, height }, true)
    }

    // Panel drags can notify several times per frame, especially with multiple
    // lesson editors. Measure and lay out each editor once before the next paint.
    const scheduleEditorLayout = () => {
      if (cancelled || localLayoutFrame !== null)
        return
      localLayoutFrame = requestAnimationFrame(() => {
        localLayoutFrame = null
        updateEditorLayout()
      })
    }

    // Per-editor lifecycle no longer owns the MonacoLanguageClient. The
    // singleton in `ensureLanguageClient` is shared across every editor on the
    // page; this function just makes sure it's booted against the current
    // editor port.
    const reconcileLanguageClient = async (target: number) => {
      if (!hasLanguageClient || cancelled)
        return

      languageClientRef.current = null
      if (target === 0 || boundGeneration !== target)
        return

      const port = getCurrentEditorPort()
      if (!port)
        return

      const client = await ensureLanguageClient(port)
      if (!client || cancelled || boundGeneration !== target)
        return

      languageClientRef.current = client
    }

    const queueReconcile = (target: number) => {
      const run = async () => {
        if (cancelled)
          return
        try {
          await reconcileLanguageClient(target)
        }
        catch (e) {
          console.error('[LSP] reconcile failed:', e)
        }
      }
      const next = rebuildPromise ? rebuildPromise.then(run, run) : run()
      rebuildPromise = next
      return next
    }

    const initAll = async () => {
      // Wait for any previous unmount's async disposal before acquiring models
      // or mounting into the same DOM host.
      await cleanupPromiseRef.current
      if (cancelled)
        return

      const initialContainer = getLiveContainer()
      if (!initialContainer)
        return

      setInitError(null)

      try {
        await getEnhancedMonacoEnvironment().vscodeApiGlobalInitAwait
        if (!getLiveContainer())
          return

        const vscodeApiConfig = createMonacoVscodeApiConfig()
        const vscodeApiWrapper = new MonacoVscodeApiWrapper(vscodeApiConfig)
        await vscodeApiWrapper.start()
        if (!getLiveContainer())
          return

        ensureMonacoThemeSync()
        ensureMonacoFontRemeasure()

        if (hasLanguageClient) {
          // Fire both concurrently: command registration does its own
          // dynamic imports and shouldn't serialize with LSP boot.
          void registerLspCommands()
          localReleaseLanguageService = acquireLanguageService()
        }

        const containerForEditor = getLiveContainer()
        if (!containerForEditor) {
          const release = localReleaseLanguageService
          localReleaseLanguageService = null
          await release?.()
          return
        }

        const initialEditorAppConfig = editorAppConfigRef.current
        const baseHandle = await createStandaloneEditorHandle(
          containerForEditor,
          initialEditorAppConfig,
          modelScopeRef.current,
          retainModelOnUnmountRef.current,
        )
        if (cancelled) {
          await baseHandle.dispose()
          const release = localReleaseLanguageService
          localReleaseLanguageService = null
          await release?.()
          return
        }

        const editorHandle: MonacoEditorHandle = {
          ...baseHandle,
          relayout: () => updateEditorLayout(true),
        }
        localEditorHandle = editorHandle
        editorAppRef.current = editorHandle

        if (hasLanguageClient) {
          localLspUnsubscribe = subscribeLspStatus((status) => {
            if (cancelled)
              return
            const target = status.state === 'running' ? status.generation : 0
            if (target !== boundGeneration) {
              boundGeneration = target
              void queueReconcile(target)
            }
          })
        }

        // Editing does not depend on the status bar's asynchronous setup.
        // Reveal the editor and bind its lifecycle before waiting for that UI.
        updateEditorLayout(true)
        localResizeObserver = new ResizeObserver(scheduleEditorLayout)
        localResizeObserver.observe(containerForEditor)
        isInitializedRef.current = true
        onLoadRef.current?.(editorHandle)
        markEditorStartup('ready')

        if (editorAppConfigRef.current !== initialEditorAppConfig) {
          void editorHandle.updateCodeResources?.(editorAppConfigRef.current.codeResources)
        }

        if (hasLanguageClient) {
          const externalHost = statusBarHostRefRef.current?.current
          const statusBarParent = externalHost ?? rootRef.current
          if (statusBarParent) {
            const statusBar = await createCustomStatusBar(statusBarParent, {
              position: 'bottom',
              height: 22,
              compactHeight: statusBarCompactHeightRef.current,
            })
            if (cancelled || !getLiveContainer()) {
              statusBar.dispose()
              return
            }
            localStatusBar = statusBar

            const host = document.createElement('div')
            host.style.display = 'flex'
            host.style.alignItems = 'center'
            host.style.height = '100%'
            host.style.zIndex = '2'
            statusBar.container.appendChild(host)
            setIndicatorHost(host)
          }
        }

        if (cancelled || !getLiveContainer())
          return

        updateEditorLayout(true)
        markEditorStartup('statusbar-ready')
      }
      catch (error) {
        if (cancelled)
          return
        const err = error instanceof Error ? error : new Error(String(error))
        console.error('Editor initialization failed:', err)
        const release = localReleaseLanguageService
        localReleaseLanguageService = null
        await release?.().catch(() => undefined)
        setInitError(err)
        onErrorRef.current?.(err)
      }
    }

    void initAll()

    return () => {
      cancelled = true
      isInitializedRef.current = false
      if (localLayoutFrame !== null) {
        cancelAnimationFrame(localLayoutFrame)
        localLayoutFrame = null
      }
      localResizeObserver?.disconnect()
      localResizeObserver = null
      localLspUnsubscribe?.()
      localLspUnsubscribe = null
      setIndicatorHost(null)
      if (editorAppRef.current === localEditorHandle)
        editorAppRef.current = null
      languageClientRef.current = null

      const statusBarToDispose = localStatusBar
      localStatusBar = null
      const editorToDispose = localEditorHandle
      localEditorHandle = null
      const releaseLanguageService = localReleaseLanguageService
      localReleaseLanguageService = null

      cleanupPromiseRef.current = cleanupPromiseRef.current.then(async () => {
        try {
          statusBarToDispose?.dispose()
          await editorToDispose?.dispose()
          await releaseLanguageService?.()
        }
        catch {}
      })
    }
  }, [hasLanguageClient, retryCount])

  // Push code/locale/presentation changes into the running editor without
  // re-creating it. The init effect ignores `editorAppConfig` for this reason.
  useEffect(() => {
    if (!isInitializedRef.current)
      return
    const handle = editorAppRef.current
    if (!handle)
      return
    if (editorAppConfig.editorOptions) {
      const { language: _language, ...runtimeOptions } = editorAppConfig.editorOptions
      handle.getEditor()?.updateOptions(runtimeOptions)
    }
    if (handle.updateCodeResources)
      void handle.updateCodeResources(editorAppConfig.codeResources)
  }, [editorAppConfig])

  const isEnglish = locale === 'en'

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex h-full w-full flex-col"
      style={style}
    >
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden" />
      {indicatorHost && hasLanguageClient && createPortal(<LspStatusIndicator />, indicatorHost)}
      {initError && (
        <div
          role="alert"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center text-sm"
        >
          <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
          <p className="font-medium text-foreground">
            {isEnglish ? 'Failed to load code editor' : '代码编辑器加载失败'}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {initError.message}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryCount(count => count + 1)}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            <span>{isEnglish ? 'Retry' : '重试'}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
