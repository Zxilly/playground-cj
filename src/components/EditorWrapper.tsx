import type { CSSProperties } from 'react'
import React, { useEffect, useMemo, useRef } from 'react'
import { MonacoVscodeApiWrapper, getEnhancedMonacoEnvironment } from 'monaco-languageclient/vscodeApiWrapper'
import { LanguageClientsManager } from 'monaco-languageclient/lcwrapper'
import { EditorApp } from 'monaco-languageclient/editorApp'
import { createMonacoVscodeApiConfig, createLanguageClientConfig, createEditorAppConfig } from '@/lib/monaco'

export interface MonacoEditorProps {
  style?: CSSProperties
  code?: string
  onLoad?: (editorApp: EditorApp) => void
}

export const MonacoEditorReactComp: React.FC<MonacoEditorProps> = (props) => {
  const {
    style,
    onLoad,
    code,
  } = props

  const vscodeApiConfig = useMemo(() => createMonacoVscodeApiConfig(), [])
  const languageClientConfig = useMemo(() => createLanguageClientConfig(), [])
  const editorAppConfig = useMemo(() => createEditorAppConfig(code), [code])

  const vscodeApiWrapperRef = useRef<MonacoVscodeApiWrapper>(new MonacoVscodeApiWrapper(vscodeApiConfig))
  const languageClientsManagerRef = useRef<LanguageClientsManager | null>(null)
  const editorAppRef = useRef<EditorApp | null>(null)
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

    const disposeAll = async () => {
      try {
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

    const initAll = async () => {
      if (!containerRef.current) {
        throw new Error('No htmlContainer found! Aborting...')
      }

      // Wait for global initialization to complete
      await awaitGlobal()

      // Step 1: Initialize and start MonacoVscodeApiWrapper
      vscodeApiWrapperRef.current.overrideViewsConfig({
        $type: vscodeApiConfig.viewsConfig.$type,
        htmlContainer: containerRef.current
      })
      await vscodeApiWrapperRef.current.start()

      // Step 2: Initialize and start LanguageClientsManager (if config exists)
      if (languageClientConfig) {
        languageClientsManagerRef.current = new LanguageClientsManager(vscodeApiWrapperRef.current.getLogger())
        await languageClientsManagerRef.current.setConfig(languageClientConfig)
        
        // don't care about it success or failure
        languageClientsManagerRef.current.start()
      }

      // Step 3: Initialize and start EditorApp
      editorAppRef.current = new EditorApp(editorAppConfig)
      await editorAppRef.current.start(containerRef.current)

      onLoad?.(editorAppRef.current)

      updateEditorLayout()

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }

      resizeObserverRef.current = new ResizeObserver(() => {
        updateEditorLayout()
      })

      resizeObserverRef.current.observe(containerRef.current.parentElement!)
    };

    (async () => {
      await disposeAll()
      await initAll()
    })()
  }, [onLoad, vscodeApiConfig, languageClientConfig, editorAppConfig])

  useEffect(() => {
    const disposeAll = async () => {
      try {
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
      className="absolute w-full h-full"
      style={style}
    >
      <div ref={containerRef} />
    </div>
  )
}
