'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ActiveQuiz, ConceptStatus, EvidenceOutcome, LearnerModel } from '@/lib/ai/learner-model'
import { applyConceptStatus, applyEvidence, emptyLearner } from '@/lib/ai/learner-model'

interface LearnerState {
  readonly learner: LearnerModel
  readonly setKnownLanguages: (langs: readonly string[]) => void
  readonly setAgentNotesSummary: (text: string | undefined) => void
  readonly updateConceptStatus: (conceptId: string, status: ConceptStatus, notes?: string) => void
  readonly recordEvidence: (conceptId: string, outcome: EvidenceOutcome) => void
  readonly setActiveQuiz: (quiz: ActiveQuiz | null) => void
  readonly bumpQuizAttempts: () => void
  /** Imperative escape hatch for tools.ts to apply multi-field mutations atomically. */
  readonly mutate: (fn: (model: LearnerModel) => void) => LearnerModel
  readonly clear: () => void
}

/** Shallow-clone the learner so React sees a new reference after a mutation. */
function clone(m: LearnerModel): LearnerModel {
  return {
    ...m,
    concepts: { ...m.concepts },
    activeQuiz: m.activeQuiz ? { ...m.activeQuiz } : m.activeQuiz,
  }
}

export const useLearnerStore = create<LearnerState>()(
  persist(
    (set, get) => ({
      learner: emptyLearner(),
      setKnownLanguages: langs => set(state => ({
        learner: { ...state.learner, knownLanguages: Array.from(new Set(langs)) },
      })),
      setAgentNotesSummary: text => set(state => ({
        learner: {
          ...state.learner,
          agentNotesSummary: text && text.length > 0 ? text.slice(0, 300) : undefined,
        },
      })),
      updateConceptStatus: (conceptId, status, notes) => set((state) => {
        const next = clone(state.learner)
        applyConceptStatus(next, conceptId, status, notes)
        return { learner: next }
      }),
      recordEvidence: (conceptId, outcome) => set((state) => {
        const next = clone(state.learner)
        applyEvidence(next, conceptId, outcome)
        return { learner: next }
      }),
      setActiveQuiz: quiz => set(state => ({ learner: { ...state.learner, activeQuiz: quiz } })),
      bumpQuizAttempts: () => set((state) => {
        if (!state.learner.activeQuiz)
          return state
        return {
          learner: {
            ...state.learner,
            activeQuiz: { ...state.learner.activeQuiz, attempts: state.learner.activeQuiz.attempts + 1 },
          },
        }
      }),
      mutate: (fn) => {
        const next = clone(get().learner)
        fn(next)
        set({ learner: next })
        return next
      },
      clear: () => set({ learner: emptyLearner() }),
    }),
    {
      name: 'tour-ai:learner:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ learner: state.learner }),
    },
  ),
)

/** Read latest learner snapshot outside React (e.g. tools.ts). */
export function readLearner(): LearnerModel {
  return useLearnerStore.getState().learner
}
