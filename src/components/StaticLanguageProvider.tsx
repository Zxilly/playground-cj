'use client'

import { I18nProvider } from '@lingui/react'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { initializeI18n, i18n, type Locale, getLocaleFromPath } from '@/lib/i18n'

interface LanguageContextType {
  locale: Locale
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a StaticLanguageProvider')
  }
  return context
}

interface StaticLanguageProviderProps {
  children: ReactNode
}

export function StaticLanguageProvider({ children }: StaticLanguageProviderProps) {
  const [locale, setLocale] = useState<Locale>(getLocaleFromPath())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const currentLocale = getLocaleFromPath()

    initializeI18n(currentLocale).then(() => {
      setLocale(currentLocale)
      setIsLoading(false)
    })
  }, [])

  return (
    <LanguageContext.Provider value={{ locale, isLoading }}>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <I18nProvider i18n={i18n}>
          {children}
        </I18nProvider>
      )}
    </LanguageContext.Provider>
  )
}