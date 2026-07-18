import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecallPromptBlockSchemaType } from '@/lib/teach/lessons/blocks'
import { RecallPromptBlock } from './RecallPromptBlock'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

const block: RecallPromptBlockSchemaType = {
  type: 'recall_prompt',
  prompt: 'How do you declare an immutable binding?',
  answer: 'Use let, e.g. let x = 1',
}

describe('recallPromptBlock', () => {
  it('renders the prompt and an answer input', () => {
    render(<RecallPromptBlock block={block} />)
    expect(screen.getByText(block.prompt)).toBeTruthy()
    expect(screen.getByTestId('recall-input')).toBeTruthy()
  })

  it('renders inline markdown in the prompt and revealed reference answer', () => {
    const markdownBlock: RecallPromptBlockSchemaType = {
      type: 'recall_prompt',
      prompt: 'What does **`let`** declare?',
      answer: 'An **immutable** binding.',
    }
    render(<RecallPromptBlock block={markdownBlock} />)
    const prompt = screen.getByTestId('recall-prompt')
    expect(prompt.querySelector('strong code')?.textContent).toBe('let')

    fireEvent.click(screen.getByTestId('recall-reveal'))
    const answer = screen.getByTestId('recall-answer')
    expect(answer.querySelector('strong')?.textContent).toBe('immutable')
    expect(answer.textContent).not.toContain('**')
    expect(answer.textContent).not.toContain('`')
  })

  it('hides the answer before reveal', () => {
    render(<RecallPromptBlock block={block} />)
    expect(screen.queryByTestId('recall-answer')).toBeNull()
  })

  it('shows the answer after pressing reveal', () => {
    render(<RecallPromptBlock block={block} />)
    fireEvent.click(screen.getByTestId('recall-reveal'))
    expect(screen.getByTestId('recall-answer').textContent).toContain('Use let')
  })

  it('shows self-assessment buttons only after reveal', () => {
    render(<RecallPromptBlock block={block} />)
    expect(screen.queryByTestId('recall-grade-good')).toBeNull()
    expect(screen.queryByTestId('recall-grade-again')).toBeNull()
    fireEvent.click(screen.getByTestId('recall-reveal'))
    expect(screen.getByTestId('recall-grade-good')).toBeTruthy()
    expect(screen.getByTestId('recall-grade-again')).toBeTruthy()
  })

  it('forwards a good grade with correct:true', () => {
    const onOutcome = vi.fn()
    render(<RecallPromptBlock block={block} onOutcome={onOutcome} />)
    fireEvent.click(screen.getByTestId('recall-reveal'))
    fireEvent.click(screen.getByTestId('recall-grade-good'))
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ grade: 'good', correct: true }))
  })

  it('forwards an again grade with correct:false', () => {
    const onOutcome = vi.fn()
    render(<RecallPromptBlock block={block} onOutcome={onOutcome} />)
    fireEvent.click(screen.getByTestId('recall-reveal'))
    fireEvent.click(screen.getByTestId('recall-grade-again'))
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ grade: 'again', correct: false }))
  })

  it('captures the learner attempt text in the outcome', () => {
    const onOutcome = vi.fn()
    render(<RecallPromptBlock block={block} onOutcome={onOutcome} />)
    fireEvent.change(screen.getByTestId('recall-input'), { target: { value: 'let keyword' } })
    fireEvent.click(screen.getByTestId('recall-reveal'))
    fireEvent.click(screen.getByTestId('recall-grade-good'))
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ lastAnswer: 'let keyword' }))
  })

  it('locks the answer input after reveal so the reference answer cannot be copied in', () => {
    render(<RecallPromptBlock block={block} />)
    const before = screen.getByTestId('recall-input') as HTMLTextAreaElement
    expect(before.readOnly).toBe(false)
    fireEvent.click(screen.getByTestId('recall-reveal'))
    expect((screen.getByTestId('recall-input') as HTMLTextAreaElement).readOnly).toBe(true)
  })

  it('keeps a rehydrated (already revealed) answer input locked', () => {
    render(
      <RecallPromptBlock
        block={block}
        outcome={{ attempts: 1, correct: true, lastAnswer: 'let keyword', completedAt: 1000 }}
      />,
    )
    expect((screen.getByTestId('recall-input') as HTMLTextAreaElement).readOnly).toBe(true)
  })

  it('reflects the chosen grade in the UI', () => {
    render(<RecallPromptBlock block={block} />)
    fireEvent.click(screen.getByTestId('recall-reveal'))
    fireEvent.click(screen.getByTestId('recall-grade-good'))
    expect(screen.getByTestId('recall-block').getAttribute('data-grade')).toBe('good')
  })

  it('rehydrates a completed outcome as revealed with the prior grade and attempt', () => {
    render(
      <RecallPromptBlock
        block={block}
        outcome={{ attempts: 1, correct: true, lastAnswer: 'let keyword', completedAt: 1000 }}
      />,
    )
    // Already revealed: answer visible, reveal button gone, grade restored.
    expect(screen.queryByTestId('recall-reveal')).toBeNull()
    expect(screen.getByTestId('recall-answer').textContent).toContain('Use let')
    expect(screen.getByTestId('recall-block').getAttribute('data-grade')).toBe('good')
    expect((screen.getByTestId('recall-input') as HTMLTextAreaElement).value).toBe('let keyword')
  })

  it('rehydrates an again grade from an incorrect completed outcome', () => {
    render(
      <RecallPromptBlock
        block={block}
        outcome={{ attempts: 1, correct: false, lastAnswer: '', completedAt: 1000 }}
      />,
    )
    expect(screen.getByTestId('recall-block').getAttribute('data-grade')).toBe('again')
  })

  it('does not rehydrate when the outcome is not completed', () => {
    render(<RecallPromptBlock block={block} outcome={{ attempts: 0 }} />)
    expect(screen.getByTestId('recall-reveal')).toBeTruthy()
    expect(screen.queryByTestId('recall-answer')).toBeNull()
  })
})

