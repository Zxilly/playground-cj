'use client'

import { I18nProvider } from '@lingui/react'
import { setupI18n } from '@lingui/core'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LanguageContext } from '@/hooks/useLanguage'
import type { Locale } from '@/lib/i18n'
import { i18n as globalI18n } from '@/lib/i18n'

interface LinguiClientProviderProps {
  children: ReactNode
  initialLocale: Locale
  initialMessages: any
}

export function LinguiClientProvider({
  children,
  initialLocale,
  initialMessages,
}: LinguiClientProviderProps) {
  const [i18n] = useState(() => {
    const instance = setupI18n({
      locale: initialLocale,
      messages: { [initialLocale]: initialMessages },
    })
    instance.activate(initialLocale)

    // Sync global i18n instance for components using the t macro
    globalI18n.load({ [initialLocale]: initialMessages })
    globalI18n.activate(initialLocale)

    return instance
  })

  const languageContextValue = useMemo(() => ({
    locale: initialLocale,
  }), [initialLocale])

  return (
    <LanguageContext value={languageContextValue}>
      <I18nProvider i18n={i18n}>
        {children}
      </I18nProvider>
    </LanguageContext>
  )
}
