import { i18n } from '@lingui/core'

export const locales = ['zh', 'en'] as const
export type Locale = typeof locales[number]

export const defaultLocale: Locale = 'zh'

export function getLocaleFromPath(): Locale {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path.startsWith('/en')) {
      return 'en'
    }
  }
  return defaultLocale
}

export async function initializeI18n(locale: Locale) {
  try {
    const catalog = await import(`../locales/${locale}/messages.mjs`)
    i18n.loadAndActivate({ locale, messages: catalog.messages })
  } catch (error) {
    console.warn(`Failed to load locale ${locale}, falling back to ${defaultLocale}`)
    if (locale !== defaultLocale) {
      const catalog = await import(`../locales/${defaultLocale}/messages.mjs`)
      i18n.loadAndActivate({ locale: defaultLocale, messages: catalog.messages })
    }
  }
}

export { i18n }