'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'tour-known-languages'
const ALL_LANGUAGES = ['c', 'java', 'go', 'rust'] as const
type Language = typeof ALL_LANGUAGES[number]

interface KnownLanguagesContextValue {
  knownLanguages: Set<Language>
  toggleLanguage: (lang: Language) => void
  allLanguages: readonly Language[]
}

const KnownLanguagesContext = createContext<KnownLanguagesContextValue | null>(null)

export function KnownLanguagesProvider({ children }: { children: ReactNode }) {
  const [knownLanguages, setKnownLanguages] = useState<Set<Language>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        setKnownLanguages(new Set(parsed.filter(l => ALL_LANGUAGES.includes(l as Language)) as Language[]))
      }
    } catch {}
  }, [])

  const toggleLanguage = useCallback((lang: Language) => {
    setKnownLanguages(prev => {
      const next = new Set(prev)
      if (next.has(lang)) next.delete(lang)
      else next.add(lang)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  return (
    <KnownLanguagesContext.Provider value={{ knownLanguages, toggleLanguage, allLanguages: ALL_LANGUAGES }}>
      {children}
    </KnownLanguagesContext.Provider>
  )
}

export function useKnownLanguages() {
  const ctx = useContext(KnownLanguagesContext)
  if (!ctx) throw new Error('useKnownLanguages must be used within KnownLanguagesProvider')
  return ctx
}
