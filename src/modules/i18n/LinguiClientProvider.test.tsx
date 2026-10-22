import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useLingui } from '@lingui/react'
import { i18n } from '@/lib/i18n'
import { LinguiClientProvider } from './LinguiClientProvider'

function Translation() {
  const { i18n: instance } = useLingui()
  return <span>{instance._('server-catalog-message')}</span>
}

describe('server-provided locale catalogs', () => {
  afterEach(cleanup)

  it('loads server messages into React and imperative translation consumers on navigation', () => {
    const { rerender } = render(
      <LinguiClientProvider initialLocale="zh" initialMessages={{ 'server-catalog-message': '服务端中文' }}>
        <Translation />
      </LinguiClientProvider>,
    )
    expect(screen.getByText('服务端中文')).toBeDefined()
    expect(i18n._('server-catalog-message')).toBe('服务端中文')

    rerender(
      <LinguiClientProvider initialLocale="en" initialMessages={{ 'server-catalog-message': 'Server English' }}>
        <Translation />
      </LinguiClientProvider>,
    )
    expect(screen.getByText('Server English')).toBeDefined()
    expect(i18n._('server-catalog-message')).toBe('Server English')
    expect(i18n.locale).toBe('en')
  })
})
