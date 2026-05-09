'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ClassroomActivity } from '@/lib/ai/classroom/selectors'

export interface ClassroomActivityValue {
  activity: ClassroomActivity
  setGenerationRunning: (running: boolean) => void
  setRunnerRunning: (running: boolean) => void
}

const ClassroomActivityContext = createContext<ClassroomActivityValue | null>(null)

export function ClassroomActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<ClassroomActivity>({
    generationRunning: false,
    runnerRunning: false,
  })

  const setGenerationRunning = useCallback((running: boolean) => {
    setActivity(prev => prev.generationRunning === running ? prev : { ...prev, generationRunning: running })
  }, [])

  const setRunnerRunning = useCallback((running: boolean) => {
    setActivity(prev => prev.runnerRunning === running ? prev : { ...prev, runnerRunning: running })
  }, [])

  const value = useMemo<ClassroomActivityValue>(
    () => ({ activity, setGenerationRunning, setRunnerRunning }),
    [activity, setGenerationRunning, setRunnerRunning],
  )

  return (
    <ClassroomActivityContext.Provider value={value}>
      {children}
    </ClassroomActivityContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomActivity(): ClassroomActivityValue {
  const value = useContext(ClassroomActivityContext)
  if (!value)
    throw new Error('useClassroomActivity must be used inside <ClassroomActivityProvider>')
  return value
}
