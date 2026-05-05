import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { defaultViewsHtml, getEnhancedMonacoEnvironment, MonacoVscodeApiWrapper } from 'monaco-languageclient/vscodeApiWrapper'
import type { MonacoLanguageClient } from 'monaco-languageclient'
import { EditorApp } from 'monaco-languageclient/editorApp'
import type { CodeResources } from 'monaco-languageclient/editorApp'
import { createEditorAppConfig, createLanguageClient, createMonacoVscodeApiConfig, isLanguageClientAvailable } from '@/lib/monaco'
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
}

function createStandaloneEditorHandle(
  container: HTMLElement,
  editorAppConfig: ReturnType<typeof createEditorAppConfig>,
): MonacoEditorHandle {
  const resource = editorAppConfig.codeResources?.modified
  const uri = monaco.Uri.parse(resource?.uri ?? 'file:///playground/src/main.cj')
  const existingModel = monaco.editor.getModel(uri)
  let model = existingModel ?? monaco.editor.createModel(
    resource?.text ?? '',
    editorAppConfig.editorOptions?.language,
    uri,
  )

  if (existingModel) {
    model.setValue(resource?.text ?? '')
  }

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
      const nextModel = existingNextModel ?? monaco.editor.createModel(
        nextResource.text ?? model.getValue(),
        nextResource.enforceLanguageId ?? model.getLanguageId(),
        nextUri,
      )

      if (existingNextModel && nextResource.text !== undefined) {
        nextModel.setValue(nextResource.text)
      }

      if (nextResource.enforceLanguageId)
        monaco.editor.setModelLanguage(nextModel, nextResource.enforceLanguageId)

      editor.setModel(nextModel)
      model = nextModel
      return true
    },
    dispose: () => {
      editor.dispose()
    },
  }
}

export function MonacoEditorReactComp({ style, onLoad, code, locale, viewsType = 'EditorService' }: MonacoEditorProps) {
  const editorAppConfig = useMemo(() => createEditorAppConfig(code, locale), [code, locale])
  const hasLanguageClient = isLanguageClientAvailable()

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

    const disposeClient = async (client: MonacoLanguageClient) => {
      try {
        await client.stop()
      }
      catch {}

      try {
        await client.dispose()
      }
      catch {}
    }

    const reconcileLanguageClient = async (target: number) => {
      if (!hasLanguageClient || !isActive())
        return

      const prev = languageClientRef.current
      languageClientRef.current = null
      if (prev)
        await disposeClient(prev)

      if (!isActive() || target === 0)
        return

      if (boundGenerationRef.current !== target)
        return

      const port = getCurrentEditorPort()
      if (!port)
        return

      const client = await createLanguageClient(port)
      if (!client)
        return

      if (!isActive()) {
        await disposeClient(client)
        return
      }

      try {
        await client.start()
      }
      catch (e) {
        const m = e instanceof Error ? e.message : JSON.stringify(e)
        console.warn(`[LSP] MonacoLanguageClient.start failed: ${m}`)
        await disposeClient(client)
        return
      }

      if (!isActive() || boundGenerationRef.current !== target) {
        await disposeClient(client)
        return
      }

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
      if (!containerRef.current || isInitializingRef.current || isInitializedRef.current) {
        return
      }

      isInitializingRef.current = true

      try {
        await getEnhancedMonacoEnvironment().vscodeApiGlobalInitAwait

        if (viewsType === 'ViewsService' && containerRef.current && !containerRef.current.querySelector('#workbench-container')) {
          containerRef.current.innerHTML = defaultViewsHtml
        }

        const vscodeApiConfig = createMonacoVscodeApiConfig(containerRef.current, viewsType)
        vscodeApiWrapperRef.current = new MonacoVscodeApiWrapper(vscodeApiConfig)
        await vscodeApiWrapperRef.current.start()

        if (hasLanguageClient) {
          // Fire both concurrently: command registration does its own
          // dynamic imports and shouldn't serialize with LSP boot.
          void registerLspCommands()
          void startLsp('auto')
        }

        const editorContainer = viewsType === 'EditorService'
          ? containerRef.current
          : standaloneHostRef.current ?? containerRef.current

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
          const parentContainer = containerRef.current.parentElement
          if (parentContainer) {
            statusBarRef.current = await createCustomStatusBar(parentContainer, {
              position: 'bottom',
              height: 22,
            })

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

        onLoadRef.current?.(editorHandle)

        updateEditorLayout()

        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }

        resizeObserverRef.current = new ResizeObserver(updateEditorLayout)

        resizeObserverRef.current.observe(containerRef.current.parentElement!)

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
        const client = languageClientRef.current
        languageClientRef.current = null
        const vscodeApiWrapper = vscodeApiWrapperRef.current
        vscodeApiWrapperRef.current = null

        statusBar?.dispose()
        await editorApp?.dispose()
        if (client) {
          try {
            await client.stop()
          }
          catch {}

          try {
            await client.dispose()
          }
          catch {}
        }
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
