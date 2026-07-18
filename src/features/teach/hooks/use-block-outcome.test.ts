import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BlockOutcome, Lesson, LessonState } from '@/lib/teach/lessons/lesson'
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

/**
 * An in-memory stand-in for the atomic `repo.recordBlockOutcome(lessonId, ...)`
 * (bound to one lesson). It merges a single block's outcome into the lesson's
 * persisted `blockProgress` exactly like the real repository does — reading the
 * latest persisted state, not a caller snapshot — so it exercises the
 * lost-update fix: two block writes never clobber each other's progress.
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

function makeLesson(state: LessonState): Lesson {
  return {
    id: '0001',
    title: 't',
    missionLink: 'm',
    skillFocus: 's',
    zpdRationale: 'z',
    blocks: [{ type: 'prose', markdown: 'x' }],
    citations: [],
    state,
    createdAt: 1,
  }
}

const emptyState: LessonState = { status: 'unstarted', blockProgress: {} }

describe('useBlockOutcome', () => {
  it('records block progress atomically and promotes the lesson to in_progress', async () => {
    const { record, current } = makeRecorder(makeLesson(emptyState))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 1000 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true, lastAnswer: [0] })
    })

    expect(record).toHaveBeenCalledTimes(1)
    const [blockId, outcome] = record.mock.calls[0]
    expect(blockId).toBe('b0')
    expect(outcome).toMatchObject({ correct: true, attempts: 1, completedAt: 1000, lastAnswer: [0] })
    expect(current().state.status).toBe('in_progress')
    expect(current().state.blockProgress.b0.correct).toBe(true)
  })

  it('does not lose a prior block when a second block is answered', async () => {
    // The renderer's mount-time `state` closure only knows about b0. Answering b1
    // must NOT wipe b0: the atomic recorder merges against the *current* persisted
    // state, so both blocks survive. This is the #6/#14 lost-update regression.
    const stateWithB0: LessonState = {
      status: 'in_progress',
      blockProgress: { b0: { attempts: 1, correct: true, completedAt: 1 } },
    }
    const { record, current } = makeRecorder(makeLesson(stateWithB0))
    const retrievalStore = makeRetrievalStore()
    // The hook is mounted with a STALE snapshot that does not yet include b0 at
    // all (simulating the snapshot captured before b0 was answered).
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 2 }))

    await act(async () => {
      await result.current('b1', 'quiz', { correct: false })
    })

    const progress = current().state.blockProgress
    expect(progress.b0).toBeDefined()
    expect(progress.b0.correct).toBe(true)
    expect(progress.b1).toBeDefined()
    expect(progress.b1.correct).toBe(false)
  })

  it('serializes concurrent retrieval updates so quick answers do not lose a review item', async () => {
    const { record } = makeRecorder(makeLesson(emptyState))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 2 }))

    await act(async () => {
      await Promise.all([
        result.current('b0', 'quiz', { correct: true }),
        result.current('b1', 'recall_prompt', { grade: 'again', correct: false }),
      ])
    })

    expect(retrievalStore.current().map(item => item.id)).toEqual([
      '0001:b0',
      '0001:b1',
    ])
  })

  it('increments attempts across repeated outcomes for the same block', async () => {
    const state: LessonState = {
      status: 'in_progress',
      blockProgress: { b0: { attempts: 2, correct: false } },
    }
    const { record } = makeRecorder(makeLesson(state))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state, record, retrievalStore, now: () => 5 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true })
    })

    const [, outcome] = record.mock.calls[0]
    expect(outcome.attempts).toBe(3)
    expect(outcome.correct).toBe(true)
  })

  it('does not downgrade a completed lesson back to in_progress', async () => {
    const state: LessonState = { status: 'completed', blockProgress: {}, completedAt: 1 }
    const { record, current } = makeRecorder(makeLesson(state))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state, record, retrievalStore, now: () => 9 }))

    await act(async () => {
      await result.current('b1', 'recall_prompt', { grade: 'good', correct: true })
    })

    expect(current().state.status).toBe('completed')
  })

  it('seeds a retrieval item for a quiz block on first correct answer', async () => {
    const { record } = makeRecorder(makeLesson(emptyState))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 1000 }))

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
    const { record } = makeRecorder(makeLesson(emptyState))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 1000 }))

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
    const { record } = makeRecorder(makeLesson(emptyState))
    const retrievalStore = makeRetrievalStore([existing])
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 2000 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true })
    })

    const items = retrievalStore.current()
    expect(items).toHaveLength(1)
    expect(items[0].history).toHaveLength(2)
    expect(items[0].intervalDays).toBeGreaterThan(1)
  })

  it('does not schedule retrieval for non-quiz/recall blocks', async () => {
    const { record } = makeRecorder(makeLesson(emptyState))
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '0001', state: emptyState, record, retrievalStore, now: () => 1 }))

    await act(async () => {
      await result.current('b0', 'code_task', { correct: true })
    })

    expect(retrievalStore.save).not.toHaveBeenCalled()
    expect(record).toHaveBeenCalledTimes(1)
  })

  it('skips retrieval scheduling when the lesson no longer exists', async () => {
    // recordBlockOutcome returns null for a missing lesson; the hook should not
    // then seed a retrieval item for a lesson that is gone.
    const record = vi.fn(async () => null)
    const retrievalStore = makeRetrievalStore()
    const { result } = renderHook(() =>
      useBlockOutcome({ lessonId: '9999', state: emptyState, record, retrievalStore, now: () => 1 }))

    await act(async () => {
      await result.current('b0', 'quiz', { correct: true })
    })

    expect(retrievalStore.save).not.toHaveBeenCalled()
  })
})
