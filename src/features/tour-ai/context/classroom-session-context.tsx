'use client'

import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { ClassroomSessionHydrationIssue, ClassroomSessionSaveIssue } from '@/lib/ai/classroom/use-persistent-session'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'

export interface ClassroomSessionContextValue {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  hydrationIssue: ClassroomSessionHydrationIssue | null
  saveIssue: ClassroomSessionSaveIssue | null
  retrySave: () => Promise<void> | void
  resetSession: () => void
  annotationState: EditorAnnotationState
}

const ClassroomSessionContext = createContext<ClassroomSessionContextValue | null>(null)

export function ClassroomSessionProvider({
  value,
  children,
}: {
  value: ClassroomSessionContextValue
  children: ReactNode
}) {
  return <ClassroomSessionContext value={value}>{children}</ClassroomSessionContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomSession(): ClassroomSessionContextValue {
  const ctx = use(ClassroomSessionContext)
  if (!ctx)
    throw new Error('useClassroomSession must be used inside ClassroomSessionProvider')
  return ctx
}
