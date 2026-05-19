'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface QuizDraft {
  /** Latest editor content the learner has typed for this quiz. */
  code: string
  /** Wall-clock ms, lets us drop ancient drafts if we ever want to. */
  updatedAt: number
}

interface QuizDraftStore {
  drafts: Record<string, QuizDraft>
  setDraft: (quizId: string, code: string) => void
  getDraft: (quizId: string) => QuizDraft | undefined
  clearDraft: (quizId: string) => void
}

// Per-quiz user draft. Decouples "what the learner is currently writing" from
// React component lifecycle, so AI tools and other readers can always answer
// "show me the learner's code for quiz X" — even if the quiz card is no longer
// mounted (scrolled out of view), Monaco was torn down, or the page was just
// reloaded.
//
// Monaco itself preserves the in-memory model across React unmounts (see
// createStandaloneEditorHandle's existingModel branch), but those models die
// with the page. Persisting drafts in localStorage closes that gap so a
// learner who refreshes mid-attempt doesn't lose their work.
export const useQuizDraftStore = create<QuizDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      setDraft: (quizId, code) =>
        set((state) => {
          const existing = state.drafts[quizId]
          if (existing && existing.code === code)
            return state
          return {
            drafts: {
              ...state.drafts,
              [quizId]: { code, updatedAt: Date.now() },
            },
          }
        }),
      getDraft: quizId => get().drafts[quizId],
      clearDraft: quizId =>
        set((state) => {
          if (!(quizId in state.drafts))
            return state
          const next = { ...state.drafts }
          delete next[quizId]
          return { drafts: next }
        }),
    }),
    {
      name: 'tour-ai:quiz-drafts',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ drafts: state.drafts }),
    },
  ),
)
