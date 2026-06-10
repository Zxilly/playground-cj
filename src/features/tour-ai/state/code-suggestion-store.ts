'use client'

import { create } from 'zustand'
import { createCodeSuggestionAssistance } from '@/lib/ai/classroom/exercise-attempt-evidence'
import type { ExerciseAttemptAssistance, ExerciseAttemptEvidenceInput } from '@/lib/ai/classroom/exercise-attempt-evidence'

export interface CodeSuggestion {
  /** Exercise the suggestion belongs to. Cleared when the active exercise changes. */
  exerciseId: string
  /** Replacement source the agent proposes. */
  code: string
  /** One-paragraph explanation shown alongside the diff. */
  explanation: string
  createdAt: number
}

interface CodeSuggestionStore {
  suggestion: CodeSuggestion | null
  appliedAssistanceByExerciseId: Record<string, ExerciseAttemptAssistance[]>
  setSuggestion: (suggestion: CodeSuggestion | null) => void
  markSuggestionApplied: (exerciseId: string, appliedAt: number) => void
  removeAppliedSuggestion: (exerciseId: string, appliedAt: number) => void
  getAttemptEvidence: (exerciseId: string) => ExerciseAttemptEvidenceInput | undefined
  clearAttemptEvidenceForExercise: (exerciseId: string) => void
  clearForExercise: (exerciseId: string) => void
  clearAll: () => void
}

// Single-slot ephemeral store for "AI suggests this code, click Apply to use"
// patches. Lives outside ClassroomSession because:
//   - Suggestions are chat-driven and tied to the active editor session, not
//     to the persistent learning record.
//   - They should NOT survive page reload — a stale suggestion against code
//     that has since been edited would be misleading.
// Zustand keeps it out of the React tree so chat tools can call setSuggestion
// without prop-drilling four levels through the classroom shell.
export const useCodeSuggestionStore = create<CodeSuggestionStore>((set, get) => ({
  suggestion: null,
  appliedAssistanceByExerciseId: {},
  setSuggestion: suggestion => set({ suggestion }),
  markSuggestionApplied: (exerciseId, appliedAt) => set((state) => {
    const assistance = state.appliedAssistanceByExerciseId[exerciseId] ?? []
    return {
      appliedAssistanceByExerciseId: {
        ...state.appliedAssistanceByExerciseId,
        [exerciseId]: [
          ...assistance,
          createCodeSuggestionAssistance(appliedAt),
        ],
      },
    }
  }),
  removeAppliedSuggestion: (exerciseId, appliedAt) => set((state) => {
    const assistance = state.appliedAssistanceByExerciseId[exerciseId]
    if (!assistance)
      return state

    const nextAssistance = assistance.filter(item => !(item.kind === 'code_suggestion' && item.appliedAt === appliedAt))
    if (nextAssistance.length === assistance.length)
      return state

    const next = { ...state.appliedAssistanceByExerciseId }
    if (nextAssistance.length > 0)
      next[exerciseId] = nextAssistance
    else
      delete next[exerciseId]

    return { appliedAssistanceByExerciseId: next }
  }),
  getAttemptEvidence: (exerciseId) => {
    const assistance = get().appliedAssistanceByExerciseId[exerciseId]
    return assistance && assistance.length > 0 ? { assistance } : undefined
  },
  clearAttemptEvidenceForExercise: exerciseId => set((state) => {
    if (!(exerciseId in state.appliedAssistanceByExerciseId))
      return state
    const next = { ...state.appliedAssistanceByExerciseId }
    delete next[exerciseId]
    return { appliedAssistanceByExerciseId: next }
  }),
  clearForExercise: exerciseId => set((state) => {
    const next: Partial<Pick<CodeSuggestionStore, 'suggestion' | 'appliedAssistanceByExerciseId'>> = {}
    if (state.suggestion?.exerciseId === exerciseId)
      next.suggestion = null
    if (exerciseId in state.appliedAssistanceByExerciseId) {
      next.appliedAssistanceByExerciseId = { ...state.appliedAssistanceByExerciseId }
      delete next.appliedAssistanceByExerciseId[exerciseId]
    }
    return Object.keys(next).length > 0 ? next : state
  }),
  clearAll: () => set((state) => {
    if (state.suggestion == null && Object.keys(state.appliedAssistanceByExerciseId).length === 0)
      return state
    return {
      suggestion: null,
      appliedAssistanceByExerciseId: {},
    }
  }),
}))
