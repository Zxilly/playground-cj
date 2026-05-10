'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useDarkMode } from '@/lib/theme/useDarkMode'
import { readString, writeString } from '@/lib/storage'

export type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'classroom-theme-mode'

function isThemeMode(value: string): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

interface ClassroomThemeValue {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  resolved: 'light' | 'dark'
}

const ClassroomThemeContext = createContext<ClassroomThemeValue | null>(null)

export function ClassroomThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = readString(STORAGE_KEY, 'auto')
    return isThemeMode(stored) ? stored : 'auto'
  })
  const systemDark = useDarkMode()
  const resolved: 'light' | 'dark' = mode === 'auto'
    ? (systemDark ? 'dark' : 'light')
    : mode

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    writeString(STORAGE_KEY, next)
  }, [])

  const value = useMemo<ClassroomThemeValue>(() => ({ mode, setMode, resolved }), [mode, setMode, resolved])
  return <ClassroomThemeContext.Provider value={value}>{children}</ClassroomThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomTheme(): ClassroomThemeValue {
  const ctx = useContext(ClassroomThemeContext)
  if (!ctx)
    throw new Error('useClassroomTheme must be used inside ClassroomThemeProvider')
  return ctx
}
