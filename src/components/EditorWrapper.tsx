import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { defaultViewsHtml, getEnhancedMonacoEnvironment, MonacoVscodeApiWrapper } from 'monaco-languageclient/vscodeApiWrapper'
import { LanguageClientManager } from 'monaco-languageclient/lcwrapper'
import { EditorApp } from 'monaco-languageclient/editorApp'
import type { CodeResources } from 'monaco-languageclient/editorApp'
import { createEditorAppConfig, createLanguageClientConfig, createMonacoVscodeApiConfig } from '@/lib/monaco'
import type { MonacoViewsType } from '@/lib/monaco'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { getLspStatus } from '@/lib/lsp'
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
      let nextModel = existingNextModel ?? monaco.editor.createModel(
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
  const languageClientConfig = useMemo(() => createLanguageClientConfig(), [])
  const editorAppConfig = useMemo(() => createEditorAppConfig(code, locale), [code, locale])

  const isInitializingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const vscodeApiWrapperRef = useRef<MonacoVscodeApiWrapper | null>(null)
  const languageClientsManagerRef = useRef<LanguageClientManager | null>(null)
  const editorAppRef = useRef<MonacoEditorHandle | null>(null)
  const statusBarRef = useRef<StatusBarHandle | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const standaloneHostRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const lspPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
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

        if (languageClientConfig) {
          languageClientsManagerRef.current = new LanguageClientManager()
          languageClientsManagerRef.current.setConfig(languageClientConfig)
          languageClientsManagerRef.current.start()
        }

        const editorContainer = viewsType === 'EditorService'
          ? containerRef.current
          : standaloneHostRef.current ?? containerRef.current

        let editorHandle: MonacoEditorHandle
        if (viewsType === 'ViewsService') {
          editorHandle = createStandaloneEditorHandle(editorContainer, editorAppConfig)
        }
        else {
          const editorApp = new EditorApp(editorAppConfig)
          await editorApp.start(editorContainer)
          editorHandle = editorApp
        }
        editorAppRef.current = editorHandle

        if (languageClientConfig && viewsType === 'EditorService') {
          const parentContainer = containerRef.current.parentElement
          if (parentContainer) {
            statusBarRef.current = await createCustomStatusBar(parentContainer, {
              position: 'bottom',
              height: 22,
            })

            const lspStatusEntry = statusBarRef.current.addEntry({
              id: 'lsp.status',
              name: 'LSP',
              text: '$(sync~spin) Cangjie',
              ariaLabel: 'LSP initializing',
              tooltip: 'Language Server: Initializing...',
              alignment: 'right',
              priority: 100,
            })

            const checkLspStatus = () => {
              const status = getLspStatus()
              if (languageClientsManagerRef.current?.isStarted() && status.initialized) {
                lspStatusEntry.update({
                  text: '$(check) Cangjie',
                  ariaLabel: 'LSP ready',
                  tooltip: `Cangjie Language Server\n\nStatus: Ready\nStdlib modules: ${status.stdlibModulesLoaded}/${status.stdlibModulesTotal}`,
                })
                lspPollTimerRef.current = null
              }
              else {
                lspStatusEntry.update({
                  tooltip: `Cangjie Language Server\n\nStatus: Loading...\nStdlib modules: ${status.stdlibModulesLoaded}/${status.stdlibModulesTotal}`,
                })
                lspPollTimerRef.current = setTimeout(checkLspStatus, 500)
              }
            }
            checkLspStatus()
          }
        }

        onLoad?.(editorHandle)

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
  }, [onLoad, editorAppConfig, languageClientConfig, viewsType])

  useEffect(() => {
    const disposeAll = async () => {
      try {
        isInitializedRef.current = false
        statusBarRef.current?.dispose()
        await editorAppRef.current?.dispose()
        await languageClientsManagerRef.current?.dispose()
        await vscodeApiWrapperRef.current?.dispose()
      }
      catch {
        // Components may throw during disposal
      }
    }

    return () => {
      if (lspPollTimerRef.current) {
        clearTimeout(lspPollTimerRef.current)
        lspPollTimerRef.current = null
      }
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
    </div>
  )
}
