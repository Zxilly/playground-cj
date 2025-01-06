import type { CSSProperties } from 'react'
import React, { useCallback, useEffect, useRef } from 'react'
import type { WrapperConfig } from 'monaco-editor-wrapper'
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper'
import * as vscode from 'vscode'

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

  const destroyMonaco = useCallback(async () => {
    try {
      await wrapperRef.current.dispose()
    }
    catch {
      // The language client may throw an error during disposal.
      // This should not prevent us from continue working.
    }
  }, [])

  useEffect(() => {
    return () => {
      destroyMonaco()
    }
  }, [destroyMonaco])

  const startMonaco = useCallback(async () => {
    if (containerRef.current) {
      // set workspace
      const uri = vscode.Uri.parse('file:///playground')
      // @ts-expect-error not exposed in type
      uri._fsPath = '/playground'

      vscode.workspace.updateWorkspaceFolders(0, 0, {
        uri,
        name: 'playground',
      })

      await wrapperRef.current.start(containerRef.current)
      onLoad?.(wrapperRef.current)
    }
  }, [onLoad])

  const handleReInit = useCallback(async () => {
    if (wrapperRef.current.isStopping() === undefined) {
      await destroyMonaco()
    }
    else {
      await wrapperRef.current.isStopping()
    }

    if (wrapperRef.current.isStarting() === undefined) {
      await wrapperRef.current.init(wrapperConfig)
      await startMonaco()
    }
    else {
      await wrapperRef.current.isStarting()
    }
  }, [destroyMonaco, startMonaco, wrapperConfig])

  useEffect(() => {
    handleReInit()
  }, [handleReInit, wrapperConfig])

  return (
    <div
      ref={containerRef}
      style={style}
    />
  )
}
