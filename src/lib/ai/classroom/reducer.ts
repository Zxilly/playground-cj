import type {
  ClassroomEvent,
  ClassroomPhase,
  ClassroomQuiz,
  ClassroomSession,
  ConceptState,
  EvidenceOutcome,
  LessonContentBlock,
  QuizMatchMode,
  RunResult,
} from './types'

export type ClassroomAction
  = | { type: 'LESSON_AUTHOR_STARTED', now?: number }
    | { type: 'APPEND_LESSON_CONTENT', blocks: LessonContentBlock[], now?: number }
    | { type: 'SET_CURRENT_QUIZ', quiz: Extract<LessonContentBlock, { type: 'quiz' }>, now?: number }
    | { type: 'RUN_STARTED', now?: number }
    | { type: 'RUN_FINISHED', result: RunResult, now?: number }
    | { type: 'QUIZ_RUN_FINISHED', result: RunResult, now?: number }
    | { type: 'QUIZ_SUCCESS', now?: number }
    | { type: 'QUIZ_SKIP', now?: number }
    | { type: 'LESSON_AUTHOR_FAILED', error: string, now?: number }
    | { type: 'SET_PHASE', phase: ClassroomPhase, now?: number }
    | { type: 'SET_LEARNING_NOTES', notes: string, now?: number }
    | { type: 'EMIT_CHAT_INTENT', intent: string, summary: string, now?: number }
    | { type: 'CONSUME_EVENT', now?: number }
    | { type: 'BATCH', actions: ClassroomAction[], now?: number }

interface InitialSessionOptions {
  lang: string
  now?: number
}

interface QuizEvaluation {
  matched: boolean
  expected: string
  actual: string
  diff?: string
}

function now(value?: number): number {
  return value ?? Date.now()
}

function id(prefix: string, createdAt: number): string {
  return `${prefix}:${createdAt}:${Math.random().toString(36).slice(2, 8)}`
}

function trimTrailing(text: string): string {
  return text.replace(/\s+$/u, '')
}

function conceptState(conceptId: string, status: ConceptState['status'], createdAt: number): ConceptState {
  return { conceptId, status, updatedAt: createdAt }
}

function summarize(text: string): string {
  return text.length > 320 ? `${text.slice(0, 317)}...` : text
}

function ensureConcept(session: ClassroomSession, conceptId: string, status: ConceptState['status'], createdAt: number): ClassroomSession {
  const current = session.learner.concepts[conceptId]
  if (current && current.status === status)
    return session

  return {
    ...session,
    learner: {
      ...session.learner,
      concepts: {
        ...session.learner.concepts,
        [conceptId]: conceptState(conceptId, status, createdAt),
      },
    },
  }
}

export function createInitialClassroomSession({ lang }: InitialSessionOptions): ClassroomSession {
  return {
    version: 1,
    lang,
    phase: 'orient',
    pendingAction: 'none',
    stream: [],
    learner: {
      concepts: {},
      evidence: [],
      learningNotes: '',
    },
    currentQuiz: null,
    lastRun: null,
    sessionSummary: `Fresh AI classroom session for ${lang}.`,
    eventQueue: [],
  }
}

export function evaluateQuizOutput(quiz: ClassroomQuiz, output: string): QuizEvaluation {
  const expected = trimTrailing(quiz.expectedOutput)
  const actual = trimTrailing(output)
  const mode: QuizMatchMode = quiz.matchMode ?? 'exact'
  let matched = false

  if (mode === 'contains') {
    matched = actual.includes(expected)
  }
  else if (mode === 'regex') {
    try {
      matched = new RegExp(expected).test(actual)
    }
    catch (error) {
      return {
        matched: false,
        expected,
        actual,
        diff: `Invalid regex: ${(error as Error).message}`,
      }
    }
  }
  else {
    matched = actual === expected
  }

  return {
    matched,
    expected,
    actual,
    diff: matched ? undefined : `expected: ${expected}\nactual: ${actual}`,
  }
}

function completeQuiz(session: ClassroomSession, outcome: EvidenceOutcome, createdAt: number): ClassroomSession {
  const quiz = session.currentQuiz
  if (!quiz || quiz.status !== 'active')
    return session

  const summary = outcome === 'success'
    ? `Quiz completed successfully for ${quiz.conceptId}.`
    : `Quiz skipped for ${quiz.conceptId}.`
  const event: ClassroomEvent = {
    type: outcome === 'success' ? 'quiz_success' : 'quiz_skip',
    conceptId: quiz.conceptId,
    summary,
    createdAt,
  }
  const conceptStatus: ConceptState['status'] = outcome === 'success' ? 'demonstrated' : 'practicing'

  const updated = ensureConcept({
    ...session,
    currentQuiz: { ...quiz, status: outcome },
    pendingAction: 'lesson_author',
    sessionSummary: summarize(`${outcome} evidence recorded for ${quiz.conceptId}.`),
    eventQueue: [...session.eventQueue, event],
    learner: {
      ...session.learner,
      evidence: [
        ...session.learner.evidence,
        {
          conceptId: quiz.conceptId,
          outcome,
          source: 'quiz',
          summary,
          createdAt,
        },
      ],
    },
    stream: [
      ...session.stream.map(item =>
        item.type === 'quiz' && item.quiz.createdAt === quiz.createdAt
          ? { ...item, quiz: { ...item.quiz, status: outcome } }
          : item,
      ),
      {
        id: id('progress', createdAt),
        type: 'progress_update',
        conceptId: quiz.conceptId,
        outcome,
        summary,
        createdAt,
      },
    ],
  }, quiz.conceptId, conceptStatus, createdAt)

  return updated
}

