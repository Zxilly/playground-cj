'use client'

import { create } from 'zustand'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import type { RunnerTruncationState } from '@/lib/runner-contract'
import type { RunResult } from '@/lib/runner'

export const PLAYGROUND_DRAFT_STORAGE_KEY = 'cj-playground:draft:v1'

export type PlaygroundCodeOrigin = 'example' | 'draft' | 'shared' | 'custom'

export function loadPlaygroundDraft(): string | undefined {
  if (typeof window === 'undefined')
    return undefined
  try {
    const stored = window.localStorage.getItem(PLAYGROUND_DRAFT_STORAGE_KEY)
    return stored !== null ? stored : undefined
  }
  catch {
    return undefined
  }
}

export function savePlaygroundDraft(code: string): boolean {
  if (typeof window === 'undefined')
    return false
  try {
    window.localStorage.setItem(PLAYGROUND_DRAFT_STORAGE_KEY, code)
    return true
  }
  catch {
    return false
  }
}

export function clearPlaygroundDraft(): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage.removeItem(PLAYGROUND_DRAFT_STORAGE_KEY)
  }
  catch {
    // Ignore storage access failures (e.g. private mode).
  }
}

interface PlaygroundState {
  /** Monaco editor instance — transient. Read via `getState().editor` in callbacks; do not subscribe in render. */
  readonly editor: monaco.editor.IStandaloneCodeEditor | undefined
  readonly editorError: Error | null
  readonly toolOutput: string
  readonly programOutput: string
  readonly truncation: RunnerTruncationState
  readonly runResult: RunResult | null
  readonly running: boolean
  readonly cancelRun: (() => void) | null
  readonly stdin: string
  readonly selectedExampleKey: string | null
  readonly selectedExampleName: string | null
  readonly codeOrigin: PlaygroundCodeOrigin
  readonly mobileView: 'code' | 'output'
  /** Non-null while the share dialog is open. Replaces the legacy SHOW_SHARE_DIALOG event. */
  readonly shareDialogUrl: string | null

  readonly setEditor: (editor: monaco.editor.IStandaloneCodeEditor | undefined) => void
  readonly setEditorError: (error: Error | null) => void
  readonly setToolOutput: (output: string) => void
  readonly setProgramOutput: (output: string) => void
  readonly setTruncation: (truncation: RunnerTruncationState) => void
  readonly setRunResult: (result: RunResult | null) => void
  readonly setRunning: (running: boolean) => void
  readonly setCancelRun: (cancel: (() => void) | null) => void
  readonly setStdin: (stdin: string) => void
  readonly setExampleSelection: (
    key: string | null,
    name: string | null,
    origin?: PlaygroundCodeOrigin,
  ) => void
  readonly resetOutputs: () => void
  readonly setMobileView: (view: 'code' | 'output') => void
  readonly openShareDialog: (url: string) => void
  readonly closeShareDialog: () => void
}

export const usePlaygroundStore = create<PlaygroundState>(set => ({
  editor: undefined,
  editorError: null,
  toolOutput: '',
  programOutput: '',
  truncation: NO_RUNNER_TRUNCATION,
  runResult: null,
  running: false,
  cancelRun: null,
  stdin: '',
  selectedExampleKey: 'hello-world',
  selectedExampleName: 'Hello World',
  codeOrigin: 'example',
  mobileView: 'code',
  shareDialogUrl: null,

  setEditor: editor => set(state => state.editor === editor ? state : { editor }),
  setEditorError: editorError => set(state => state.editorError === editorError ? state : { editorError }),
  setToolOutput: output => set(state => state.toolOutput === output ? state : { toolOutput: output }),
  setProgramOutput: output => set(state => state.programOutput === output ? state : { programOutput: output }),
  setTruncation: truncation => set({ truncation }),
  setRunResult: runResult => set(runResult ? { runResult, mobileView: 'output' } : { runResult }),
  setRunning: running => set({ running }),
  setCancelRun: cancelRun => set(state => state.cancelRun === cancelRun ? state : { cancelRun }),
  setStdin: stdin => set(state => state.stdin === stdin ? state : { stdin }),
  setExampleSelection: (selectedExampleKey, selectedExampleName, codeOrigin = selectedExampleKey ? 'example' : 'custom') =>
    set(state => (
      state.selectedExampleKey === selectedExampleKey
      && state.selectedExampleName === selectedExampleName
      && state.codeOrigin === codeOrigin
        ? state
        : { selectedExampleKey, selectedExampleName, codeOrigin }
    )),
  resetOutputs: () => set({
    toolOutput: '',
    programOutput: '',
    truncation: NO_RUNNER_TRUNCATION,
    runResult: null,
  }),
  setMobileView: mobileView => set({ mobileView }),
  openShareDialog: url => set({ shareDialogUrl: url }),
  closeShareDialog: () => set(state => state.shareDialogUrl === null ? state : { shareDialogUrl: null }),
}))
