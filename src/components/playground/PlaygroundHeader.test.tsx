import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { PlaygroundHeader } from '@/components/playground/PlaygroundHeader'

function mockUseMedia() {
  return true
}

function mockUseLanguage() {
  return { locale: 'zh' as const }
}

function MockImage() {
  return <div data-testid="next-image" />
}

function MockLanguageSelector() {
  return <div>Language Selector</div>
}

function MockExamplesDropdown() {
  return <div>Examples Dropdown</div>
}

function MockShareButton() {
  return <button type="button">Share</button>
}

vi.mock('next/image', () => ({
  default: MockImage,
}))

vi.mock('react-use', () => ({
  useMedia: mockUseMedia,
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: mockUseLanguage,
}))

vi.mock('@/components/LanguageSelector', () => ({
  LanguageSelector: MockLanguageSelector,
}))

vi.mock('@/components/ExamplesDropdown', () => ({
  ExamplesDropdown: MockExamplesDropdown,
}))

vi.mock('@/components/ShareButton', () => ({
  default: MockShareButton,
}))

describe('playground header', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'https://playground.cj.zxilly.dev',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('links the tour button to the sibling tour domain when rendered on the playground domain', () => {
    const i18n = setupI18n({
      locale: 'zh',
      messages: { zh: {} },
    })
    i18n.activate('zh')

    render(
      <I18nProvider i18n={i18n}>
        <PlaygroundHeader
          handleRun={() => {}}
          handleFormat={() => {}}
          wrapperRef={{ current: undefined }}
        />
      </I18nProvider>,
    )

    expect(screen.getByRole('link', { name: '教程' }).getAttribute('href')).toBe('https://tour.cj.zxilly.dev/zh')
  })
})
