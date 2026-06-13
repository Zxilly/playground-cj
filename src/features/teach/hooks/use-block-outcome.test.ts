import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LessonState } from '@/lib/teach/lessons/lesson'
import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { RetrievalStoreLike } from './use-block-outcome'
import { useBlockOutcome } from './use-block-outcome'

function makeRetrievalStore(initial: RetrievalItem[] = []) {
  let items = initial
  const store: RetrievalStoreLike & { current: () => RetrievalItem[] } = {
    list: vi.fn(async () => items),
    save: vi.fn(async (next: RetrievalItem[]) => {
      items = next
    }),
    current: () => items,
  }
  return store
}

const emptyState: LessonState = { status: 'unstarted', blockProgress: {} }

describe('useBlockOutcome', () => {
  it('persists block progress and promotes the lesson to in_progress', async () => {
    const persist = vi.fn()
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, persist, retrievalStore, now: () => 1000 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true, lastAnswer: [0] })
    })

    expect(persist).toHaveBeenCalledTimes(1)
    const saved = persist.mock.calls[0][0] as LessonState
    expect(saved.status).toBe('in_progress')
    expect(saved.blockProgress.b0.correct).toBe(true)
    expect(saved.blockProgress.b0.attempts).toBe(1)
    expect(saved.blockProgress.b0.completedAt).toBe(1000)
    expect(saved.blockProgress.b0.lastAnswer).toEqual([0])
  })

  it('increments attempts across repeated outcomes for the same block', async () => {
    const persist = vi.fn()
    const retrievalStore = makeRetrievalStore()
    const state: LessonState = {
      status: 'in_progress',
      blockProgress: { b0: { attempts: 2, correct: false } },
    }
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state, persist, retrievalStore, now: () => 5 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true })
    })

    const saved = persist.mock.calls[0][0] as LessonState
    expect(saved.blockProgress.b0.attempts).toBe(3)
    expect(saved.blockProgress.b0.correct).toBe(true)
  })

  it('does not downgrade a completed lesson back to in_progress', async () => {
    const persist = vi.fn()
    const retrievalStore = makeRetrievalStore()
    const state: LessonState = { status: 'completed', blockProgress: {}, completedAt: 1 }
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state, persist, retrievalStore, now: () => 9 }))

    await act(async () => {
      await result.current('b1', 'recall_prompt', { grade: 'good', correct: true })
    })

    expect((persist.mock.calls[0][0] as LessonState).status).toBe('completed')
  })

  it('seeds a retrieval item for a quiz block on first correct answer', async () => {
    const persist = vi.fn()
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, persist, retrievalStore, now: () => 1000 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true })
    })

    const items = retrievalStore.current()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ lessonId: '0001', blockId: 'b0', kind: 'quiz' })
    expect(items[0].history.at(-1)?.grade).toBe('good')
    expect(items[0].dueAt).toBeGreaterThan(1000)
  })

  it('maps a recall again grade onto the schedule', async () => {
    const persist = vi.fn()
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, persist, retrievalStore, now: () => 1000 }))

    await act(async () => {
      await result.current('b2', 'recall_prompt', { grade: 'again', correct: false })
    })

    const items = retrievalStore.current()
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('recall')
    expect(items[0].intervalDays).toBe(1)
    expect(items[0].history.at(-1)?.grade).toBe('again')
  })

  it('advances an existing retrieval item instead of duplicating it', async () => {
    const persist = vi.fn()
    const existing: RetrievalItem = {
      id: '0001:b0',
      lessonId: '0001',
      blockId: 'b0',
      kind: 'quiz',
      dueAt: 0,
      intervalDays: 1,
      ease: 2.5,
      history: [{ at: 0, grade: 'good' }],
    }
    const retrievalStore = makeRetrievalStore([existing])
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, persist, retrievalStore, now: () => 2000 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true })
    })

    const items = retrievalStore.current()
    expect(items).toHaveLength(1)
    expect(items[0].history).toHaveLength(2)
    expect(items[0].intervalDays).toBeGreaterThan(1)
  })

  it('does not schedule retrieval for non-quiz/recall blocks', async () => {
    const persist = vi.fn()
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, persist, retrievalStore, now: () => 1 }))

    await act(async () => {
      await result.current('b0', 'code_task', { correct: true })
    })

    expect(retrievalStore.save).not.toHaveBeenCalled()
    expect(persist).toHaveBeenCalledTimes(1)
  })
})
