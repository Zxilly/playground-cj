import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { defaultViewsHtml, getEnhancedMonacoEnvironment, MonacoVscodeApiWrapper } from 'monaco-languageclient/vscodeApiWrapper'
import type { MonacoLanguageClient } from 'monaco-languageclient'
import { EditorApp } from 'monaco-languageclient/editorApp'
import type { CodeResources } from 'monaco-languageclient/editorApp'
import { createEditorAppConfig, createMonacoVscodeApiConfig, ensureCangjieMonarchTokensProvider, ensureLanguageClient, isLanguageClientAvailable } from '@/lib/monaco'
import type { MonacoViewsType } from '@/lib/monaco'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { getCurrentEditorPort, startLsp, subscribeLspStatus } from '@/lib/lsp'
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
  // the same page (e.g. one per quiz) hold independent models. Same hint reuses
  // the same model across React mounts and preserves user edits.
  uriHint?: string
}

function createStandaloneEditorHandle(
  container: HTMLElement,
  editorAppConfig: ReturnType<typeof createEditorAppConfig>,
): MonacoEditorHandle {
  const resource = editorAppConfig.codeResources?.modified
  const uri = monaco.Uri.parse(resource?.uri ?? 'file:///playground/src/main.cj')
  const existingModel = monaco.editor.getModel(uri)
  // Reusing an existing model preserves user edits across React mount cycles.
  // Only seed the model text when creating it for the first time — otherwise
  // a quiz card that re-enters the viewport would clobber whatever the user
  // had typed earlier.
  //
  // Track ownership: only the handle that *created* the model is allowed to
  // dispose it. This prevents one quiz card unmounting from killing a model
  // another card might still want to reuse. Models created by other handles
  // (i.e. `existingModel` was hit) stay alive — they'll be GC'd when the page
  // unloads, and the model registry size is bounded by the number of distinct
  // quiz URIs the learner has ever opened in this page session.
  const ownedModelUris = new Set<string>()
  let model = existingModel ?? (() => {
    const created = monaco.editor.createModel(
      resource?.text ?? '',
      editorAppConfig.editorOptions?.language,
      uri,
    )
    ownedModelUris.add(created.uri.toString())
    return created
  })()

  const editor = monaco.editor.create(container, {
    ...editorAppConfig.editorOptions,
    model,
  })

  return {
    getEditor: () => editor,
    updateCodeResources: async (codeResources) => {
      const nextResource = codeResources?.modified
      if (!nextResource)
        return false

      const nextUri = monaco.Uri.parse(nextResource.uri ?? model.uri.toString())
      const existingNextModel = monaco.editor.getModel(nextUri)
      const nextModel = existingNextModel ?? (() => {
        const created = monaco.editor.createModel(
          nextResource.text ?? model.getValue(),
          nextResource.enforceLanguageId ?? model.getLanguageId(),
          nextUri,
        )
        ownedModelUris.add(created.uri.toString())
        return created
      })()

      // Critical: do NOT setValue on a pre-existing model. The model URI
      // identifies the learner's draft; an unconditional setValue here would
      // clobber typed code whenever upstream props change (e.g. on a locale
      // toggle the editorAppConfig regenerates with a localized starter, and
      // the same-URI model already exists). The caller seeds a fresh model
      // via createModel above when there is none — preserving in-flight
      // edits is the intentional behavior of model reuse.

      if (nextResource.enforceLanguageId)
        monaco.editor.setModelLanguage(nextModel, nextResource.enforceLanguageId)

      editor.setModel(nextModel)
      model = nextModel
      return true
    },
    dispose: () => {
      editor.dispose()
      // Intentionally do NOT dispose models here. Virtuoso virtualizes quiz
      // cards in and out of the DOM constantly during scroll — disposing the
      // model on every unmount would wipe the learner's in-progress code as
      // soon as they scrolled past their own quiz. Models survive the page
      // session; the localStorage draft store (cleared on quiz success/skip
      // in QuizPracticeCard) is the only persistence layer with a bounded
      // size. The Monaco model registry is bounded by the count of distinct
      // quiz URIs the learner has opened in this page session, which is
      // small enough that retaining them until page unload is fine.
      // `ownedModelUris` is tracked for the future case where we want to
      // explicitly drop models for definitively-finished quizzes (e.g. a
      // session-level cleanup hook), but is otherwise unused.
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
}: MonacoEditorProps) {
  const editorAppConfig = useMemo(() => createEditorAppConfig(code, locale, uriHint), [code, locale, uriHint])
  const hasLanguageClient = enableLanguageClient && isLanguageClientAvailable()

  const isInitializingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const vscodeApiWrapperRef = useRef<MonacoVscodeApiWrapper | null>(null)
  const languageClientRef = useRef<MonacoLanguageClient | null>(null)
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
        vscodeApiWrapperRef.current = vscodeApiWrapper
        const shouldRegisterExtensionsAfterStart = getEnhancedMonacoEnvironment().vscodeApiInitialised === true
        await vscodeApiWrapper.start()
        if (shouldRegisterExtensionsAfterStart)
          await vscodeApiWrapper.initExtensions()
        ensureCangjieMonarchTokensProvider()
        const containerAfterWrapperStart = getLiveContainer()
        if (!containerAfterWrapperStart) {
          if (vscodeApiWrapperRef.current === vscodeApiWrapper)
            vscodeApiWrapperRef.current = null
          await vscodeApiWrapper.dispose()
          return
        }

        if (hasLanguageClient) {
          // Fire both concurrently: command registration does its own
          // dynamic imports and shouldn't serialize with LSP boot.
          void registerLspCommands()
          void startLsp('auto')
        }

        const editorContainer = viewsType === 'EditorService'
          ? containerAfterWrapperStart
          : standaloneHostRef.current && standaloneHostRef.current.isConnected
            ? standaloneHostRef.current
            : containerAfterWrapperStart

        const initialEditorAppConfig = editorAppConfigRef.current
        let editorHandle: MonacoEditorHandle
        if (viewsType === 'ViewsService') {
          editorHandle = createStandaloneEditorHandle(editorContainer, initialEditorAppConfig)
        }
        else {
          const editorApp = new EditorApp(initialEditorAppConfig)
          await editorApp.start(editorContainer)
          editorHandle = editorApp
        }
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
    // Intentionally exclude `onLoad` and `editorAppConfig` — both are
    // mirrored through refs above. Including them would force a full editor
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
        // Forget the shared MonacoLanguageClient reference — but do NOT
        // stop/dispose it. The client is page-scoped (see ensureLanguageClient)
        // and other editors on the page may still depend on it. The singleton
        // lives until page unload.
        languageClientRef.current = null
        const vscodeApiWrapper = vscodeApiWrapperRef.current
        vscodeApiWrapperRef.current = null

        statusBar?.dispose()
        await editorApp?.dispose()
        await vscodeApiWrapper?.dispose()
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
