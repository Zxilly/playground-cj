import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { getEnhancedMonacoEnvironment, MonacoVscodeApiWrapper } from 'monaco-languageclient/vscodeApiWrapper'
import { LanguageClientManager } from 'monaco-languageclient/lcwrapper'
import { EditorApp } from 'monaco-languageclient/editorApp'
import { createEditorAppConfig, createLanguageClientConfig, createMonacoVscodeApiConfig } from '@/lib/monaco'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { getLspStatus } from '@/lib/lsp'

export interface MonacoEditorProps {
  style?: CSSProperties
  code?: string
  onLoad?: (editorApp: EditorApp) => void
  locale?: string
}

export function MonacoEditorReactComp({ style, onLoad, code, locale }: MonacoEditorProps) {
  const languageClientConfig = useMemo(() => createLanguageClientConfig(), [])
  const editorAppConfig = useMemo(() => createEditorAppConfig(code, locale), [code, locale])

  const isInitializingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const vscodeApiWrapperRef = useRef<MonacoVscodeApiWrapper | null>(null)
  const languageClientsManagerRef = useRef<LanguageClientManager | null>(null)
  const editorAppRef = useRef<EditorApp | null>(null)
  const statusBarRef = useRef<StatusBarHandle | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const lspPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const updateEditorLayout = () => {
      if (containerRef.current && editorAppRef.current) {
        const parent = containerRef.current.parentElement!
        const { width: outerWidth, height: outerHeight } = parent.getBoundingClientRect()

        const computedStyle = window.getComputedStyle(parent)
        const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0
        const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0
        const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
        const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0

        const width = outerWidth - paddingLeft - paddingRight
        const height = outerHeight - paddingTop - paddingBottom

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

        const vscodeApiConfig = createMonacoVscodeApiConfig(containerRef.current)
        vscodeApiWrapperRef.current = new MonacoVscodeApiWrapper(vscodeApiConfig)
        await vscodeApiWrapperRef.current.start()

        if (languageClientConfig) {
          languageClientsManagerRef.current = new LanguageClientManager()
          languageClientsManagerRef.current.setConfig(languageClientConfig)
          languageClientsManagerRef.current.start()
        }

        editorAppRef.current = new EditorApp(editorAppConfig)
        await editorAppRef.current.start(containerRef.current)

        if (languageClientConfig) {
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

        onLoad?.(editorAppRef.current)

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
  }, [onLoad, editorAppConfig, languageClientConfig])

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
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden" />
    </div>
  )
}
