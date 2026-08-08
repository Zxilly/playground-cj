'use client'

import type { StoreApi, UseBoundStore } from 'zustand'
import { create } from 'zustand'

export type WorkspaceView = 'live' | 'review' | 'progress' | 'playground'
export interface WorkspaceStore {
  view: WorkspaceView
  reviewConceptId: string | null
  pendingPrefill: string | null
  setView: (view: WorkspaceView) => void
  openReviewConcept: (conceptId: string) => void
  setPendingPrefill: (prompt: string) => void
  consumePrefill: () => string | null
  reset: () => void
}

export function createWorkspaceStore(
): UseBoundStore<StoreApi<WorkspaceStore>> {
  const store = create<WorkspaceStore>()((set, get) => ({
    view: 'live',
    reviewConceptId: null,
    pendingPrefill: null,
    setView: view => set({ view }),
    openReviewConcept: conceptId => set({
      view: 'review',
      reviewConceptId: conceptId,
    }),
    setPendingPrefill: prompt => set({ pendingPrefill: prompt }),
    consumePrefill: () => {
      const prompt = get().pendingPrefill
      if (prompt !== null)
        set({ pendingPrefill: null })
      return prompt
    },
    reset: () => set({
      view: 'live',
      reviewConceptId: null,
      pendingPrefill: null,
    }),
  }))

  return store
}

export const useWorkspaceStore = createWorkspaceStore()
