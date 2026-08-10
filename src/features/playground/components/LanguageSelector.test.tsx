import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { LanguageSelector } from './LanguageSelector'

const { languageHookMock } = vi.hoisted(() => ({
  languageHookMock: vi.fn(() => ({ locale: 'en' as const })),
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: languageHookMock,
}))

describe('language selector', () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView

  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => cleanup())

  afterAll(() => {
    vi.unstubAllGlobals()
    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      })
    }
    else {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  it('exposes the visible locale as the selected accessible option', async () => {
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
    i18n.activate('en')

    render(
      <I18nProvider i18n={i18n}>
        <LanguageSelector />
      </I18nProvider>,
    )

    const combobox = screen.getByRole('combobox')
    expect(combobox.className).toContain('min-h-11')
    fireEvent.click(combobox)

    const englishOption = await screen.findByRole('option', { name: 'English' })
    const chineseOption = screen.getByRole('option', { name: '中文' })
    expect(englishOption.getAttribute('aria-selected')).toBe('true')
    expect(chineseOption.getAttribute('aria-selected')).toBe('false')
    expect(englishOption.className).toContain('min-h-11')
    expect(chineseOption.className).toContain('min-h-11')
  })

  it('moves from the current locale with arrow keys after pointer opening', async () => {
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
    i18n.activate('en')

    render(
      <I18nProvider i18n={i18n}>
        <LanguageSelector />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('combobox'))
    const englishOption = await screen.findByRole('option', { name: 'English' })
    const chineseOption = screen.getByRole('option', { name: '中文' })
    const command = document.querySelector<HTMLElement>('[cmdk-root]')
    expect(command).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(command))

    fireEvent.keyDown(command!, { key: 'ArrowUp' })
    expect(chineseOption.getAttribute('aria-selected')).toBe('true')
    expect(englishOption.getAttribute('aria-selected')).toBe('false')
  })
})
