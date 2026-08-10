import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { PlaygroundHeader } from '@/features/playground/components/PlaygroundHeader'

let desktop = true

function mockUseMedia() {
  return desktop
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

vi.mock('@/features/playground/components/LanguageSelector', () => ({
  LanguageSelector: MockLanguageSelector,
}))

vi.mock('@/features/playground/components/ExamplesDropdown', () => ({
  ExamplesDropdown: MockExamplesDropdown,
}))

vi.mock('@/features/playground/components/ShareButton', () => ({
  default: MockShareButton,
}))

describe('playground header', () => {
  beforeEach(() => {
    desktop = true
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'https://playground.cj.zxilly.dev',
    })
  })

  afterEach(() => {
    cleanup()
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
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.className).toContain('whitespace-nowrap')
    expect(heading.parentElement?.className).toContain('shrink-0')
    expect(screen.getByText('Examples Dropdown').parentElement?.className).toContain('w-[160px]')
    expect(screen.getByText('Examples Dropdown').parentElement?.className).toContain('xl:w-[200px]')
  })

  it('stacks the narrow header and keeps its primary actions touch sized', () => {
    desktop = false
    const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
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

    const narrowHeader = screen.getByRole('heading', { level: 1 }).parentElement?.parentElement
    expect(narrowHeader?.className).toContain('flex-col')
    expect(narrowHeader?.className).not.toContain('sm:flex-row')
    expect(screen.getByRole('link', { name: '教程' }).className).toContain('min-h-11')
    expect(screen.getByRole('button', { name: '运行' }).className).toContain('min-h-11')
    expect(screen.getByRole('button', { name: '格式化' }).className).toContain('min-h-11')
  })
})
