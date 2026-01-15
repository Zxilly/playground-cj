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

export function getLocaleFromPath(): Locale {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    const segments = path.split('/').filter(Boolean)
    const firstSegment = segments[0]

    if (firstSegment === 'en' || firstSegment === 'zh') {
      return firstSegment as Locale
    }
  }
  return defaultLocale
}

export async function initializeI18n(locale: Locale) {
  i18n.activate(locale)
}

export { i18n }
