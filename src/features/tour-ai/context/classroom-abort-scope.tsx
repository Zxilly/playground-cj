'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

const ClassroomAbortScopeContext = createContext<AbortSignal | null>(null)

export function ClassroomAbortScopeProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<AbortController | null>(null)
  if (!controllerRef.current)
    controllerRef.current = new AbortController()

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  return (
    <ClassroomAbortScopeContext.Provider value={controllerRef.current.signal}>
      {children}
    </ClassroomAbortScopeContext.Provider>
  )
}

export function useClassroomAbortScope(): AbortSignal {
  const signal = useContext(ClassroomAbortScopeContext)
  if (!signal)
    throw new Error('useClassroomAbortScope must be used inside <ClassroomAbortScopeProvider>')
  return signal
}
