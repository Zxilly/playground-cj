import { describe, expect, it, vi } from 'vitest'
import {
  classroomReducer,
  createInitialClassroomSession,
  evaluateQuizOutput,
} from './reducer'
import { deriveSessionPendingWork } from './selectors'
import type { ClassroomSession, LessonContentBlock, RunResult } from './types'

const quizBlock: LessonContentBlock = {
  type: 'quiz',
  conceptId: 'cj.bindings.let',
  prompt: 'Print the value 3.',
  starterCode: 'main() {\n    println(0)\n}',
  expectedOutput: '3',
  matchMode: 'exact',
}

const secondQuizBlock: LessonContentBlock = {
  type: 'quiz',
  conceptId: 'cj.bindings.var',
  prompt: 'Print the value 4.',
  starterCode: 'main() {\n    println(0)\n}',
  expectedOutput: '4',
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
    const session = createInitialClassroomSession({ lang: 'zh' })

    expect(session.phase).toBe('orient')
    expect(deriveSessionPendingWork(session)).toBe('none')
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
    expect(Object.keys(session)).toEqual([
      'version',
      'lang',
      'phase',
      'stream',
      'learner',
      'currentQuiz',
      'lastRun',
      'sessionSummary',
      'eventQueue',
    ])
  })

  it('supports orient to teach to practice as explicit reducer transitions', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Let bindings', level: 2 }],
      now: 1002,
    })
    expect(session.phase).toBe('teach')
    expect(deriveSessionPendingWork(session)).toBe('none')
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

  it('creates deterministic stream item ids from action order and timestamp', () => {
    const initial = createInitialClassroomSession({ lang: 'zh' })
    const action = {
      type: 'APPEND_LESSON_CONTENT' as const,
      blocks: [{ type: 'heading' as const, text: 'Let bindings', level: 2 as const }],
      now: 1002,
    }

    const first = classroomReducer(initial, action)
    const second = classroomReducer(initial, action)

    expect(first.stream[0].id).toBe(second.stream[0].id)
    expect(first.stream[0].id).toBe('lesson:1002:0')
  })

  it('keeps same-timestamp stream item ids unique within a session', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'First', level: 2 }],
      now: 1002,
    })
    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Second', level: 2 }],
      now: 1002,
    })

    expect(session.stream.map(item => item.id)).toEqual([
      'lesson:1002:0',
      'lesson:1002:1',
    ])
  })

  it('marks concept cards as introduced without downgrading stronger statuses', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [
        {
          type: 'concept_card',
          conceptId: 'cj.bindings.let',
          title: 'Let bindings',
          body: 'Use let for immutable bindings.',
        },
      ],
      now: 1001,
    })
    expect(session.learner.concepts['cj.bindings.let'].status).toBe('introduced')

    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1002,
    })
    expect(session.learner.concepts['cj.bindings.let'].status).toBe('practicing')

    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [
        {
          type: 'concept_card',
          conceptId: 'cj.bindings.let',
          title: 'Let bindings again',
          body: 'A reminder.',
        },
      ],
      now: 1003,
    })
    expect(session.learner.concepts['cj.bindings.let'].status).toBe('practicing')
  })

  it('supersedes the previous active quiz when a new quiz is set', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: secondQuizBlock,
      now: 1002,
    })

    const quizStatuses = session.stream
      .filter(item => item.type === 'quiz')
      .map(item => item.quiz.status)
    expect(quizStatuses).toEqual(['superseded', 'active'])
    expect(session.currentQuiz).toMatchObject({
      conceptId: 'cj.bindings.var',
      status: 'active',
    })
  })

  it('completes only the current quiz on submit when two quizzes share a timestamp', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: secondQuizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'QUIZ_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: '4\n' },
      now: 1002,
    })

    const quizStatuses = session.stream
      .filter(item => item.type === 'quiz')
      .map(item => item.quiz.status)
    expect(quizStatuses).toEqual(['superseded', 'success'])
  })

  it('appends a failed quiz run result without evidence or LessonGeneration event', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, { type: 'QUIZ_RUN_FINISHED', result: failedRun, now: 1002 })

    expect(evaluateQuizOutput(session.currentQuiz!, failedRun.stdout).matched).toBe(false)
    expect(session.currentQuiz?.status).toBe('active')
    expect(session.lastRun).toEqual(failedRun)
    expect(session.learner.evidence).toEqual([])
    expect(session.eventQueue).toEqual([])
    expect(deriveSessionPendingWork(session)).toBe('awaiting_user')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      result: failedRun,
    })
  })

  it('appends a matched quiz run without completing the quiz', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
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

    expect(session.currentQuiz?.status).toBe('active')
    expect(session.lastRun).toEqual({ ...failedRun, stdout: '3\n' })
    expect(session.learner.evidence).toEqual([])
    expect(session.eventQueue).toEqual([])
    expect(deriveSessionPendingWork(session)).toBe('awaiting_user')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: true,
    })
  })

  it('does not mark a non-zero run as quiz matched even when stdout matches', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
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
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: false,
    })
  })

  it('treats an invalid regex quiz expectation as a safe non-match', () => {
    const regexQuiz = {
      id: 'quiz:1000:0',
      conceptId: 'cj.regex',
      prompt: 'Print digits.',
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

  it('finishes a successful quiz submit atomically with evidence and LessonGeneration event', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'QUIZ_SUBMIT_FINISHED',
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

  it('does not complete a quiz from a failed submit even when stdout matches, and enqueues a quiz_failure for the agent to explain', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'SET_CURRENT_QUIZ',
      quiz: quizBlock,
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'QUIZ_SUBMIT_FINISHED',
      result: {
        ok: false,
        stdout: '3\n',
        stderr: 'runtime failure',
        exitCode: 1,
      },
      attemptedCode: 'main() { Println(2) }',
      now: 1002,
    })

    expect(session.currentQuiz?.status).toBe('active')
    expect(session.learner.evidence).toEqual([])
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: false,
    })
    // Failure flows into the event queue so lesson generation can write a
    // targeted explanation block rather than letting the learner sit stuck.
    expect(session.eventQueue).toHaveLength(1)
    expect(session.eventQueue[0]).toMatchObject({
      type: 'quiz_failure',
      conceptId: 'cj.bindings.let',
      attemptedCode: 'main() { Println(2) }',
      expectedOutput: '3',
      actualOutput: 'runtime failure',
    })
  })

  it('coalesces repeated failures on the same active quiz so the agent is not asked to explain the identical mistake twice', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1001 })
    session = classroomReducer(session, {
      type: 'QUIZ_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
      attemptedCode: 'attempt-1',
      now: 1002,
    })
    expect(session.eventQueue).toHaveLength(1)

    session = classroomReducer(session, {
      type: 'QUIZ_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'still-wrong\n', stderr: '', exitCode: 0 },
      attemptedCode: 'attempt-2',
      now: 1003,
    })
    expect(session.eventQueue).toHaveLength(1)
    expect(session.eventQueue[0]).toMatchObject({ type: 'quiz_failure', attemptedCode: 'attempt-1' })
  })

  it('quiz skip writes skip evidence and queues LessonGeneration without model involvement', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
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
    expect(deriveSessionPendingWork(session)).toBe('lesson_generation')
  })

  it('marks author failure without dropping queued events', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner asked for depth.',
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'LESSON_GENERATION_FAILED',
      error: 'network',
      now: 1002,
    })

    expect(session.eventQueue).toEqual([
      expect.objectContaining({ type: 'chat_intent', intent: 'go_deeper' }),
    ])
    // eventQueue is non-empty, so pendingWork is 'lesson_generation'
    expect(deriveSessionPendingWork(session)).toBe('lesson_generation')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'system_event',
      event: {
        type: 'lesson_generation_error',
        summary: 'network',
        createdAt: 1002,
      },
    })
  })

  it('dedupes repeated chat intent at the tail of the queue', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner asked for depth.',
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner asked for depth.',
      now: 1002,
    })

    expect(session.eventQueue).toHaveLength(1)
    expect(session.stream.filter(item => item.type === 'system_event')).toHaveLength(1)
  })

  it('commits generated content and consumes the queued event in order', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner asked for depth.',
      now: 1001,
    })

    session = classroomReducer(session, {
      type: 'BATCH',
      actions: [
        {
          type: 'APPEND_LESSON_CONTENT',
          blocks: [{ type: 'paragraph', body: 'More detail.' }],
          now: 1002,
        },
        {
          type: 'CONSUME_EVENT',
          now: 1003,
        },
      ],
    })

    expect(session.eventQueue).toEqual([])
    expect(deriveSessionPendingWork(session)).toBe('none')
    expect(session.stream.at(-1)).toMatchObject({
      type: 'lesson_blocks',
    })
  })

  it('quiz completion is a no-op when stream has no matching quiz item', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    const broken: ClassroomSession = {
      ...session,
      currentQuiz: {
        id: 'quiz:999:0',
        conceptId: 'c',
        prompt: 'p',
        starterCode: '',
        expectedOutput: '',
        matchMode: 'exact',
        status: 'active',
        createdAt: 999,
      },
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = classroomReducer(broken, { type: 'QUIZ_SKIP', now: 1000 })

    expect(result).toBe(broken)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no stream entry'))
    warn.mockRestore()
  })
})
