import { i18n } from '@lingui/core'

export const locales = ['zh', 'en'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'zh'

// LinguiClientProvider loads the current request's catalog, already serialized
// by the server layout. Importing both catalogs here duplicates that payload
// and adds the unused language to every client entry point.
i18n.load({ zh: {}, en: {} })
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
