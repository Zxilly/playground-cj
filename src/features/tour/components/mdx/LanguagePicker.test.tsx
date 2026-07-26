import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompareWith } from './CompareWith'
import { LanguagePicker } from './LanguagePicker'
import { useKnownLanguagesStore } from '@/stores/knownLanguages'

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

describe('tour comparison language controls', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    useKnownLanguagesStore.setState({ knownLanguages: [] })
  })

  it('lets learners opt into Python comparisons that already exist in course content', () => {
    render(
      <Wrapper>
        <LanguagePicker />
      </Wrapper>,
    )

    const trigger = screen.getByRole('button', { name: '选择对比语言' })
    expect(trigger.textContent).toContain('对比')

    fireEvent.click(trigger)
    screen.getByLabelText('Python')
    fireEvent.click(screen.getByLabelText('Python'))

    expect(trigger.textContent).toContain('Python')
    expect(useKnownLanguagesStore.getState().knownLanguages).toContain('python')
  })

  it('renders known Python compare blocks and ignores unknown compare ids', () => {
    useKnownLanguagesStore.setState({ knownLanguages: ['python'] })

    render(
      <Wrapper>
        <CompareWith lang="python">
          <p>Python tuple migration note.</p>
        </CompareWith>
        <CompareWith lang="swift">
          <p>Unknown language note.</p>
        </CompareWith>
      </Wrapper>,
    )

    screen.getByText('Python tuple migration note.')
    expect(
      screen.getByText((_content, element) => element?.className === 'tour-compare-label' && element.textContent === '对比 Python'),
    ).toBeTruthy()
    expect(screen.queryByText('Unknown language note.')).toBeNull()
  })
})
