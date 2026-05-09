import { describe, expect, it } from 'vitest'
import {
  deriveClassroomPendingState,
  deriveSessionPendingWork,
} from './selectors'
import { createInitialClassroomSession, classroomReducer } from './reducer'
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
