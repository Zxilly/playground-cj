import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { messages as zhMessages } from '@/locales/zh/messages.mjs'

const CATALOGS = {
  en: enMessages,
  zh: zhMessages,
} as const

function createTestI18n(locale: Locale = 'zh') {
  const messages = CATALOGS[locale]
  const instance = setupI18n({
    locale,
    messages: { [locale]: messages },
  })
  instance.activate(locale)
  globalI18n.load({ [locale]: messages })
  globalI18n.activate(locale)
  return instance
}

export function TestI18nProvider({
  children,
  locale = 'zh',
}: {
  children: ReactNode
  locale?: Locale
}) {
  const i18n = createTestI18n(locale)
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
