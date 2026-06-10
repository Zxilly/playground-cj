'use client'

import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const ClassroomAbortScopeContext = createContext<AbortSignal | null>(null)

export function ClassroomAbortScopeProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new AbortController())

  useEffect(() => {
    return () => {
      controller.abort()
    }
  }, [controller])

  return (
    <ClassroomAbortScopeContext value={controller.signal}>
      {children}
    </ClassroomAbortScopeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomAbortScope(): AbortSignal {
  const signal = use(ClassroomAbortScopeContext)
  if (!signal)
    throw new Error('useClassroomAbortScope must be used inside <ClassroomAbortScopeProvider>')
  return signal
}
