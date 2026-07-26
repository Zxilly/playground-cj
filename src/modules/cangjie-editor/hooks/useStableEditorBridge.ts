'use client'

import { useCallback, useMemo, useRef } from 'react'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import type { EditorBridge } from '@/modules/cangjie-editor/context/editor-bridge-context'

export function useStableEditorBridge(): EditorBridge {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const getEditor = useCallback(() => editorRef.current, [])
  const setEditor = useCallback((editor: monaco.editor.IStandaloneCodeEditor | undefined) => {
    editorRef.current = editor
  }, [])

  return useMemo<EditorBridge>(() => ({ getEditor, setEditor }), [getEditor, setEditor])
}
