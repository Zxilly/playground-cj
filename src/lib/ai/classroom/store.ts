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
  now?: number
}

export interface ClassroomStoreState {
  session: ClassroomSession
  dispatch: (action: ClassroomAction) => void
  reset: (now?: number) => void
}

export function createClassroomStore({ lang, now }: ClassroomStoreOptions) {
  return createStore<ClassroomStoreState>((set) => {
    const initial = createInitialClassroomSession({ lang, now })

    return {
      session: initial,
      dispatch: action => set(state => ({
        session: classroomReducer(state.session, action),
      })),
      reset: resetNow => set({
        session: createInitialClassroomSession({ lang, now: resetNow }),
      }),
    }
  })
}
