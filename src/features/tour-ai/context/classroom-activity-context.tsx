'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ClassroomActivity } from '@/lib/ai/classroom/selectors'

export interface ClassroomActivityValue {
  activity: ClassroomActivity
  setGenerationRunning: (running: boolean) => void
  setRunnerRunning: (running: boolean) => void
  beginGenerationRun: (id: string) => void
  endGenerationRun: (id: string) => void
  beginRunnerRun: (id: string) => void
  endRunnerRun: (id: string) => void
}

const ClassroomActivityContext = createContext<ClassroomActivityValue | null>(null)

interface ClassroomActivityState extends ClassroomActivity {
  generationRunId: string | null
  runnerRunId: string | null
}

export function ClassroomActivityProvider({ children }: { children: ReactNode }) {
  const [activityState, setActivityState] = useState<ClassroomActivityState>({
    generationRunning: false,
    runnerRunning: false,
    generationRunId: null,
    runnerRunId: null,
  })
  const activity = useMemo<ClassroomActivity>(() => ({
    generationRunning: activityState.generationRunning,
    runnerRunning: activityState.runnerRunning,
  }), [activityState.generationRunning, activityState.runnerRunning])

  const setGenerationRunning = useCallback((running: boolean) => {
    setActivityState(prev =>
      prev.generationRunning === running
        ? prev
        : {
            ...prev,
            generationRunning: running,
            generationRunId: running ? '__legacy_generation__' : null,
          })
  }, [])

  const setRunnerRunning = useCallback((running: boolean) => {
    setActivityState(prev =>
      prev.runnerRunning === running
        ? prev
        : {
            ...prev,
            runnerRunning: running,
            runnerRunId: running ? '__legacy_runner__' : null,
          })
  }, [])

  const beginGenerationRun = useCallback((id: string) => {
    setActivityState(prev => prev.generationRunId === id ? prev : { ...prev, generationRunning: true, generationRunId: id })
  }, [])

  const endGenerationRun = useCallback((id: string) => {
    setActivityState(prev => prev.generationRunId === id ? { ...prev, generationRunning: false, generationRunId: null } : prev)
  }, [])

  const beginRunnerRun = useCallback((id: string) => {
    setActivityState(prev => prev.runnerRunId === id ? prev : { ...prev, runnerRunning: true, runnerRunId: id })
  }, [])

  const endRunnerRun = useCallback((id: string) => {
    setActivityState(prev => prev.runnerRunId === id ? { ...prev, runnerRunning: false, runnerRunId: null } : prev)
  }, [])

  const value = useMemo<ClassroomActivityValue>(
    () => ({
      activity,
      setGenerationRunning,
      setRunnerRunning,
      beginGenerationRun,
      endGenerationRun,
      beginRunnerRun,
      endRunnerRun,
    }),
    [
      activity,
      setGenerationRunning,
      setRunnerRunning,
      beginGenerationRun,
      endGenerationRun,
      beginRunnerRun,
      endRunnerRun,
    ],
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
