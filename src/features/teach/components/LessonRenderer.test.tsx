import { act, cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlockOutcome, Lesson, LessonState } from '@/lib/teach/lessons/lesson'
import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { RetrievalStoreLike } from '@/features/teach/hooks/use-block-outcome'
import { LessonRenderer } from './LessonRenderer'

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

function makeRetrievalStore(initial: RetrievalItem[] = []) {
  let items = initial
  return {
    list: vi.fn(async () => items),
    save: vi.fn(async (next: RetrievalItem[]) => {
      items = next
    }),
    current: () => items,
  } satisfies RetrievalStoreLike & { current: () => RetrievalItem[] }
}

const baseState: LessonState = { status: 'unstarted', blockProgress: {} }

function makeLesson(blocks: Lesson['blocks'], state: LessonState = baseState): Lesson {
  return {
    id: '0001',
    title: 'let vs var',
    missionLink: 'build a CLI',
    skillFocus: 'declare bindings',
    zpdRationale: 'knows nothing yet',
    blocks,
    citations: [],
    state,
    createdAt: 1,
  }
}

/**
 * Stands in for `repo.recordBlockOutcome(lesson.id, …)`: merges a block's
 * outcome into the seeded lesson's progress and returns the updated lesson, the
 * same atomic contract the renderer relies on.
 */
function makeRecorder(lesson: Lesson) {
  let current = lesson
  const record = vi.fn(async (blockId: string, outcome: BlockOutcome) => {
    current = {
      ...current,
      state: {
        ...current.state,
        status: current.state.status === 'completed' ? 'completed' : 'in_progress',
        blockProgress: { ...current.state.blockProgress, [blockId]: outcome },
      },
    }
    return current
  })
  return { record, current: () => current }
}

describe('lessonRenderer', () => {
  it('renders each block in order', () => {
    const lesson = makeLesson([
      { type: 'heading', level: 2, text: 'Bindings' },
      { type: 'prose', markdown: 'let binds an immutable value' },
      { type: 'code_sample', code: 'let x = 1', language: 'cangjie' },
    ])
    const { container } = render(
      <LessonRenderer lesson={lesson} record={vi.fn(async () => null)} retrievalStore={makeRetrievalStore()} now={() => 1} />,
    )
    expect(screen.getByTestId('heading-block')).toBeTruthy()
    expect(screen.getByTestId('prose-block')).toBeTruthy()
    expect(screen.getByTestId('code-sample-block')).toBeTruthy()

    const rendered = container.querySelectorAll('[data-block-index]')
    expect([...rendered].map(el => el.getAttribute('data-block-type'))).toEqual([
      'heading',
      'prose',
      'code_sample',
    ])
  })

  it('dispatches an oj block to the OJ component', () => {
    const lesson = makeLesson([
      {
        type: 'oj',
        mode: 'stdio',
        title: 'Echo',
        prompt: 'Read a line and print it.',
        starterCode: 'main() {}',
        testCases: [{ stdin: 'hi', expectedOutput: 'hi', visible: true }],
        matchMode: 'exact',
      },
    ])
    const { container } = render(
      <LessonRenderer lesson={lesson} record={vi.fn(async () => null)} retrievalStore={makeRetrievalStore()} now={() => 1} />,
    )
    const wrapper = container.querySelector('[data-block-type="oj"]')
    expect(wrapper).toBeTruthy()
  })

  it('renders a safe placeholder for an unknown block type and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Bypass the typed blocks array — a persisted lesson could carry a block
    // type this client version does not understand.
    const lesson = makeLesson([{ type: 'mystery', foo: 1 } as never])
    render(<LessonRenderer lesson={lesson} record={vi.fn(async () => null)} retrievalStore={makeRetrievalStore()} now={() => 1} />)
    expect(screen.getByTestId('unknown-block')).toBeTruthy()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('writes a quiz outcome back through the atomic recorder and seeds retrieval', async () => {
    const retrievalStore = makeRetrievalStore()
    const lesson = makeLesson([
      {
        type: 'quiz',
        questions: [
          {
            question: 'Which keyword binds an immutable value?',
            options: ['let binds', 'var binds'],
            answerIndices: [0],
            multiple: false,
            explanation: 'let is immutable.',
          },
        ],
      },
    ])
    const { record, current } = makeRecorder(lesson)
    render(<LessonRenderer lesson={lesson} record={record} retrievalStore={retrievalStore} now={() => 1000} />)

    fireEvent.click(screen.getAllByTestId('quiz-option')[0])
    await act(async () => {
      fireEvent.click(screen.getByTestId('quiz-submit'))
    })

    expect(record).toHaveBeenCalled()
    // block index 0 → blockId b0
    const [blockId, outcome] = record.mock.calls.at(-1)!
    expect(blockId).toBe('b0')
    expect(outcome.correct).toBe(true)
    expect(current().state.status).toBe('in_progress')
    expect(current().state.blockProgress.b0.correct).toBe(true)

    const items = retrievalStore.current()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ lessonId: '0001', blockId: 'b0', kind: 'quiz' })
  })

  it('updates retrieval for a recall block via self-grade', async () => {
    const retrievalStore = makeRetrievalStore()
    const lesson = makeLesson([
      { type: 'recall_prompt', prompt: 'How to declare an immutable binding?', answer: 'use let' },
    ])
    const { record } = makeRecorder(lesson)
    render(<LessonRenderer lesson={lesson} record={record} retrievalStore={retrievalStore} now={() => 2000} />)

    fireEvent.click(screen.getByTestId('recall-reveal'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('recall-grade-good'))
    })

    const items = retrievalStore.current()
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('recall')
    expect(items[0].blockId).toBe('b0')
  })

  it('rehydrates a block from prior progress', () => {
    const lesson = makeLesson(
      [
        {
          type: 'quiz',
          questions: [
            {
              question: 'q',
              options: ['a a', 'b b'],
              answerIndices: [0],
              multiple: false,
              explanation: 'e',
            },
          ],
        },
      ],
      { status: 'in_progress', blockProgress: { b0: { attempts: 1, correct: true, lastAnswer: [[0]], completedAt: 1000 } } },
    )
    render(<LessonRenderer lesson={lesson} record={vi.fn(async () => null)} retrievalStore={makeRetrievalStore()} now={() => 1} />)
    // The quiz block itself owns its UI; the renderer forwards the prior outcome
    // so a completed block re-hydrates as already-answered rather than fresh.
    expect(screen.getByTestId('quiz-block')).toBeTruthy()
    expect(screen.queryByTestId('quiz-submit')).toBeNull()
    expect(screen.getByTestId('quiz-result').getAttribute('data-correct')).toBe('true')
    expect((screen.getAllByTestId('quiz-option')[0] as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
  })
})
