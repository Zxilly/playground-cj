import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuizBlockSchemaType } from '@/lib/teach/lessons/blocks'
import { QuizBlock } from './QuizBlock'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

function options() {
  return screen.getAllByTestId('quiz-option') as HTMLButtonElement[]
}

function submitButton() {
  return screen.getByTestId('quiz-submit') as HTMLButtonElement
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

const singleBlock: QuizBlockSchemaType = {
  type: 'quiz',
  question: 'Which keyword binds an immutable value?',
  options: ['let here', 'var here'],
  answerIndices: [0],
  multiple: false,
  explanation: 'let is immutable; var is mutable.',
}

const multiBlock: QuizBlockSchemaType = {
  type: 'quiz',
  question: 'Which are value types?',
  options: ['Int aa', 'Bool bb', 'Class cc'],
  answerIndices: [0, 1],
  multiple: true,
  explanation: 'Int and Bool are value types.',
}

describe('quizBlock', () => {
  it('renders options in the given order', () => {
    render(<QuizBlock block={singleBlock} />)
    expect(options().map(o => o.textContent)).toEqual(['let here', 'var here'])
  })

  it('does not leak correctness before submit', () => {
    render(<QuizBlock block={singleBlock} />)
    for (const option of options())
      expect(option.getAttribute('data-correctness')).toBeNull()
    expect(screen.queryByTestId('quiz-explanation')).toBeNull()
  })

  it('submit disabled until an option is selected', () => {
    render(<QuizBlock block={singleBlock} />)
    expect(submitButton().disabled).toBe(true)
    fireEvent.click(options()[0])
    expect(submitButton().disabled).toBe(false)
  })

  it('reports correct outcome and shows explanation when the right option is chosen', () => {
    const onOutcome = vi.fn()
    render(<QuizBlock block={singleBlock} onOutcome={onOutcome} />)
    fireEvent.click(options()[0])
    fireEvent.click(submitButton())
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('true')
    expect(screen.getByTestId('quiz-explanation').textContent).toContain('let is immutable')
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
  })

  it('shows an incorrect result and allows retry when the wrong option is chosen', () => {
    const onOutcome = vi.fn()
    render(<QuizBlock block={singleBlock} onOutcome={onOutcome} />)
    fireEvent.click(options()[1])
    fireEvent.click(submitButton())
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('false')
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
    fireEvent.click(screen.getByTestId('quiz-retry'))
    expect(screen.queryByTestId('quiz-result')).toBeNull()
    expect(submitButton().disabled).toBe(true)
  })

  it('marks correctness on each option only after submit', () => {
    render(<QuizBlock block={singleBlock} />)
    fireEvent.click(options()[1])
    fireEvent.click(submitButton())
    const opts = options()
    expect(opts[0].getAttribute('data-correctness')).toBe('correct')
    expect(opts[1].getAttribute('data-correctness')).toBe('incorrect-selected')
  })

  it('multiple: correct only when the full answer set is selected', () => {
    const onOutcome = vi.fn()
    render(<QuizBlock block={multiBlock} onOutcome={onOutcome} />)
    fireEvent.click(options()[0])
    fireEvent.click(submitButton())
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('false')

    fireEvent.click(screen.getByTestId('quiz-retry'))
    fireEvent.click(options()[0])
    fireEvent.click(options()[1])
    fireEvent.click(submitButton())
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('true')
    expect(onOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ correct: true }))
  })

  it('multiple: selecting an extra wrong option is incorrect', () => {
    render(<QuizBlock block={multiBlock} />)
    fireEvent.click(options()[0])
    fireEvent.click(options()[1])
    fireEvent.click(options()[2])
    fireEvent.click(submitButton())
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('false')
  })

  it('single: selecting a second option replaces the first', () => {
    render(<QuizBlock block={singleBlock} />)
    fireEvent.click(options()[0])
    fireEvent.click(options()[1])
    const opts = options()
    expect(opts[0].getAttribute('aria-pressed')).toBe('false')
    expect(opts[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('multiple: clicking a selected option toggles it off', () => {
    render(<QuizBlock block={multiBlock} />)
    fireEvent.click(options()[0])
    fireEvent.click(options()[0])
    expect(options()[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('rehydrates as submitted from a completed outcome, restoring the prior answer and feedback', () => {
    render(
      <QuizBlock
        block={singleBlock}
        outcome={{ attempts: 1, correct: true, lastAnswer: [0], completedAt: 1000 }}
      />,
    )
    // Already-submitted: no submit button, options disabled, result + explanation shown.
    expect(screen.queryByTestId('quiz-submit')).toBeNull()
    const opts = options()
    expect(opts[0].getAttribute('aria-pressed')).toBe('true')
    expect(opts.every(o => o.disabled)).toBe(true)
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('true')
    expect(screen.getByTestId('quiz-explanation').textContent).toContain('let is immutable')
    expect(opts[0].getAttribute('data-correctness')).toBe('correct')
  })

  it('rehydrates an incorrect completed outcome with the wrong answer marked and retry available', () => {
    render(
      <QuizBlock
        block={singleBlock}
        outcome={{ attempts: 1, correct: false, lastAnswer: [1], completedAt: 1000 }}
      />,
    )
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('false')
    const opts = options()
    expect(opts[1].getAttribute('data-correctness')).toBe('incorrect-selected')
    expect(opts[0].getAttribute('data-correctness')).toBe('correct')
    expect(screen.getByTestId('quiz-retry')).toBeTruthy()
  })

  it('does not rehydrate as submitted when the outcome has no recorded answer', () => {
    render(<QuizBlock block={singleBlock} outcome={{ attempts: 0 }} />)
    expect(screen.queryByTestId('quiz-result')).toBeNull()
    expect(submitButton().disabled).toBe(true)
  })
})
