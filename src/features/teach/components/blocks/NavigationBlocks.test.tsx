import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LessonNavigationContextValue } from '@/features/teach/context/lesson-navigation-context'
import { LessonNavigationContext } from '@/features/teach/context/lesson-navigation-context'
import { LessonLinkBlock } from './LessonLinkBlock'
import { ReferenceLinkBlock } from './ReferenceLinkBlock'
import { FollowupPromptBlock } from './FollowupPromptBlock'

function makeNav(overrides: Partial<LessonNavigationContextValue> = {}): LessonNavigationContextValue {
  return {
    selectLesson: vi.fn(),
    openReference: vi.fn(),
    prefillChat: vi.fn(),
    ...overrides,
  }
}

function Wrapper({ nav, children }: { nav: LessonNavigationContextValue, children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <LessonNavigationContext value={nav}>{children}</LessonNavigationContext>
    </I18nProvider>
  )
}

function render(ui: ReactElement, nav: LessonNavigationContextValue) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <Wrapper nav={nav}>{children}</Wrapper>,
  })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

describe('lessonLinkBlock', () => {
  it('renders the label', () => {
    const nav = makeNav()
    render(<LessonLinkBlock block={{ type: 'lesson_link', lessonId: '0002', label: 'Next: pattern matching' }} />, nav)
    expect(screen.getByText('Next: pattern matching')).toBeTruthy()
  })

  it('selects the lesson on click', () => {
    const nav = makeNav()
    render(<LessonLinkBlock block={{ type: 'lesson_link', lessonId: '0002', label: 'Go' }} />, nav)
    fireEvent.click(screen.getByTestId('lesson-link'))
    expect(nav.selectLesson).toHaveBeenCalledWith('0002')
    expect(nav.openReference).not.toHaveBeenCalled()
  })
})

describe('referenceLinkBlock', () => {
  it('renders the label', () => {
    const nav = makeNav()
    render(<ReferenceLinkBlock block={{ type: 'reference_link', referenceId: 'r1', label: 'Syntax cheat-sheet' }} />, nav)
    expect(screen.getByText('Syntax cheat-sheet')).toBeTruthy()
  })

  it('opens the reference on click', () => {
    const nav = makeNav()
    render(<ReferenceLinkBlock block={{ type: 'reference_link', referenceId: 'r1', label: 'Open' }} />, nav)
    fireEvent.click(screen.getByTestId('reference-link'))
    expect(nav.openReference).toHaveBeenCalledWith('r1')
    expect(nav.selectLesson).not.toHaveBeenCalled()
  })
})

describe('followupPromptBlock', () => {
  it('renders the prompt text', () => {
    const nav = makeNav()
    render(<FollowupPromptBlock block={{ type: 'followup_prompt', prompt: 'Why does let forbid shadowing?' }} />, nav)
    expect(screen.getByText('Why does let forbid shadowing?')).toBeTruthy()
  })

  it('renders inline markdown while preserving the original chat prefill', () => {
    const nav = makeNav()
    const prompt = 'Why does **`let`** forbid shadowing?'
    render(<FollowupPromptBlock block={{ type: 'followup_prompt', prompt }} />, nav)

    const renderedPrompt = screen.getByTestId('followup-prompt')
    expect(renderedPrompt.querySelector('strong code')?.textContent).toBe('let')
    expect(renderedPrompt.textContent).not.toContain('**')
    expect(renderedPrompt.textContent).not.toContain('`')

    fireEvent.click(screen.getByTestId('followup-ask'))
    expect(nav.prefillChat).toHaveBeenCalledWith(prompt)
  })

  it('prefills the chat with the prompt when asking the teacher', () => {
    const nav = makeNav()
    render(<FollowupPromptBlock block={{ type: 'followup_prompt', prompt: 'Explain ownership' }} />, nav)
    fireEvent.click(screen.getByTestId('followup-ask'))
    expect(nav.prefillChat).toHaveBeenCalledWith('Explain ownership')
  })
})
