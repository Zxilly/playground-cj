'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'

export interface ClassroomSessionContextValue {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
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
  return <ClassroomSessionContext.Provider value={value}>{children}</ClassroomSessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomSession(): ClassroomSessionContextValue {
  const ctx = useContext(ClassroomSessionContext)
  if (!ctx)
    throw new Error('useClassroomSession must be used inside ClassroomSessionProvider')
  return ctx
}
