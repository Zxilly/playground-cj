import type { CSSProperties } from 'react'
import React, { useEffect, useRef } from 'react'
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper'
import { createWrapperConfig } from '@/lib/monaco'

export interface MonacoEditorProps {
  style?: CSSProperties
  code?: string
  onLoad?: (wrapper: MonacoEditorLanguageClientWrapper) => void
}

export const MonacoEditorReactComp: React.FC<MonacoEditorProps> = (props) => {
  const {
    style,
    onLoad,
    code,
  } = props

  const wrapperConfig = createWrapperConfig(code)

  const wrapperRef = useRef<MonacoEditorLanguageClientWrapper>(new MonacoEditorLanguageClientWrapper())
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const updateEditorLayout = () => {
    if (containerRef.current && wrapperRef.current) {
      const parent = containerRef.current.parentElement!
      const { width: outerWidth, height: outerHeight } = parent.getBoundingClientRect()

      const computedStyle = window.getComputedStyle(parent)
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0
      const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0

      const width = outerWidth - paddingLeft - paddingRight
      const height = outerHeight - paddingTop - paddingBottom

      wrapperRef.current.getEditor()?.layout({ width, height }, true)
    }
  }

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

        updateEditorLayout()

        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }

        resizeObserverRef.current = new ResizeObserver(() => {
          updateEditorLayout()
        })

        resizeObserverRef.current.observe(containerRef.current.parentElement!)
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
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }

      (async () => {
        await disposeMonaco()
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
