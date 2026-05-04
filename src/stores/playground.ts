'use client'

import { create } from 'zustand'
import type * as monaco from '@codingame/monaco-vscode-editor-api'

interface PlaygroundState {
  /** Monaco editor instance — transient. Read via `getState().editor` in callbacks; do not subscribe in render. */
  readonly editor: monaco.editor.IStandaloneCodeEditor | undefined
  readonly toolOutput: string
  readonly programOutput: string
  readonly isOutputCollapsed: boolean
  /** Non-null while the share dialog is open. Replaces the legacy SHOW_SHARE_DIALOG event. */
  readonly shareDialogUrl: string | null

  readonly setEditor: (editor: monaco.editor.IStandaloneCodeEditor | undefined) => void
  readonly setToolOutput: (output: string) => void
  readonly setProgramOutput: (output: string) => void
  readonly toggleOutput: () => void
  readonly openShareDialog: (url: string) => void
  readonly closeShareDialog: () => void
}

export const usePlaygroundStore = create<PlaygroundState>(set => ({
  editor: undefined,
  toolOutput: '',
  programOutput: '',
  isOutputCollapsed: false,
  shareDialogUrl: null,

  setEditor: editor => set(state => state.editor === editor ? state : { editor }),
  setToolOutput: output => set(state => state.toolOutput === output ? state : { toolOutput: output }),
  setProgramOutput: output => set(state => state.programOutput === output ? state : { programOutput: output }),
  toggleOutput: () => set(state => ({ isOutputCollapsed: !state.isOutputCollapsed })),
  openShareDialog: url => set({ shareDialogUrl: url }),
  closeShareDialog: () => set(state => state.shareDialogUrl === null ? state : { shareDialogUrl: null }),
}))
