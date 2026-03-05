import { i18n } from '@lingui/core'
import { messages as zhMessages } from '@/locales/zh/messages.mjs'
import { messages as enMessages } from '@/locales/en/messages.mjs'

export const locales = ['zh', 'en'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'zh'

// Pre-load all messages for SSR support
i18n.load({
  zh: zhMessages,
  en: enMessages,
})
i18n.activate(defaultLocale)

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

export function getLocaleFromPath(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale
  }

  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0]
  return isLocale(firstSegment) ? firstSegment : defaultLocale
}

export function initializeI18n(locale: Locale): void {
  i18n.activate(locale)
}

export { i18n }
