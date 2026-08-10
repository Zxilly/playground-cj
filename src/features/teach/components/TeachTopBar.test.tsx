import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeachTopBar } from './TeachTopBar'

describe('teachTopBar', () => {
  it('keeps the mobile back target at least 44px while preserving desktop density', () => {
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
    i18n.activate('en')
    render(
      <I18nProvider i18n={i18n}>
        <TeachTopBar
          backLabel="Back to setup"
          onBack={vi.fn()}
        />
      </I18nProvider>,
    )

    const back = screen.getByRole('button', { name: 'Back to setup' })
    expect(back.className).toContain('size-11')
    expect(back.className).toContain('lg:size-8')
  })
})
