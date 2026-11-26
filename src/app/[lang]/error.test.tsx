import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageContext } from '@/hooks/useLanguage'
import LangError from './error'

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/tour',
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <LanguageContext value={{ locale: 'en' }}>
        {children}
      </LanguageContext>
    </I18nProvider>
  )
}

describe('langError boundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders retry action, home link, and error digest', () => {
    const reset = vi.fn()
    const error = Object.assign(new Error('dpaste upstream failure'), { digest: 'err-1234' })

    render(<LangError error={error} reset={reset} />, { wrapper: Wrapper })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('页面加载出现问题')
    expect(alert.textContent).toContain('err-1234')

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(reset).toHaveBeenCalledOnce()

    const homeLink = screen.getByRole('link', { name: '返回首页' })
    expect(homeLink.getAttribute('href')).toBe('/en')
  })
})
