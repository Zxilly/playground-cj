import { defaultLocale, getLocaleFromPath, i18n, initializeI18n, isLocale, locales } from '@/lib/i18n'
import { afterEach, describe, expect, it } from 'vitest'

describe('i18n helpers', () => {
  afterEach(() => {
    initializeI18n(defaultLocale)
    window.history.replaceState(null, '', '/')
  })

  it('recognizes only configured locales', () => {
    for (const locale of locales)
      expect(isLocale(locale)).toBe(true)

    expect(locales).toContain(defaultLocale)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('')).toBe(false)
  })

  it('reads the first pathname segment as locale or falls back to default', () => {
    window.history.replaceState(null, '', '/en/editor')
    expect(getLocaleFromPath()).toBe('en')

    window.history.replaceState(null, '', '/docs/en')
    expect(getLocaleFromPath()).toBe(defaultLocale)
  })

  it('activates the requested locale', () => {
    initializeI18n('en')
    expect(i18n.locale).toBe('en')
  })
})
