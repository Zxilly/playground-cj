'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'

const LEGACY_THEME_STORAGE_KEY = 'classroom-theme-mode'
const THEME_STORAGE_KEY = 'theme'

function LegacyThemeMigrator() {
  const { setTheme } = useTheme()

  useEffect(() => {
    try {
      const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
      if (!legacy)
        return

      const existing = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (!existing) {
        if (legacy === 'dark' || legacy === 'light')
          setTheme(legacy)
        else if (legacy === 'auto')
          setTheme('system')
      }

      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
    }
    catch {
      // Ignore storage access failures (e.g. private browsing restrictions).
    }
  }, [setTheme])

  return null
}

export interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Single source of truth for site-wide light/dark/system theme state.
 * Drives the root `<html>` `.dark` class and `color-scheme`, and migrates
 * any legacy `classroom-theme-mode` preference once on mount.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LegacyThemeMigrator />
      {children}
    </NextThemesProvider>
  )
}
