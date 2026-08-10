import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ExamplesDropdown } from './ExamplesDropdown'

const { languageHookMock } = vi.hoisted(() => ({
  languageHookMock: vi.fn(() => ({ locale: 'en' as const })),
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: languageHookMock,
}))

describe('examples dropdown', () => {
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

  it('keeps the selected accessible option in sync with the visible example', async () => {
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
    i18n.activate('en')
    const action = vi.fn()

    render(
      <I18nProvider i18n={i18n}>
        <ExamplesDropdown action={action} />
      </I18nProvider>,
    )

    const combobox = screen.getByRole('combobox', { name: '选择示例' })
    fireEvent.click(combobox)
    const helloOption = await screen.findByRole('option', { name: 'Hello World' })
    const arrayOption = screen.getByRole('option', { name: 'Array' })
    expect(helloOption.getAttribute('aria-selected')).toBe('true')
    expect(arrayOption.getAttribute('aria-selected')).toBe('false')

    fireEvent.click(arrayOption)
    expect(action).toHaveBeenCalledOnce()
    expect(combobox.textContent).toContain('Array')

    fireEvent.click(combobox)
    expect((await screen.findByRole('option', { name: 'Array' })).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('option', { name: 'Hello World' }).getAttribute('aria-selected')).toBe('false')
  })

  it('keeps arrow-key navigation available while restoring the chosen example on reopen', async () => {
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
    i18n.activate('en')
    const action = vi.fn()

    render(
      <I18nProvider i18n={i18n}>
        <ExamplesDropdown action={action} />
      </I18nProvider>,
    )

    const combobox = screen.getByRole('combobox', { name: '选择示例' })
    fireEvent.click(combobox)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox', { name: '搜索示例' })))
    const listbox = await screen.findByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    const arrayOption = screen.getByRole('option', { name: 'Array' })
    expect(arrayOption.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'Enter' })

    expect(action).toHaveBeenCalledOnce()
    expect(combobox.textContent).toContain('Array')
    fireEvent.click(combobox)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox', { name: '搜索示例' })))
    const reopenedListbox = await screen.findByRole('listbox')
    expect(screen.getByRole('option', { name: 'Array' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(reopenedListbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'For Loop' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(reopenedListbox, { key: 'Enter' })
    expect(action).toHaveBeenCalledTimes(2)
    expect(combobox.textContent).toContain('For Loop')
  })
})
