'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ExerciseDraft {
  /** Latest editor content the learner has typed for this exercise. */
  code: string
  /** Wall-clock ms, lets us drop ancient drafts if we ever want to. */
  updatedAt: number
}

interface ExerciseDraftStore {
  drafts: Record<string, ExerciseDraft>
  setDraft: (exerciseId: string, code: string) => void
  getDraft: (exerciseId: string) => ExerciseDraft | undefined
  clearDraft: (exerciseId: string) => void
  clearAll: () => void
}

// Per-exercise user draft. Decouples "what the learner is currently writing" from
// React component lifecycle, so AI tools and other readers can always answer
// "show me the learner's code for exercise X" — even if the exercise card is no longer
// mounted (scrolled out of view), Monaco was torn down, or the page was just
// reloaded.
//
// Monaco itself preserves the in-memory model across React unmounts (see
// createStandaloneEditorHandle's existingModel branch), but those models die
// with the page. Persisting drafts in localStorage closes that gap so a
// learner who refreshes mid-attempt doesn't lose their work.
export const useExerciseDraftStore = create<ExerciseDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      setDraft: (exerciseId, code) =>
        set((state) => {
          const existing = state.drafts[exerciseId]
          if (existing && existing.code === code)
            return state
          return {
            drafts: {
              ...state.drafts,
              [exerciseId]: { code, updatedAt: Date.now() },
            },
          }
        }),
      getDraft: exerciseId => get().drafts[exerciseId],
      clearDraft: exerciseId =>
        set((state) => {
          if (!(exerciseId in state.drafts))
            return state
          const next = { ...state.drafts }
          delete next[exerciseId]
          return { drafts: next }
        }),
      clearAll: () =>
        set((state) => {
          if (Object.keys(state.drafts).length === 0)
            return state
          return { drafts: {} }
        }),
    }),
    {
      name: 'tour-ai:exercise-drafts',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ drafts: state.drafts }),
    },
  ),
)
