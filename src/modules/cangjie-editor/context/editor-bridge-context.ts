import { createContext } from 'react'
import type * as monaco from '@codingame/monaco-vscode-editor-api'

/**
 * Imperative access to the mounted Monaco editor.
 *
 * Reactive editor state lives in feature stores. This bridge only keeps the
 * live editor handle stable across parent re-renders.
 */
export interface EditorBridge {
  getEditor: () => monaco.editor.IStandaloneCodeEditor | undefined
  setEditor: (editor: monaco.editor.IStandaloneCodeEditor | undefined) => void
}

export interface EditorBridgeValue {
  editor: EditorBridge
  lang: string
}

export const EditorBridgeContext = createContext<EditorBridgeValue | null>(null)
