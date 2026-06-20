import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeachLanding } from './TeachLanding'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

afterEach(() => {
  cleanup()
})

describe('teachLanding intro', () => {
  it('renders the classroom intro', () => {
    render(<TeachLanding onStart={vi.fn()} />)
    expect(screen.getByTestId('teach-landing')).toBeTruthy()
  })

  it('advances to the configuration step via the start button', () => {
    const onStart = vi.fn()
    render(<TeachLanding onStart={onStart} />)
    fireEvent.click(screen.getByTestId('teach-landing-start'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