describe('recallPromptBlock with AI grading', () => {
  it('shows the submit-grade button (not the manual reveal) when a grader is wired', () => {
    const gradeRecall = vi.fn()
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} />)
    expect(screen.getByTestId('recall-submit-grade')).toBeTruthy()
    expect(screen.queryByTestId('recall-reveal')).toBeNull()
  })

  it('prevents empty or whitespace-only grading submissions and explains what is required', () => {
    const gradeRecall = vi.fn()
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} />)

    const input = screen.getByTestId('recall-input') as HTMLTextAreaElement
    const submit = screen.getByTestId('recall-submit-grade') as HTMLButtonElement
    const guidance = screen.getByTestId('recall-empty-guidance')
    expect(submit.disabled).toBe(true)
    expect(guidance.textContent).toContain('请先写下你的回答')
    expect(input.getAttribute('aria-describedby')).toBe(guidance.id)
    expect(submit.getAttribute('aria-describedby')).toBe(guidance.id)

    fireEvent.click(submit)
    expect(gradeRecall).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '   ' } })
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(gradeRecall).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'let keyword' } })
    expect(submit.disabled).toBe(false)
    expect(screen.queryByTestId('recall-empty-guidance')).toBeNull()
  })

  it('grades a correct answer: reveals reference, shows the verdict, reports onOutcome', async () => {
    const gradeRecall = vi.fn().mockResolvedValue({ correct: true, feedback: '答得不错。' })
    const onOutcome = vi.fn()
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} onOutcome={onOutcome} />)
    fireEvent.change(screen.getByTestId('recall-input'), { target: { value: 'let keyword' } })
    fireEvent.click(screen.getByTestId('recall-submit-grade'))

    await waitFor(() => expect(screen.getByTestId('recall-verdict')).toBeTruthy())
    expect(gradeRecall).toHaveBeenCalledWith({
      prompt: block.prompt,
      reference: block.answer,
      answer: 'let keyword',
    })
    expect(screen.getByTestId('recall-verdict').getAttribute('data-correct')).toBe('true')
    expect(screen.getByTestId('recall-feedback').textContent).toContain('答得不错')
    expect(screen.getByTestId('recall-answer').textContent).toContain('Use let')
    expect(onOutcome).toHaveBeenCalledWith({ correct: true, lastAnswer: 'let keyword' })
    // No manual self-grade buttons on a successful AI grade.
    expect(screen.queryByTestId('recall-grade-good')).toBeNull()
  })

  it('renders inline markdown in AI grading feedback', async () => {
    const gradeRecall = vi.fn().mockResolvedValue({
      correct: true,
      feedback: 'Correct: **`let`** creates an immutable binding.',
    })
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} />)
    fireEvent.change(screen.getByTestId('recall-input'), { target: { value: 'let' } })
    fireEvent.click(screen.getByTestId('recall-submit-grade'))

    await waitFor(() => expect(screen.getByTestId('recall-feedback')).toBeTruthy())
    const feedback = screen.getByTestId('recall-feedback')
    expect(feedback.querySelector('strong code')?.textContent).toBe('let')
    expect(feedback.textContent).not.toContain('**')
    expect(feedback.textContent).not.toContain('`')
  })

  it('grades an incorrect answer: shows a待加强 verdict and reports correct:false', async () => {
    const gradeRecall = vi.fn().mockResolvedValue({ correct: false, feedback: '缺少关键点。' })
    const onOutcome = vi.fn()
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} onOutcome={onOutcome} />)
    fireEvent.change(screen.getByTestId('recall-input'), { target: { value: 'something' } })
    fireEvent.click(screen.getByTestId('recall-submit-grade'))

    await waitFor(() => expect(screen.getByTestId('recall-verdict')).toBeTruthy())
    expect(screen.getByTestId('recall-verdict').getAttribute('data-correct')).toBe('false')
    expect(onOutcome).toHaveBeenCalledWith({ correct: false, lastAnswer: 'something' })
  })

  it('locks the input after submitting for grading', async () => {
    const gradeRecall = vi.fn().mockResolvedValue({ correct: true, feedback: 'ok' })
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} />)
    expect((screen.getByTestId('recall-input') as HTMLTextAreaElement).readOnly).toBe(false)
    fireEvent.change(screen.getByTestId('recall-input'), { target: { value: 'let keyword' } })
    fireEvent.click(screen.getByTestId('recall-submit-grade'))
    await waitFor(() =>
      expect((screen.getByTestId('recall-input') as HTMLTextAreaElement).readOnly).toBe(true),
    )
  })

  it('falls back to manual self-grading when grading errors', async () => {
    const gradeRecall = vi.fn().mockRejectedValue(new Error('network down'))
    const onOutcome = vi.fn()
    render(<RecallPromptBlock block={block} gradeRecall={gradeRecall} onOutcome={onOutcome} />)
    fireEvent.change(screen.getByTestId('recall-input'), { target: { value: 'let keyword' } })
    fireEvent.click(screen.getByTestId('recall-submit-grade'))

    // Error notice + reference answer + manual self-grade buttons appear.
    await waitFor(() => expect(screen.getByTestId('recall-grade-error')).toBeTruthy())
    expect(screen.getByTestId('recall-answer')).toBeTruthy()
    expect(screen.getByTestId('recall-grade-good')).toBeTruthy()
    // No AI verdict, and onOutcome not called yet — learner self-grades to proceed.
    expect(screen.queryByTestId('recall-verdict')).toBeNull()
    expect(onOutcome).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('recall-grade-good'))
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 'good', correct: true, lastAnswer: 'let keyword' }),
    )
  })
})
