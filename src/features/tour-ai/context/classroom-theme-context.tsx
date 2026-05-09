'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useDarkMode } from '@/lib/theme/useDarkMode'

export type ThemeMode = 'auto' | 'light' | 'dark'

interface ClassroomThemeValue {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  resolved: 'light' | 'dark'
}

const ClassroomThemeContext = createContext<ClassroomThemeValue | null>(null)

export function ClassroomThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const systemDark = useDarkMode()
  const resolved: 'light' | 'dark' = mode === 'auto'
    ? (systemDark ? 'dark' : 'light')
    : mode
  const value = useMemo<ClassroomThemeValue>(() => ({ mode, setMode, resolved }), [mode, resolved])
  return <ClassroomThemeContext.Provider value={value}>{children}</ClassroomThemeContext.Provider>
}

export function useClassroomTheme(): ClassroomThemeValue {
  const ctx = useContext(ClassroomThemeContext)
  if (!ctx)
    throw new Error('useClassroomTheme must be used inside ClassroomThemeProvider')
  return ctx
}
