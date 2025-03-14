import type { CSSProperties } from 'react'
import React, { useEffect, useRef } from 'react'
import type { WrapperConfig } from 'monaco-editor-wrapper'
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper'

export interface MonacoEditorProps {
  style?: CSSProperties
  wrapperConfig: WrapperConfig
  onLoad?: (wrapper: MonacoEditorLanguageClientWrapper) => void
}

export const MonacoEditorReactComp: React.FC<MonacoEditorProps> = (props) => {
  const {
    style,
    wrapperConfig,
    onLoad,
  } = props

  const wrapperRef = useRef<MonacoEditorLanguageClientWrapper>(new MonacoEditorLanguageClientWrapper())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const disposeMonaco = async () => {
      try {
        await wrapperRef.current.dispose()
      }
      catch {
        // The language client may throw an error during disposal, but we want to continue anyway
      }
    }

    const initMonaco = async () => {
      if (containerRef.current) {
        wrapperConfig.htmlContainer = containerRef.current
        await wrapperRef.current.init(wrapperConfig)
      }
      else {
        throw new Error('No htmlContainer found! Aborting...')
      }
    }

    const startMonaco = async () => {
      if (containerRef.current) {
        await wrapperRef.current.start()
        onLoad?.(wrapperRef.current)
      }
      else {
        throw new Error('No htmlContainer found! Aborting...')
      }
    };

    (async () => {
      await disposeMonaco()
      await initMonaco()
      await startMonaco()
    })()
  }, [wrapperConfig, onLoad])

  useEffect(() => {
    // exact copy of the above function, to prevent declaration in useCallback
    const disposeMonaco = async () => {
      try {
        await wrapperRef.current.dispose()
      }
      catch {
        // The language client may throw an error during disposal, but we want to continue anyway
      }
    }

    return () => {
      (async () => {
        await disposeMonaco()
      })()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={style}
    />
  )
}
