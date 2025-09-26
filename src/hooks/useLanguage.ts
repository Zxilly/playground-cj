'use client'

import { createContext, use } from 'react'
import type { Locale } from '@/lib/i18n'

interface LanguageContextType {
  locale: Locale
  isLoading: boolean
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function useLanguage() {
  const context = use(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a StaticLanguageProvider')
  }
  return context
}
