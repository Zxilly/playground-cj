'use client'

import { createStore } from 'zustand/vanilla'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import type { ClassroomAction } from './reducer'
import type { ClassroomSession } from './types'

export const CLASSROOM_STORAGE_PREFIX = 'tour-ai:classroom:v1'

export function classroomStorageKey(lang: string): string {
  return `${CLASSROOM_STORAGE_PREFIX}:${lang}`
}

interface ClassroomStoreOptions {
  lang: string
}

export interface ClassroomStoreState {
  session: ClassroomSession
  dispatch: (action: ClassroomAction) => void
  reset: () => void
}

export function createClassroomStore({ lang }: ClassroomStoreOptions) {
  return createStore<ClassroomStoreState>((set) => {
    const initial = createInitialClassroomSession({ lang })
    return {
      session: initial,
      dispatch: action => set((state) => {
        const next = classroomReducer(state.session, action)
        return next === state.session ? state : { session: next }
      }),
      reset: () => set({ session: createInitialClassroomSession({ lang }) }),
    }
  })
}
