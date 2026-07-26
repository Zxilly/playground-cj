import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { defaultViewsHtml, getEnhancedMonacoEnvironment, MonacoVscodeApiWrapper } from '@/lib/monaco/vscode-api'
import type { CodeResources, MonacoLanguageClient } from '@/lib/monaco/vscode-api'
import { acquireLanguageService, createEditorAppConfig, createMonacoVscodeApiConfig, ensureCangjieMonarchTokensProvider, ensureLanguageClient, isLanguageClientAvailable } from '@/lib/monaco'
import type { MonacoViewsType } from '@/lib/monaco'
import { acquireModel } from '@/lib/monaco/model-lifecycle'
import { createModelFileMirror } from '@/lib/monaco/model-file-mirror'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { getCurrentEditorPort, subscribeLspStatus } from '@/lib/lsp'
import { registerLspCommands } from '@/lib/lsp-commands'
import { LspStatusIndicator } from '@/modules/cangjie-editor/components/LspStatusIndicator'
import * as monaco from '@codingame/monaco-vscode-editor-api'

export interface MonacoEditorHandle {
  getEditor: () => monaco.editor.IStandaloneCodeEditor | undefined
  dispose: () => Promise<void> | void
  updateCodeResources?: (codeResources?: CodeResources) => Promise<boolean> | boolean
}

export interface MonacoEditorProps {
  style?: CSSProperties
  code?: string
  onLoad?: (editorApp: MonacoEditorHandle) => void
  locale?: string
  viewsType?: MonacoViewsType
  enableLanguageClient?: boolean
  // Disambiguator that becomes part of the model URI so multiple editors on
  // the same page hold independent models. Reuse across React mounts requires
  // retainModelOnUnmount plus a parent modelScope.
  uriHint?: string
  // Models retained across editor-only unmounts belong to a parent lifecycle
  // scope (for example one lesson) which disposes them on route/view exit.
  modelScope?: string
  retainModelOnUnmount?: boolean
}

function isServicesAlreadyInitializedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /services are already initialized/i.test(message)
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
  }
  catch (error) {
    modelFileSubscription.dispose()
    await modelFileMirror.dispose()
    modelLease.release()
    throw error
  }

  return {
    getEditor: () => editor,
    updateCodeResources: async (codeResources) => {
      const nextResource = codeResources?.modified
      if (!nextResource)
        return false

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
      const nextLease = acquireModel(nextUri.toString(), () => {
        if (existingNextModel)
          return { resource: existingNextModel, owned: false }
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
  code,
  locale,
  viewsType = 'EditorService',
  enableLanguageClient = true,
  uriHint,
  modelScope,
  retainModelOnUnmount = false,
}: MonacoEditorProps) {
  const editorAppConfig = useMemo(
    () => createEditorAppConfig(code, locale, uriHint),
    [code, locale, uriHint],
  )
  const hasLanguageClient = enableLanguageClient && isLanguageClientAvailable()

  const isInitializingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const languageClientRef = useRef<MonacoLanguageClient | null>(null)
  const releaseLanguageServiceRef = useRef<(() => Promise<void>) | null>(null)
  const editorAppRef = useRef<MonacoEditorHandle | null>(null)
  const statusBarRef = useRef<StatusBarHandle | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const standaloneHostRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const lspUnsubscribeRef = useRef<(() => void) | null>(null)
  const boundGenerationRef = useRef<number>(0)
  const rebuildPromiseRef = useRef<Promise<void> | null>(null)
  const reconcileEpochRef = useRef(0)

  // Mirror onLoad / editorAppConfig into refs so the init effect doesn't
  // fire (and tear down + rebuild the editor) when a parent re-renders with a
  // fresh callback identity, e.g. during HMR or during incidental upstream
  // state changes.
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const editorAppConfigRef = useRef(editorAppConfig)
  editorAppConfigRef.current = editorAppConfig
  const modelScopeRef = useRef(modelScope)
  modelScopeRef.current = modelScope
  const retainModelOnUnmountRef = useRef(retainModelOnUnmount)
  retainModelOnUnmountRef.current = retainModelOnUnmount

  const [indicatorHost, setIndicatorHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const reconcileEpoch = ++reconcileEpochRef.current
    const isActive = () => reconcileEpochRef.current === reconcileEpoch
    const getLiveContainer = () => {
      const container = containerRef.current
      if (!container || !container.isConnected || !isActive())
        return null
      return container
    }

    const updateEditorLayout = () => {
      if (containerRef.current && editorAppRef.current) {
        const parent = viewsType === 'EditorService'
          ? containerRef.current.parentElement!
          : standaloneHostRef.current ?? containerRef.current.parentElement!
        const { width: outerWidth, height: outerHeight } = parent.getBoundingClientRect()

        const computedStyle = window.getComputedStyle(parent)
        const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0
        const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0
        const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
        const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0

        const width = outerWidth - paddingLeft - paddingRight
        const statusBarHeight = viewsType === 'EditorService'
          ? (statusBarRef.current?.container.offsetHeight ?? 0)
          : 0
        const height = outerHeight - paddingTop - paddingBottom - statusBarHeight

        editorAppRef.current.getEditor()?.layout({ width, height }, true)
      }
    }

    // Per-editor lifecycle no longer owns the MonacoLanguageClient. The
    // singleton in `ensureLanguageClient` is shared across every editor on the
    // page; this function just makes sure it's booted against the current
    // editor port. Multiple editors used to fight over the same MessagePort
    // (MessagePort.onmessage is single-consumer), starving secondary editors
    // of LSP service — keeping the client global eliminates that race.
    const reconcileLanguageClient = async (target: number) => {
      if (!hasLanguageClient || !isActive())
        return

      languageClientRef.current = null
      if (target === 0)
        return
      if (boundGenerationRef.current !== target)
        return

      const port = getCurrentEditorPort()
      if (!port)
        return

      const client = await ensureLanguageClient(port)
      if (!client)
        return
      if (!isActive() || boundGenerationRef.current !== target)
        return

      languageClientRef.current = client
    }

    const queueReconcile = (target: number) => {
      const run = async () => {
        if (!isActive())
          return
        try {
          await reconcileLanguageClient(target)
        }
        catch (e) {
          console.error('[LSP] reconcile failed:', e)
        }
      }
      const next = rebuildPromiseRef.current ? rebuildPromiseRef.current.then(run, run) : run()
      rebuildPromiseRef.current = next
      return next
    }

    const initAll = async () => {
      const initialContainer = getLiveContainer()
      if (!initialContainer || isInitializingRef.current || isInitializedRef.current) {
        return
      }

      isInitializingRef.current = true

      try {
        await getEnhancedMonacoEnvironment().vscodeApiGlobalInitAwait
        const containerAfterGlobalInit = getLiveContainer()
        if (!containerAfterGlobalInit)
          return

        if (viewsType === 'ViewsService' && !containerAfterGlobalInit.querySelector('#workbench-container')) {
          containerAfterGlobalInit.innerHTML = defaultViewsHtml
        }

        const vscodeApiConfig = createMonacoVscodeApiConfig(containerAfterGlobalInit, viewsType)
        const vscodeApiWrapper = new MonacoVscodeApiWrapper(vscodeApiConfig)
        try {
          await vscodeApiWrapper.start()
        }
        catch (error) {
          if (!isServicesAlreadyInitializedError(error))
            throw error
          // Compatibility with a runtime initialized outside this wrapper.
        }
        ensureCangjieMonarchTokensProvider()
        const containerAfterWrapperStart = getLiveContainer()
        if (!containerAfterWrapperStart)
          return

        if (hasLanguageClient) {
          // Fire both concurrently: command registration does its own
          // dynamic imports and shouldn't serialize with LSP boot.
          void registerLspCommands()
          releaseLanguageServiceRef.current ??= acquireLanguageService()
        }

        const editorContainer = viewsType === 'EditorService'
          ? containerAfterWrapperStart
          : standaloneHostRef.current && standaloneHostRef.current.isConnected
            ? standaloneHostRef.current
            : containerAfterWrapperStart

        const initialEditorAppConfig = editorAppConfigRef.current
        // Both EditorService and ViewsService modes drive the editor directly
        // via a standalone handle (monaco.editor.create + model reuse). The old
        // EditorApp abstraction from monaco-languageclient is no longer used.
        const editorHandle: MonacoEditorHandle = await createStandaloneEditorHandle(
          editorContainer,
          initialEditorAppConfig,
          modelScopeRef.current,
          retainModelOnUnmountRef.current,
        )
        if (!isActive()) {
          await editorHandle.dispose()
          return
        }
        editorAppRef.current = editorHandle

        if (hasLanguageClient) {
          lspUnsubscribeRef.current = subscribeLspStatus((status) => {
            const target = status.state === 'running' ? status.generation : 0
            if (target !== boundGenerationRef.current) {
              boundGenerationRef.current = target
              void queueReconcile(target)
            }
          })
        }

        if (hasLanguageClient && viewsType === 'EditorService') {
          const parentContainer = containerAfterWrapperStart.parentElement
          if (parentContainer) {
            const statusBar = await createCustomStatusBar(parentContainer, {
              position: 'bottom',
              height: 22,
            })
            if (!isActive()) {
              statusBar.dispose()
              return
            }
            statusBarRef.current = statusBar

            const host = document.createElement('div')
            host.style.position = 'absolute'
            host.style.right = '0'
            host.style.top = '0'
            host.style.bottom = '0'
            host.style.display = 'flex'
            host.style.alignItems = 'center'
            host.style.zIndex = '2'
            statusBarRef.current.container.appendChild(host)
            setIndicatorHost(host)
          }
        }

        if (!getLiveContainer())
          return

        onLoadRef.current?.(editorHandle)

        updateEditorLayout()

        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }

        resizeObserverRef.current = new ResizeObserver(updateEditorLayout)

        const resizeParent = containerAfterWrapperStart.parentElement
        if (resizeParent)
          resizeObserverRef.current.observe(resizeParent)

        isInitializedRef.current = true
      }
      catch (error) {
        console.error('Editor initialization failed:', error)
      }
      finally {
        isInitializingRef.current = false
      }
    }

    void initAll()
    // Intentionally exclude callback/config/lifecycle props — they are mirrored
    // through refs above. Including them would force a full editor
    // teardown + rebuild on every parent re-render that produces a fresh
    // callback or memoized config (especially common during HMR).
  }, [hasLanguageClient, viewsType])

  // Push code/locale changes into the running editor without re-creating
  // it. The init effect ignores `editorAppConfig` for this reason — model
  // updates flow through `updateCodeResources` instead.
  useEffect(() => {
    if (!isInitializedRef.current)
      return
    const handle = editorAppRef.current
    if (!handle?.updateCodeResources)
      return
    void handle.updateCodeResources(editorAppConfig.codeResources)
  }, [editorAppConfig])

  useEffect(() => {
    const disposeAll = async () => {
      try {
        isInitializedRef.current = false
        reconcileEpochRef.current += 1
        rebuildPromiseRef.current = null
        boundGenerationRef.current = 0
        lspUnsubscribeRef.current?.()
        lspUnsubscribeRef.current = null
        setIndicatorHost(null)
        const statusBar = statusBarRef.current
        statusBarRef.current = null
        const editorApp = editorAppRef.current
        editorAppRef.current = null
        // Drop only this component's reference. Releasing the service lease
        // keeps the singleton alive for other editors and shuts it down when
        // this was the final consumer.
        languageClientRef.current = null
        const releaseLanguageService = releaseLanguageServiceRef.current
        releaseLanguageServiceRef.current = null

        statusBar?.dispose()
        await editorApp?.dispose()
        await releaseLanguageService?.()
      }
      catch {
      }
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }

      void disposeAll()
    }
  }, [])

  return (
    <div
      className="absolute w-full h-full flex flex-col"
      style={style}
    >
      <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
      {viewsType === 'ViewsService' && (
        <div ref={standaloneHostRef} className="absolute inset-0 z-10" />
      )}
      {indicatorHost && hasLanguageClient && createPortal(<LspStatusIndicator />, indicatorHost)}
    </div>
  )
}
