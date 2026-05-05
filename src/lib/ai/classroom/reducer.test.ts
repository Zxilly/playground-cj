import { describe, expect, it } from 'vitest'
import {
  classroomReducer,
  createInitialClassroomSession,
  evaluateQuizOutput,
} from './reducer'
import type { LessonContentBlock, RunResult } from './types'

const quizBlock: LessonContentBlock = {
  type: 'quiz',
  conceptId: 'cj.bindings.let',
  prompt: [{ text: 'Print the value 3.' }],
  starterCode: 'main() {\n    println(0)\n}',
  expectedOutput: '3',
  matchMode: 'exact',
}

const failedRun: RunResult = {
  ok: true,
  stdout: '2\n',
  stderr: '',
  exitCode: 0,
  durationMs: 11,
}

describe('classroom reducer', () => {
  it('initializes a fresh classroom session without legacy lesson or chat state', () => {
    const session = createInitialClassroomSession({ lang: 'zh', now: 1000 })

    expect(session.phase).toBe('orient')
    expect(session.pendingAction).toBe('none')
    expect(session.stream).toEqual([])
    expect(session.currentQuiz).toBeNull()
    expect(session.lastRun).toBeNull()
    expect(session.eventQueue).toEqual([])
    expect(session.learner).toEqual({
      concepts: {},
      evidence: [],
      learningNotes: '',
    })
    expect(session.sessionSummary).toContain('zh')
    expect(JSON.stringify(session)).not.toContain('lesson-feed')
    expect(JSON.stringify(session)).not.toContain('thread')
  })

  it('supports orient to teach to practice as explicit reducer transitions', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })

    session = classroomReducer(session, {
      type: 'LESSON_AUTHOR_STARTED',
      now: 1001,
    })
    expect(session.pendingAction).toBe('lesson_author')
    expect(session.phase).toBe('orient')

    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Let bindings', level: 2 }],
      now: 1002,
    })
    expect(session.phase).toBe('teach')
    expect(session.pendingAction).toBe('none')
    expect(session.stream.at(-1)).toMatchObject({ type: 'lesson_blocks' })

    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1003,
    })
    expect(session.phase).toBe('practice')
    expect(session.currentQuiz).toMatchObject({
      status: 'active',
      conceptId: 'cj.bindings.let',
    })
    expect(session.learner.concepts['cj.bindings.let'].status).toBe('practicing')
  })

  it('appends a failed quiz run result without evidence or LessonAuthor event', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'RUN_FINISHED',
      result: failedRun,
      now: 1002,
    })

    expect(evaluateQuizOutput(session.currentQuiz!, failedRun.stdout).matched).toBe(false)
    expect(session.currentQuiz?.status).toBe('active')
    expect(session.lastRun).toEqual(failedRun)
    expect(session.learner.evidence).toEqual([])
    expect(session.eventQueue).toEqual([])
    expect(session.pendingAction).toBe('user')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      result: failedRun,
    })
  })

  it('does not mark a non-zero run as quiz matched even when stdout matches', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'RUN_FINISHED',
      result: {
        ok: false,
        stdout: '3\n',
        stderr: 'runtime failure',
        exitCode: 1,
      },
      now: 1002,
    })

    expect(session.currentQuiz?.status).toBe('active')
    expect(session.learner.evidence).toEqual([])
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: false,
    })
  })

  it('treats an invalid regex quiz expectation as a safe non-match', () => {
    const regexQuiz = {
      conceptId: 'cj.regex',
      prompt: [{ text: 'Print digits.' }],
      starterCode: 'main() {}',
      expectedOutput: '[',
      matchMode: 'regex' as const,
      status: 'active' as const,
      createdAt: 1000,
    }

    expect(() => evaluateQuizOutput(regexQuiz, '123')).not.toThrow()
    expect(evaluateQuizOutput(regexQuiz, '123')).toMatchObject({
      matched: false,
      diff: expect.stringContaining('Invalid regex'),
    })
  })

  it('quiz success writes deterministic evidence and queues LessonAuthor', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    expect(evaluateQuizOutput(session.currentQuiz!, '3\n').matched).toBe(true)
    session = classroomReducer(session, {
      type: 'RUN_FINISHED',
      result: { ...failedRun, stdout: '3\n' },
      now: 1002,
    })
    session = classroomReducer(session, {
      type: 'QUIZ_SUCCESS',
      now: 1003,
    })

    expect(session.currentQuiz?.status).toBe('success')
    expect(session.learner.evidence).toEqual([
      {
        conceptId: 'cj.bindings.let',
        outcome: 'success',
        source: 'quiz',
        summary: 'Quiz completed successfully for cj.bindings.let.',
        createdAt: 1003,
      },
    ])
    expect(session.learner.concepts['cj.bindings.let'].status).toBe('demonstrated')
    expect(session.eventQueue).toEqual([
      {
        type: 'quiz_success',
        conceptId: 'cj.bindings.let',
        summary: 'Quiz completed successfully for cj.bindings.let.',
        createdAt: 1003,
      },
    ])
    expect(session.pendingAction).toBe('lesson_author')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'progress_update',
      outcome: 'success',
      conceptId: 'cj.bindings.let',
    })
    expect(session.sessionSummary).toContain('success')
  })

  it('finishes a successful quiz run atomically with evidence and LessonAuthor event', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'QUIZ_RUN_FINISHED',
      result: { ...failedRun, stdout: '3\n' },
      now: 1002,
    })

    expect(session.currentQuiz?.status).toBe('success')
    expect(session.lastRun).toEqual({ ...failedRun, stdout: '3\n' })
    expect(session.learner.evidence).toEqual([
      expect.objectContaining({
        conceptId: 'cj.bindings.let',
        outcome: 'success',
        source: 'quiz',
      }),
    ])
    expect(session.eventQueue).toEqual([
      expect.objectContaining({
        type: 'quiz_success',
        conceptId: 'cj.bindings.let',
      }),
    ])
    expect(session.stream.at(-2)).toMatchObject({
      type: 'run_result',
      matched: true,
    })
    expect(session.stream.at(-1)).toMatchObject({
      type: 'progress_update',
      outcome: 'success',
    })
  })

  it('does not complete a quiz from a failed atomic run even when stdout matches', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'QUIZ_RUN_FINISHED',
      result: {
        ok: false,
        stdout: '3\n',
        stderr: 'runtime failure',
        exitCode: 1,
      },
      now: 1002,
    })

    expect(session.currentQuiz?.status).toBe('active')
    expect(session.learner.evidence).toEqual([])
    expect(session.eventQueue).toEqual([])
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: false,
    })
  })

  it('quiz skip writes skip evidence and queues LessonAuthor without model involvement', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'QUIZ_SKIP',
      now: 1002,
    })

    expect(session.currentQuiz?.status).toBe('skip')
    expect(session.learner.evidence).toEqual([
      {
        conceptId: 'cj.bindings.let',
        outcome: 'skip',
        source: 'quiz',
        summary: 'Quiz skipped for cj.bindings.let.',
        createdAt: 1002,
      },
    ])
    expect(session.eventQueue).toEqual([
      {
        type: 'quiz_skip',
        conceptId: 'cj.bindings.let',
        summary: 'Quiz skipped for cj.bindings.let.',
        createdAt: 1002,
      },
    ])
    expect(session.pendingAction).toBe('lesson_author')
  })

  it('marks author failure without dropping queued events', () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner asked for depth.',
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'LESSON_AUTHOR_FAILED',
      error: 'network',
      now: 1002,
    })

    expect(session.eventQueue).toEqual([
      expect.objectContaining({ type: 'chat_intent', intent: 'go_deeper' }),
    ])
    expect(session.pendingAction).toBe('user')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'system_event',
      event: {
        type: 'lesson_author_error',
        summary: 'network',
        createdAt: 1002,
      },
    })
  })
})
