'use client'

import { createContext } from 'react'

const STORAGE_KEY = 'tour-known-languages'

export const ALL_LANGUAGES = ['c', 'java', 'go', 'rust'] as const

export type Language = typeof ALL_LANGUAGES[number]

export interface KnownLanguagesContextValue {
  knownLanguages: Set<Language>
  toggleLanguage: (lang: Language) => void
  allLanguages: readonly Language[]
}

export const KnownLanguagesContext = createContext<KnownLanguagesContextValue | null>(null)

export function readStoredKnownLanguages(): Set<Language> {
  if (typeof window === 'undefined')
    return new Set()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored)
      return new Set()

    const parsed = JSON.parse(stored) as string[]
    const next = parsed.filter(lang => ALL_LANGUAGES.includes(lang as Language)) as Language[]
    return new Set(next)
  }
  catch {
    return new Set()
  }
}

export function persistKnownLanguages(languages: Set<Language>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...languages]))
}
