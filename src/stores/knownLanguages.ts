'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const ALL_LANGUAGES = ['c', 'java', 'go', 'rust'] as const
export type Language = typeof ALL_LANGUAGES[number]

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
    },
  ),
)

export function useIsLanguageKnown(lang: Language): boolean {
  return useKnownLanguagesStore(state => state.knownLanguages.includes(lang))
}
