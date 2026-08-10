'use client'

import type { StoreApi, UseBoundStore } from 'zustand'
import { create } from 'zustand'

export type WorkspaceView = 'live' | 'review' | 'progress' | 'playground'
export type TeacherChatRunMode = 'live' | 'review'
export interface WorkspacePrefillIntent {
  type: 'first_lesson'
  learningTrackId: string
}
export interface WorkspaceStore {
  view: WorkspaceView
  reviewConceptId: string | null
  pendingPrefill: string | null
  pendingPrefillIntent: WorkspacePrefillIntent | null
  prefillRevision: number
  cancelledDraft: string | null
  teacherChatRunMode: TeacherChatRunMode | null
  setView: (view: WorkspaceView) => void
  openReviewConcept: (conceptId: string) => void
  setPendingPrefill: (
    prompt: string,
    intent?: WorkspacePrefillIntent,
  ) => void
  setCancelledDraft: (prompt: string) => void
  clearComposerDraft: () => void
  setTeacherChatRunMode: (mode: TeacherChatRunMode | null) => void
  consumePrefill: () => string | null
  reset: () => void
}

export function createWorkspaceStore(
): UseBoundStore<StoreApi<WorkspaceStore>> {
  const store = create<WorkspaceStore>()((set, get) => ({
    view: 'live',
    reviewConceptId: null,
    pendingPrefill: null,
    pendingPrefillIntent: null,
    prefillRevision: 0,
    cancelledDraft: null,
    teacherChatRunMode: null,
    setView: view => set(state => ({
      view,
      ...((state.view === 'review') !== (view === 'review')
        ? {
            pendingPrefill: null,
            pendingPrefillIntent: null,
            cancelledDraft: null,
          }
        : {}),
    })),
    openReviewConcept: conceptId => set(state => ({
      view: 'review',
      reviewConceptId: conceptId,
      ...(state.view !== 'review' || state.reviewConceptId !== conceptId
        ? {
            pendingPrefill: null,
            pendingPrefillIntent: null,
            cancelledDraft: null,
          }
        : {}),
    })),
    setPendingPrefill: (prompt, intent) => set(state => ({
      pendingPrefill: prompt,
      pendingPrefillIntent: intent ?? null,
      prefillRevision: state.prefillRevision + 1,
      cancelledDraft: null,
    })),
    setCancelledDraft: prompt => set({
      pendingPrefill: null,
      pendingPrefillIntent: null,
      cancelledDraft: prompt,
    }),
    clearComposerDraft: () => set({
      pendingPrefill: null,
      pendingPrefillIntent: null,
      cancelledDraft: null,
    }),
    setTeacherChatRunMode: teacherChatRunMode => set({ teacherChatRunMode }),
    consumePrefill: () => {
      const prompt = get().pendingPrefill
      if (prompt !== null)
        set({ pendingPrefill: null, pendingPrefillIntent: null })
      return prompt
    },
    reset: () => set({
      view: 'live',
      reviewConceptId: null,
      pendingPrefill: null,
      pendingPrefillIntent: null,
      prefillRevision: 0,
      cancelledDraft: null,
      teacherChatRunMode: null,
    }),
  }))

  return store
}

export const useWorkspaceStore = createWorkspaceStore()
