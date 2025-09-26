'use client'

import { I18nProvider } from '@lingui/react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getLocaleFromPath, i18n, initializeI18n } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { LanguageContext } from '@/hooks/useLanguage'

interface StaticLanguageProviderProps {
  children: ReactNode
}

export function StaticLanguageProvider({ children }: StaticLanguageProviderProps) {
  const [locale, setLocale] = useState<Locale>(() => getLocaleFromPath())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const currentLocale = getLocaleFromPath()

    initializeI18n(currentLocale).then(() => {
      setLocale(currentLocale)
      setIsLoading(false)
    })
  }, [])

  const props = useMemo(() => ({ locale, isLoading }), [locale, isLoading])

  return (
    <LanguageContext value={props}>
      {isLoading
        ? (
            <div>Loading...</div>
          )
        : (
            <I18nProvider i18n={i18n}>
              {children}
            </I18nProvider>
          )}
    </LanguageContext>
  )
}
