/* eslint-disable react-refresh/only-export-components */
'use client'

import { createContext, use, useCallback, useState } from 'react'
import { readString, writeString } from '@/lib/storage'

export type TourMode = 'tutorial' | 'ai'

interface TourModeContextValue {
  mode: TourMode
  setMode: (mode: TourMode) => void
}

const TourModeContext = createContext<TourModeContextValue | null>(null)

const STORAGE_KEY = 'tour-mode'

function readInitial(): TourMode {
  return readString(STORAGE_KEY, 'tutorial') === 'ai' ? 'ai' : 'tutorial'
}

export function TourModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<TourMode>(readInitial)

  const setModeAndPersist = useCallback((next: TourMode) => {
    writeString(STORAGE_KEY, next)
    setMode(next)
  }, [])

  return (
    <TourModeContext value={{ mode, setMode: setModeAndPersist }}>
      {children}
    </TourModeContext>
  )
}

export function useTourMode(): TourModeContextValue {
  const ctx = use(TourModeContext)
  if (!ctx)
    throw new Error('useTourMode must be used within <TourModeProvider>')
  return ctx
}
