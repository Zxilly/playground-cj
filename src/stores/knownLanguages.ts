'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const ALL_LANGUAGES = ['c', 'java', 'go', 'rust'] as const
export type Language = typeof ALL_LANGUAGES[number]

export const LANGUAGE_LABELS = {
  c: 'C',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
} satisfies Record<Language, string>

export function isKnownLanguageId(lang: string): lang is Language {
  return (ALL_LANGUAGES as readonly string[]).includes(lang)
}

interface KnownLanguagesState {
  readonly knownLanguages: readonly Language[]
  readonly toggleLanguage: (lang: Language) => void
}

export const useKnownLanguagesStore = create<KnownLanguagesState>()(
  persist(
    set => ({
      knownLanguages: [],
      toggleLanguage: (lang) => {
        set((state) => {
          const has = state.knownLanguages.includes(lang)
          return {
            knownLanguages: has
              ? state.knownLanguages.filter(l => l !== lang)
              : [...state.knownLanguages, lang],
          }
        })
      },
    }),
    {
      name: 'tour-known-languages',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ knownLanguages: state.knownLanguages }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { knownLanguages?: unknown } | undefined
        const raw = Array.isArray(persisted?.knownLanguages) ? persisted.knownLanguages : []
        return {
          ...currentState,
          knownLanguages: raw.filter((lang): lang is Language => typeof lang === 'string' && isKnownLanguageId(lang)),
        }
      },
    },
  ),
)

export function useIsLanguageKnown(lang: Language | null | undefined): boolean {
  return useKnownLanguagesStore(state => lang != null && state.knownLanguages.includes(lang))
}
