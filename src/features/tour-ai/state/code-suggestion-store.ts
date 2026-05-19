'use client'

import { create } from 'zustand'

export interface CodeSuggestion {
  /** Quiz the suggestion belongs to. Cleared when the active quiz changes. */
  quizId: string
  /** Replacement source the agent proposes. */
  code: string
  /** One-paragraph explanation shown alongside the diff. */
  explanation: string
  createdAt: number
}

interface CodeSuggestionStore {
  suggestion: CodeSuggestion | null
  setSuggestion: (suggestion: CodeSuggestion | null) => void
  clearForQuiz: (quizId: string) => void
}

// Single-slot ephemeral store for "AI suggests this code, click Apply to use"
// patches. Lives outside ClassroomSession because:
//   - Suggestions are chat-driven and tied to the active editor session, not
//     to the persistent learning record.
//   - They should NOT survive page reload — a stale suggestion against code
//     that has since been edited would be misleading.
// Zustand keeps it out of the React tree so chat tools can call setSuggestion
// without prop-drilling four levels through the classroom shell.
export const useCodeSuggestionStore = create<CodeSuggestionStore>(set => ({
  suggestion: null,
  setSuggestion: suggestion => set({ suggestion }),
  clearForQuiz: quizId => set((state) => {
    if (state.suggestion?.quizId === quizId)
      return { suggestion: null }
    return state
  }),
}))
