import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
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
