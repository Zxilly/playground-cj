import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageContext } from '@/hooks/useLanguage'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { AppNavLinks, LocaleSwitchLink, ThemeToggle } from './index'

const nextNavigationMocks = vi.hoisted(() => ({
  pathname: '/zh/tour/basics/1',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => nextNavigationMocks.pathname,
}))

function createMockMatchMedia(dark: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-color-scheme: dark') ? dark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function TestProviders({ children, locale = 'zh' }: { children: ReactNode, locale?: 'zh' | 'en' }) {
  const i18n = setupI18n({ locale, messages: { [locale]: {} } })
  i18n.activate(locale)
  globalI18n.load({ [locale]: {} })
  globalI18n.activate(locale)
  return (
    <ThemeProvider>
      <I18nProvider i18n={i18n}>
        <LanguageContext value={{ locale }}>
          {children}
        </LanguageContext>
      </I18nProvider>
    </ThemeProvider>
  )
}

describe('app-shell primitives', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMockMatchMedia(false),
    })
    nextNavigationMocks.pathname = '/zh/tour/basics/1'
    window.history.replaceState({}, '', '/zh/tour/basics/1?tab=editor#top')
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  it('cycles ThemeToggle cleanly across system, dark, and light modes', async () => {
    render(<ThemeToggle showLabel />, { wrapper: TestProviders })

    const button = screen.getByRole('button', { name: '切换主题（当前：跟随系统）' })
    expect(button.getAttribute('data-theme-mode')).toBe('system')

    await act(async () => {
      fireEvent.click(button)
    })
    await waitFor(() => expect(button.getAttribute('data-theme-mode')).toBe('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await act(async () => {
      fireEvent.click(button)
    })
    await waitFor(() => expect(button.getAttribute('data-theme-mode')).toBe('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await act(async () => {
      fireEvent.click(button)
    })
    await waitFor(() => expect(button.getAttribute('data-theme-mode')).toBe('system'))
  })

  it('renders AppNavLinks with site-aware hrefs and active indicator', () => {
    render(<AppNavLinks active="tour" aiTopic="cj.var.immutable" />, { wrapper: TestProviders })

    const nav = screen.getByRole('navigation', { name: '主导航' })
    expect(nav).toBeTruthy()

    const playgroundLink = screen.getByRole('link', { name: 'Playground' })
    const tourLink = screen.getByRole('link', { name: '仓颉之旅' })
    const aiLink = screen.getByRole('link', { name: 'AI 课堂' })

    expect(playgroundLink.getAttribute('href')).toBe(`${window.location.origin}/zh`)
    expect(tourLink.getAttribute('href')).toBe('/zh/tour')
    expect(tourLink.getAttribute('aria-current')).toBe('page')
    expect(playgroundLink.getAttribute('aria-current')).toBeNull()
    expect(aiLink.getAttribute('href')).toBe('/zh/tour/ai?topic=cj.var.immutable')
  })

  it('renders LocaleSwitchLink preserving query/hash and writes locale cookie on click', () => {
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault())
    render(<LocaleSwitchLink onClick={onClick} />, { wrapper: TestProviders })

    const link = screen.getByRole('link', { name: 'Switch to English' })
    expect(link.getAttribute('href')).toBe('/en/tour/basics/1?tab=editor#top')
    expect(link.getAttribute('lang')).toBe('en')
    expect(link.textContent).toBe('EN')

    fireEvent.click(link)
    expect(document.cookie).toContain('locale=en')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
