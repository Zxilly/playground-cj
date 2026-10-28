'use client'

import { create } from 'zustand'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import type { RunnerTruncationState } from '@/lib/runner-contract'
import type { RunResult } from '@/lib/runner'

interface PlaygroundState {
  /** Monaco editor instance — transient. Read via `getState().editor` in callbacks; do not subscribe in render. */
  readonly editor: monaco.editor.IStandaloneCodeEditor | undefined
  readonly toolOutput: string
  readonly programOutput: string
  readonly truncation: RunnerTruncationState
  readonly runResult: RunResult | null
  readonly running: boolean
  readonly isOutputCollapsed: boolean
  readonly mobileView: 'code' | 'output'
  /** Non-null while the share dialog is open. Replaces the legacy SHOW_SHARE_DIALOG event. */
  readonly shareDialogUrl: string | null

  readonly setEditor: (editor: monaco.editor.IStandaloneCodeEditor | undefined) => void
  readonly setToolOutput: (output: string) => void
  readonly setProgramOutput: (output: string) => void
  readonly setTruncation: (truncation: RunnerTruncationState) => void
  readonly setRunResult: (result: RunResult | null) => void
  readonly setRunning: (running: boolean) => void
  readonly toggleOutput: () => void
  readonly setMobileView: (view: 'code' | 'output') => void
  readonly openShareDialog: (url: string) => void
  readonly closeShareDialog: () => void
}

export const usePlaygroundStore = create<PlaygroundState>(set => ({
  editor: undefined,
  toolOutput: '',
  programOutput: '',
  truncation: NO_RUNNER_TRUNCATION,
  runResult: null,
  running: false,
  isOutputCollapsed: false,
  mobileView: 'code',
  shareDialogUrl: null,

  setEditor: editor => set(state => state.editor === editor ? state : { editor }),
  setToolOutput: output => set(state => state.toolOutput === output ? state : { toolOutput: output }),
  setProgramOutput: output => set(state => state.programOutput === output ? state : { programOutput: output }),
  setTruncation: truncation => set({ truncation }),
  setRunResult: runResult => set(runResult ? { runResult, mobileView: 'output' } : { runResult }),
  setRunning: running => set({ running }),
  toggleOutput: () => set(state => ({ isOutputCollapsed: !state.isOutputCollapsed })),
  setMobileView: mobileView => set({ mobileView }),
  openShareDialog: url => set({ shareDialogUrl: url }),
  closeShareDialog: () => set(state => state.shareDialogUrl === null ? state : { shareDialogUrl: null }),
}))
