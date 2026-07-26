'use client'

import { create } from 'zustand'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import type { RunnerTruncationState } from '@/lib/runner-contract'

export type TourOutputTab = 'program' | 'tool'

interface TourEditorState {
  /** Code shown when the section first mounted; used by reset / reset_editor_to_initial. */
  readonly initialCode: string
  readonly compilerOutput: string
  readonly programOutput: string
  readonly truncation: RunnerTruncationState
  readonly activeTab: TourOutputTab

  readonly setInitialCode: (code: string) => void
  /** Used by CodeRunner to push the latest tool/compiler output into the panel. Auto-flips tab. */
  readonly setCompilerOutput: (output: string) => void
  /** Used by CodeRunner to push the latest program output. Auto-flips tab if non-empty. */
  readonly setProgramOutput: (output: string) => void
  readonly setTruncation: (truncation: RunnerTruncationState) => void
  /** Atomic dual-write used by tools.ts after a remote run. Bypasses tab auto-flip. */
  readonly setLatestOutput: (next: { compilerOutput: string, programOutput: string }) => void
  readonly setActiveTab: (tab: TourOutputTab) => void
  readonly resetOutputs: () => void
}

export const useTourEditorStore = create<TourEditorState>(set => ({
  initialCode: '',
  compilerOutput: '',
  programOutput: '',
  truncation: NO_RUNNER_TRUNCATION,
  activeTab: 'program',

  setInitialCode: code => set(state => state.initialCode === code ? state : { initialCode: code }),

  setCompilerOutput: output => set((state) => {
    if (state.compilerOutput === output)
      return state
    const activeTab = output && !state.programOutput ? 'tool' : state.activeTab
    return { compilerOutput: output, activeTab }
  }),

  setProgramOutput: output => set((state) => {
    if (state.programOutput === output)
      return state
    const activeTab: TourOutputTab = output ? 'program' : state.activeTab
    return { programOutput: output, activeTab }
  }),
  setTruncation: truncation => set({ truncation }),

  setLatestOutput: ({ compilerOutput, programOutput }) => set((state) => {
    if (state.compilerOutput === compilerOutput && state.programOutput === programOutput)
      return state
    return { compilerOutput, programOutput }
  }),

  setActiveTab: tab => set(state => state.activeTab === tab ? state : { activeTab: tab }),

  resetOutputs: () => set((state) => {
    if (
      !state.compilerOutput
      && !state.programOutput
      && state.activeTab === 'program'
      && Object.values(state.truncation).every(value => !value)
    ) {
      return state
    }
    return {
      compilerOutput: '',
      programOutput: '',
      truncation: NO_RUNNER_TRUNCATION,
      activeTab: 'program',
    }
  }),
}))
