import { describe, expect, it } from 'vitest'
import {
  deriveClassroomPendingState,
  deriveLatestHeading,
  deriveSessionPendingWork,
} from './selectors'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import type { ClassroomSession } from './types'

const baseSession = (): ClassroomSession => createInitialClassroomSession({ lang: 'zh' })

const quizBlock = {
  type: 'quiz' as const,
  conceptId: 'cj.let',
  prompt: [{ text: 'Print 3.' }],
  starterCode: 'main(){}',
  expectedOutput: '3',
  matchMode: 'exact' as const,
}

describe('deriveSessionPendingWork', () => {
  it('returns "none" for an empty session', () => {
    expect(deriveSessionPendingWork(baseSession())).toBe('none')
  })

  it('returns "lesson_generation" when eventQueue has items', () => {
    let session = baseSession()
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: '',
      now: 1,
    })
    expect(deriveSessionPendingWork(session)).toBe('lesson_generation')
  })

  it('returns "awaiting_user" when currentQuiz is active', () => {
    let session = baseSession()
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1 })
    expect(deriveSessionPendingWork(session)).toBe('awaiting_user')
  })

  it('prefers eventQueue over awaiting_user when both are present', () => {
    let session = baseSession()
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1 })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: '',
      now: 2,
    })
    expect(deriveSessionPendingWork(session)).toBe('lesson_generation')
  })
})

describe('deriveClassroomPendingState', () => {
  it('returns "runner" when runnerRunning is true (highest priority)', () => {
    expect(
      deriveClassroomPendingState(baseSession(), { generationRunning: true, runnerRunning: true }),
    ).toBe('runner')
  })

  it('returns "lesson_generation" when generationRunning is true', () => {
    expect(
      deriveClassroomPendingState(baseSession(), { generationRunning: true, runnerRunning: false }),
    ).toBe('lesson_generation')
  })

  it('falls back to deriveSessionPendingWork when no activity', () => {
    let session = baseSession()
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1 })
    expect(
      deriveClassroomPendingState(session, { generationRunning: false, runnerRunning: false }),
    ).toBe('awaiting_user')
  })

  it('returns "idle" for empty session and no activity', () => {
    expect(
      deriveClassroomPendingState(baseSession(), { generationRunning: false, runnerRunning: false }),
    ).toBe('idle')
  })
})

describe('deriveLatestHeading', () => {
  it('returns null when stream is empty', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    expect(deriveLatestHeading(session)).toBeNull()
  })

  it('returns the last heading text from the most recent lesson_blocks item', () => {
    const session = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      stream: [
        {
          id: 's1',
          type: 'lesson_blocks' as const,
          createdAt: 1,
          blocks: [
            { type: 'heading' as const, text: '第一章', level: 2 as const },
            { type: 'paragraph' as const, body: [{ text: 'intro' }] },
          ],
        },
        {
          id: 's2',
          type: 'lesson_blocks' as const,
          createdAt: 2,
          blocks: [
            { type: 'heading' as const, text: '第二章', level: 2 as const },
            { type: 'heading' as const, text: '2.1 子节', level: 3 as const },
            { type: 'paragraph' as const, body: [{ text: 'body' }] },
          ],
        },
      ],
    }
    expect(deriveLatestHeading(session)).toBe('2.1 子节')
  })

  it('skips non lesson_blocks items', () => {
    const session = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      stream: [
        {
          id: 's1',
          type: 'lesson_blocks' as const,
          createdAt: 1,
          blocks: [{ type: 'heading' as const, text: '只有这一条', level: 2 as const }],
        },
        {
          id: 's2',
          type: 'system_event' as const,
          createdAt: 2,
          event: { type: 'page_opened' as const, createdAt: 2 },
        },
      ],
    }
    expect(deriveLatestHeading(session)).toBe('只有这一条')
  })
})