function finishRun(session: ClassroomSession, result: RunResult, createdAt: number): { session: ClassroomSession, matched: boolean | undefined } {
  const matched = session.currentQuiz?.status === 'active'
    ? result.ok && evaluateQuizOutput(session.currentQuiz, result.stdout).matched
    : undefined

  return {
    matched,
    session: {
      ...session,
      pendingAction: 'user',
      lastRun: result,
      sessionSummary: summarize(`Last run ${result.ok ? 'completed' : 'failed'}${matched ? ' and matched the current quiz' : ''}.`),
      stream: [
        ...session.stream,
        {
          id: id('run', createdAt),
          type: 'run_result',
          result,
          matched,
          createdAt,
        },
      ],
    },
  }
}

export function classroomReducer(session: ClassroomSession, action: ClassroomAction): ClassroomSession {
  const createdAt = now(action.now)

  switch (action.type) {
    case 'BATCH':
      return action.actions.reduce((nextSession, childAction) => classroomReducer(nextSession, childAction), session)

    case 'LESSON_AUTHOR_STARTED':
      return { ...session, pendingAction: 'lesson_author' }

    case 'APPEND_LESSON_CONTENT':
      return {
        ...session,
        phase: 'teach',
        pendingAction: 'none',
        sessionSummary: summarize(`LessonAuthor appended ${action.blocks.length} lesson block(s).`),
        stream: [
          ...session.stream,
          {
            id: id('lesson', createdAt),
            type: 'lesson_blocks',
            blocks: action.blocks,
            createdAt,
          },
        ],
      }

    case 'SET_CURRENT_QUIZ': {
      const quiz: ClassroomQuiz = {
        conceptId: action.quiz.conceptId,
        prompt: action.quiz.prompt,
        starterCode: action.quiz.starterCode,
        expectedOutput: action.quiz.expectedOutput,
        matchMode: action.quiz.matchMode ?? 'exact',
        status: 'active',
        createdAt,
      }
      return ensureConcept({
        ...session,
        phase: 'practice',
        pendingAction: 'user',
        currentQuiz: quiz,
        sessionSummary: summarize(`Practice quiz active for ${quiz.conceptId}.`),
        stream: [
          ...session.stream,
          {
            id: id('quiz', createdAt),
            type: 'quiz',
            quiz,
            createdAt,
          },
        ],
      }, quiz.conceptId, 'practicing', createdAt)
    }

    case 'RUN_STARTED':
      return { ...session, pendingAction: 'runner' }

    case 'RUN_FINISHED':
      return finishRun(session, action.result, createdAt).session

    case 'QUIZ_RUN_FINISHED': {
      const finished = finishRun(session, action.result, createdAt)
      return finished.matched
        ? completeQuiz(finished.session, 'success', createdAt)
        : finished.session
    }

    case 'QUIZ_SUCCESS':
      return completeQuiz(session, 'success', createdAt)

    case 'QUIZ_SKIP':
      return completeQuiz(session, 'skip', createdAt)

    case 'LESSON_AUTHOR_FAILED': {
      const event: ClassroomEvent = {
        type: 'lesson_author_error',
        summary: action.error,
        createdAt,
      }
      return {
        ...session,
        pendingAction: 'user',
        sessionSummary: summarize(`LessonAuthor failed: ${action.error}`),
        stream: [
          ...session.stream,
          {
            id: id('author-error', createdAt),
            type: 'system_event',
            event,
            createdAt,
          },
        ],
      }
    }

    case 'SET_PHASE':
      return { ...session, phase: action.phase }

    case 'SET_LEARNING_NOTES':
      return {
        ...session,
        learner: {
          ...session.learner,
          learningNotes: action.notes,
        },
      }

    case 'EMIT_CHAT_INTENT': {
      const event: ClassroomEvent = {
        type: 'chat_intent',
        intent: action.intent,
        summary: action.summary,
        createdAt,
      }
      return {
        ...session,
        pendingAction: 'lesson_author',
        sessionSummary: summarize(`Chat intent queued: ${action.summary}`),
        eventQueue: [...session.eventQueue, event],
        stream: [
          ...session.stream,
          {
            id: id('event', createdAt),
            type: 'system_event',
            event,
            createdAt,
          },
        ],
      }
    }

    case 'CONSUME_EVENT':
      return { ...session, eventQueue: session.eventQueue.slice(1) }
  }
}
