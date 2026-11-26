'use client'

import type { ReactNode } from 'react'
import type { WorkspaceContextValue } from './workspace-context'
import { WorkspaceContext } from './workspace-context'

export interface WorkspaceProviderProps extends WorkspaceContextValue {
  children: ReactNode
}

/** Inject one already-opened AI Classroom runtime into all UI surfaces. */
export function WorkspaceProvider({
  lang,
  classroom,
  catalog,
  knowledge,
  runner,
  activeEditor,
  now,
  storage,
  storageScope,
  courseVersion,
  children,
}: WorkspaceProviderProps) {
  return (
    <WorkspaceContext value={{
      lang,
      classroom,
      catalog,
      knowledge,
      runner,
      activeEditor,
      now,
      storage,
      storageScope,
      courseVersion,
    }}
    >
      {children}
    </WorkspaceContext>
  )
}
