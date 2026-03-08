'use client'

import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import type { Language } from './knownLanguages'
import {
  ALL_LANGUAGES,
  KnownLanguagesContext,
  persistKnownLanguages,
  readStoredKnownLanguages,
} from './knownLanguages'

export function KnownLanguagesProvider({ children }: { children: ReactNode }) {
  const [knownLanguages, setKnownLanguages] = useState<Set<Language>>(() => readStoredKnownLanguages())

  const toggleLanguage = useCallback((lang: Language) => {
    setKnownLanguages((prev) => {
      const next = new Set(prev)
      if (next.has(lang))
        next.delete(lang)
      else next.add(lang)
      persistKnownLanguages(next)
      return next
    })
  }, [])

  return (
    <KnownLanguagesContext value={{ knownLanguages, toggleLanguage, allLanguages: ALL_LANGUAGES }}>
      {children}
    </KnownLanguagesContext>
  )
}
