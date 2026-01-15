import type { CSSProperties } from 'react'
import React, { useEffect, useMemo, useRef } from 'react'
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

export const MonacoEditorReactComp: React.FC<MonacoEditorProps> = (props) => {
  const {
    style,
    onLoad,
    code,
    locale,
  } = props

  const languageClientConfig = useMemo(() => createLanguageClientConfig(), [])
  const editorAppConfig = useMemo(() => createEditorAppConfig(code, locale), [code, locale])

  // Flag to prevent multiple initializations
  const isInitializingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const vscodeApiWrapperRef = useRef<MonacoVscodeApiWrapper | null>(null)
  const languageClientsManagerRef = useRef<LanguageClientManager | null>(null)
  const editorAppRef = useRef<EditorApp | null>(null)
  const statusBarRef = useRef<StatusBarHandle | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

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

    const awaitGlobal = async () => {
      const envEnhanced = getEnhancedMonacoEnvironment()
      return envEnhanced.vscodeApiGlobalInitAwait ?? Promise.resolve()
    }

    const initAll = async () => {
      if (!containerRef.current || isInitializingRef.current || isInitializedRef.current) {
        return
      }

      isInitializingRef.current = true

      try {
        // Wait for global initialization to complete
        await awaitGlobal()

        // Step 1: Create vscode API config with container and initialize MonacoVscodeApiWrapper
        const vscodeApiConfig = createMonacoVscodeApiConfig(containerRef.current ?? undefined)
        vscodeApiWrapperRef.current = new MonacoVscodeApiWrapper(vscodeApiConfig)
        await vscodeApiWrapperRef.current.start()

        // Step 2: Initialize and start LanguageClientManager (if config exists)
        if (languageClientConfig) {
          languageClientsManagerRef.current = new LanguageClientManager()
          languageClientsManagerRef.current.setConfig(languageClientConfig)
          languageClientsManagerRef.current.start()
        }

        // Step 3: Initialize and start EditorApp
        editorAppRef.current = new EditorApp(editorAppConfig)
        await editorAppRef.current.start(containerRef.current)

        // Step 4: Create custom status bar only if LSP is enabled (non-mobile)
        if (languageClientConfig) {
          const parentContainer = containerRef.current.parentElement
          if (parentContainer) {
            statusBarRef.current = await createCustomStatusBar(parentContainer, {
              position: 'bottom',
              height: 22,
            })

            // Add LSP status entry
            const lspStatusEntry = statusBarRef.current.addEntry({
              id: 'lsp.status',
              name: 'LSP',
              text: '$(sync~spin) Cangjie',
              ariaLabel: 'LSP initializing',
              tooltip: 'Language Server: Initializing...',
              alignment: 'right',
              priority: 100,
            })

            // Update status when LSP is ready
            const checkLspStatus = () => {
              const status = getLspStatus()
              if (languageClientsManagerRef.current?.isStarted() && status.initialized) {
                lspStatusEntry.update({
                  text: '$(check) Cangjie',
                  ariaLabel: 'LSP ready',
                  tooltip: `Cangjie Language Server\n\nStatus: Ready\nStdlib modules: ${status.stdlibModulesLoaded}/${status.stdlibModulesTotal}`,
                })
              }
              else {
                lspStatusEntry.update({
                  tooltip: `Cangjie Language Server\n\nStatus: Loading...\nStdlib modules: ${status.stdlibModulesLoaded}/${status.stdlibModulesTotal}`,
                })
                // Check again after a short delay
                // eslint-disable-next-line react-web-api/no-leaked-timeout
                setTimeout(checkLspStatus, 500)
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

        resizeObserverRef.current = new ResizeObserver(() => {
          updateEditorLayout()
        })

        resizeObserverRef.current.observe(containerRef.current.parentElement!)

        isInitializedRef.current = true
      }
      catch (error) {
        console.error('Editor initialization failed:', error)
      }
      finally {
        isInitializingRef.current = false
      }
    };

    (async () => {
      await initAll()
    })()
  }, [onLoad, editorAppConfig, languageClientConfig])

  useEffect(() => {
    const disposeAll = async () => {
      try {
        isInitializedRef.current = false
        if (statusBarRef.current) {
          statusBarRef.current.dispose()
        }
        if (editorAppRef.current) {
          await editorAppRef.current.dispose()
        }
        if (languageClientsManagerRef.current) {
          await languageClientsManagerRef.current.dispose()
        }
        if (vscodeApiWrapperRef.current) {
          await vscodeApiWrapperRef.current.dispose()
        }
      }
      catch {
        // The components may throw errors during disposal, but we want to continue anyway
      }
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }

      (async () => {
        await disposeAll()
      })()
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
