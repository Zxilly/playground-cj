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

/** All option buttons across the whole block, in document order. */
function options() {
  return screen.getAllByTestId('quiz-option') as HTMLButtonElement[]
}

/** Option buttons belonging to a single question (by question index). */
function optionsFor(questionIndex: number) {
  return options().filter(o => o.getAttribute('data-question') === String(questionIndex))
}

function submitButton() {
  return screen.getByTestId('quiz-submit') as HTMLButtonElement
}

function resultFor(questionIndex: number) {
  return screen
    .getAllByTestId('quiz-result')
    .find(el => el.getAttribute('data-question') === String(questionIndex)) as HTMLElement
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

// A mixed block: question 0 is single-choice, question 1 is multiple-choice.
const mixedBlock: QuizBlockSchemaType = {
  type: 'quiz',
  questions: [
    {
      question: 'Which keyword binds an immutable value?',
      options: ['let here', 'var here'],
      answerIndices: [0],
      multiple: false,
      explanation: 'let is immutable; var is mutable.',
    },
    {
      question: 'Which are value types?',
      options: ['Int aa', 'Bool bb', 'Class cc'],
      answerIndices: [0, 1],
      multiple: true,
      explanation: 'Int and Bool are value types.',
    },
  ],
}

const singleOnlyBlock: QuizBlockSchemaType = {
  type: 'quiz',
  questions: [mixedBlock.questions[0]],
}

describe('quizBlock', () => {
  it('renders every question and its options in the given order', () => {
    render(<QuizBlock block={mixedBlock} />)
    expect(screen.getAllByTestId('quiz-question')).toHaveLength(2)
    expect(optionsFor(0).map(o => o.textContent)).toEqual(['let here', 'var here'])
    expect(optionsFor(1).map(o => o.textContent)).toEqual(['Int aa', 'Bool bb', 'Class cc'])
  })

  it('does not leak correctness before submit', () => {
    render(<QuizBlock block={mixedBlock} />)
    for (const option of options())
      expect(option.getAttribute('data-correctness')).toBeNull()
    expect(screen.queryByTestId('quiz-explanation')).toBeNull()
  })

  it('submit disabled until every question is answered', () => {
    render(<QuizBlock block={mixedBlock} />)
    expect(submitButton().disabled).toBe(true)
    fireEvent.click(optionsFor(0)[0])
    // Only question 0 answered; question 1 still empty.
    expect(submitButton().disabled).toBe(true)
    expect(screen.getByTestId('quiz-incomplete')).toBeTruthy()
    fireEvent.click(optionsFor(1)[0])
    expect(submitButton().disabled).toBe(false)
    expect(screen.queryByTestId('quiz-incomplete')).toBeNull()
  })

  it('single-choice question: a second pick replaces the first', () => {
    render(<QuizBlock block={mixedBlock} />)
    fireEvent.click(optionsFor(0)[0])
    fireEvent.click(optionsFor(0)[1])
    const opts = optionsFor(0)
    expect(opts[0].getAttribute('aria-pressed')).toBe('false')
    expect(opts[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('multiple-choice question: clicking a selected option toggles it off', () => {
    render(<QuizBlock block={mixedBlock} />)
    fireEvent.click(optionsFor(1)[0])
    fireEvent.click(optionsFor(1)[0])
    expect(optionsFor(1)[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('submits all questions at once and shows per-question feedback', () => {
    const onOutcome = vi.fn()
    render(<QuizBlock block={mixedBlock} onOutcome={onOutcome} />)
    // Answer both questions correctly.
    fireEvent.click(optionsFor(0)[0])
    fireEvent.click(optionsFor(1)[0])
    fireEvent.click(optionsFor(1)[1])
    fireEvent.click(submitButton())

    // One outcome reported for the whole block.
    expect(onOutcome).toHaveBeenCalledTimes(1)
    expect(onOutcome).toHaveBeenCalledWith({ correct: true, lastAnswer: [[0], [0, 1]] })

    // Per-question results + explanations present.
    expect(resultFor(0).getAttribute('data-correct')).toBe('true')
    expect(resultFor(1).getAttribute('data-correct')).toBe('true')
    const explanations = screen.getAllByTestId('quiz-explanation')
    expect(explanations[0].textContent).toContain('let is immutable')
    expect(explanations[1].textContent).toContain('value types')
    expect(screen.getByTestId('quiz-summary').getAttribute('data-correct')).toBe('true')
  })

  it('all-correct vs partial: block is incorrect when any question is wrong', () => {
    const onOutcome = vi.fn()
    render(<QuizBlock block={mixedBlock} onOutcome={onOutcome} />)
    // Q0 correct, Q1 missing one required answer.
    fireEvent.click(optionsFor(0)[0])
    fireEvent.click(optionsFor(1)[0])
    fireEvent.click(submitButton())

    expect(onOutcome).toHaveBeenCalledWith({ correct: false, lastAnswer: [[0], [0]] })
    expect(resultFor(0).getAttribute('data-correct')).toBe('true')
    expect(resultFor(1).getAttribute('data-correct')).toBe('false')
    expect(screen.getByTestId('quiz-summary').getAttribute('data-correct')).toBe('false')
    // A wrong block offers a retry.
    expect(screen.getByTestId('quiz-retry')).toBeTruthy()
  })

  it('marks option correctness per question only after submit', () => {
    render(<QuizBlock block={mixedBlock} />)
    fireEvent.click(optionsFor(0)[1]) // wrong single choice
    fireEvent.click(optionsFor(1)[2]) // wrong extra option
    fireEvent.click(submitButton())

    const q0 = optionsFor(0)
    expect(q0[0].getAttribute('data-correctness')).toBe('correct')
    expect(q0[1].getAttribute('data-correctness')).toBe('incorrect-selected')

    const q1 = optionsFor(1)
    expect(q1[0].getAttribute('data-correctness')).toBe('correct')
    expect(q1[1].getAttribute('data-correctness')).toBe('correct')
    expect(q1[2].getAttribute('data-correctness')).toBe('incorrect-selected')
  })

  it('retry resets every question back to an unanswered, unsubmitted state', () => {
    render(<QuizBlock block={mixedBlock} />)
    fireEvent.click(optionsFor(0)[1])
    fireEvent.click(optionsFor(1)[0])
    fireEvent.click(submitButton())
    expect(screen.getByTestId('quiz-summary').getAttribute('data-correct')).toBe('false')

    fireEvent.click(screen.getByTestId('quiz-retry'))
    expect(screen.queryByTestId('quiz-summary')).toBeNull()
    expect(submitButton().disabled).toBe(true)
    for (const opt of options())
      expect(opt.getAttribute('aria-pressed')).toBe('false')
  })

  it('rehydrates as submitted from a completed outcome, restoring per-question answers and feedback', () => {
    render(
      <QuizBlock
        block={mixedBlock}
        outcome={{ attempts: 1, correct: true, lastAnswer: [[0], [0, 1]], completedAt: 1000 }}
      />,
    )
    // Already submitted: no submit button, options disabled, results shown.
    expect(screen.queryByTestId('quiz-submit')).toBeNull()
    expect(options().every(o => o.disabled)).toBe(true)

    expect(optionsFor(0)[0].getAttribute('aria-pressed')).toBe('true')
    expect(optionsFor(1)[0].getAttribute('aria-pressed')).toBe('true')
    expect(optionsFor(1)[1].getAttribute('aria-pressed')).toBe('true')

    expect(resultFor(0).getAttribute('data-correct')).toBe('true')
    expect(resultFor(1).getAttribute('data-correct')).toBe('true')
    expect(screen.getByTestId('quiz-summary').getAttribute('data-correct')).toBe('true')
    expect(screen.getAllByTestId('quiz-explanation')[0].textContent).toContain('let is immutable')
  })

  it('rehydrates an incorrect completed outcome with the wrong answer marked and retry available', () => {
    render(
      <QuizBlock
        block={mixedBlock}
        outcome={{ attempts: 1, correct: false, lastAnswer: [[1], [0]], completedAt: 1000 }}
      />,
    )
    expect(screen.getByTestId('quiz-summary').getAttribute('data-correct')).toBe('false')
    expect(resultFor(0).getAttribute('data-correct')).toBe('false')
    const q0 = optionsFor(0)
    expect(q0[1].getAttribute('data-correctness')).toBe('incorrect-selected')
    expect(q0[0].getAttribute('data-correctness')).toBe('correct')
    expect(screen.getByTestId('quiz-retry')).toBeTruthy()
  })

  it('does not rehydrate as submitted when the outcome has no recorded answer', () => {
    render(<QuizBlock block={mixedBlock} outcome={{ attempts: 0 }} />)
    expect(screen.queryByTestId('quiz-summary')).toBeNull()
    expect(submitButton().disabled).toBe(true)
  })

  it('does not rehydrate when the stored answer shape does not match the question count', () => {
    render(
      <QuizBlock
        block={mixedBlock}
        outcome={{ attempts: 1, correct: true, lastAnswer: [[0]], completedAt: 1000 }}
      />,
    )
    expect(screen.queryByTestId('quiz-summary')).toBeNull()
    expect(submitButton().disabled).toBe(true)
  })

  it('handles a single-question block end to end', () => {
    const onOutcome = vi.fn()
    render(<QuizBlock block={singleOnlyBlock} onOutcome={onOutcome} />)
    expect(screen.getAllByTestId('quiz-question')).toHaveLength(1)
    fireEvent.click(optionsFor(0)[0])
    fireEvent.click(submitButton())
    expect(onOutcome).toHaveBeenCalledWith({ correct: true, lastAnswer: [[0]] })
    expect(screen.getByTestId('quiz-summary').getAttribute('data-correct')).toBe('true')
  })
})
