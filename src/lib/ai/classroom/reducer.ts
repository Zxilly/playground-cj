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
  = | { type: 'APPEND_LESSON_CONTENT', blocks: LessonContentBlock[], now?: number }
    | { type: 'SET_CURRENT_QUIZ', quiz: Extract<LessonContentBlock, { type: 'quiz' }>, now?: number }
    | { type: 'QUIZ_RUN_FINISHED', result: RunResult, now?: number }
    | { type: 'QUIZ_SUCCESS', now?: number }
    | { type: 'QUIZ_SKIP', now?: number }
    | { type: 'LESSON_GENERATION_FAILED', error: string, now?: number }
    | { type: 'SET_PHASE', phase: ClassroomPhase, now?: number }
    | { type: 'SET_LEARNING_NOTES', notes: string, now?: number }
    | { type: 'EMIT_CHAT_INTENT', intent: string, summary: string, now?: number }
    | { type: 'CONSUME_EVENT', now?: number }
    | { type: 'BATCH', actions: ClassroomAction[], now?: number }

interface InitialSessionOptions {
  lang: string
}

interface QuizEvaluation {
  matched: boolean
  expected: string
  actual: string
  diff?: string
}

function resolveActionTime(value?: number): number {
  return value ?? Date.now()
}

function createStreamItemId(prefix: string, createdAt: number): string {
  return `${prefix}:${createdAt}:${Math.random().toString(36).slice(2, 8)}`
}

function trimTrailing(text: string): string {
  return text.replace(/\s+$/u, '')
}

function createConceptState(conceptId: string, status: ConceptState['status'], createdAt: number): ConceptState {
  return { conceptId, status, updatedAt: createdAt }
}

function summarize(text: string): string {
  return text.length > 320 ? `${text.slice(0, 317)}...` : text
}

function transitionConceptStatus(
  session: ClassroomSession,
  conceptId: string,
  status: ConceptState['status'],
  createdAt: number,
): ClassroomSession {
  const current = session.learner.concepts[conceptId]
  if (current && current.status === status)
    return session

  return {
    ...session,
    learner: {
      ...session.learner,
      concepts: {
        ...session.learner.concepts,
        [conceptId]: createConceptState(conceptId, status, createdAt),
      },
    },
  }
}

export function createInitialClassroomSession({ lang }: InitialSessionOptions): ClassroomSession {
  return {
    version: 2,
    lang,
    phase: 'orient',
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

function transitionLessonContentAppended(
  session: ClassroomSession,
  blocks: LessonContentBlock[],
  createdAt: number,
): ClassroomSession {
  return {
    ...session,
    phase: 'teach',
    sessionSummary: summarize(`Lesson content appended ${blocks.length} block(s).`),
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('lesson', createdAt),
        type: 'lesson_blocks',
        blocks,
        createdAt,
      },
    ],
  }
}

function transitionQuizActivated(
  session: ClassroomSession,
  quizBlock: Extract<LessonContentBlock, { type: 'quiz' }>,
  createdAt: number,
): ClassroomSession {
  const quiz: ClassroomQuiz = {
    conceptId: quizBlock.conceptId,
    prompt: quizBlock.prompt,
    starterCode: quizBlock.starterCode,
    expectedOutput: quizBlock.expectedOutput,
    matchMode: quizBlock.matchMode ?? 'exact',
    status: 'active',
    createdAt,
  }

  return transitionConceptStatus({
    ...session,
    phase: 'practice',
    currentQuiz: quiz,
    sessionSummary: summarize(`Practice quiz active for ${quiz.conceptId}.`),
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('quiz', createdAt),
        type: 'quiz',
        quiz,
        createdAt,
      },
    ],
  }, quiz.conceptId, 'practicing', createdAt)
}

function transitionQuizCompleted(session: ClassroomSession, outcome: EvidenceOutcome, createdAt: number): ClassroomSession {
  const quiz = session.currentQuiz
  if (!quiz || quiz.status !== 'active')
    return session

  const streamHasQuiz = session.stream.some(
    item => item.type === 'quiz' && item.quiz.createdAt === quiz.createdAt,
  )
  if (!streamHasQuiz) {
    console.warn('[Classroom] currentQuiz exists but no stream entry, skipping transition')
    return session
  }

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

  const updated = transitionConceptStatus({
    ...session,
    currentQuiz: { ...quiz, status: outcome },
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
        id: createStreamItemId('progress', createdAt),
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

function transitionRunFinished(
  session: ClassroomSession,
  result: RunResult,
  createdAt: number,
): { session: ClassroomSession, matched: boolean | undefined } {
  const matched = session.currentQuiz?.status === 'active'
    ? result.ok && evaluateQuizOutput(session.currentQuiz, result.stdout).matched
    : undefined

  return {
    matched,
    session: {
      ...session,
      lastRun: result,
      sessionSummary: summarize(`Last run ${result.ok ? 'completed' : 'failed'}${matched ? ' and matched the current quiz' : ''}.`),
      stream: [
        ...session.stream,
        {
          id: createStreamItemId('run', createdAt),
          type: 'run_result',
          result,
          matched,
          createdAt,
        },
      ],
    },
  }
}

function transitionLessonGenerationFailed(session: ClassroomSession, error: string, createdAt: number): ClassroomSession {
  const event: ClassroomEvent = {
    type: 'lesson_generation_error',
    summary: error,
    createdAt,
  }

  return {
    ...session,
    sessionSummary: summarize(`Lesson generation failed: ${error}`),
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('generation-error', createdAt),
        type: 'system_event',
        event,
        createdAt,
      },
    ],
  }
}

function transitionLearningNotesUpdated(session: ClassroomSession, notes: string): ClassroomSession {
  return {
    ...session,
    learner: {
      ...session.learner,
      learningNotes: notes,
    },
  }
}

function transitionChatIntentQueued(
  session: ClassroomSession,
  intent: string,
  summary: string,
  createdAt: number,
): ClassroomSession {
  const event: ClassroomEvent = {
    type: 'chat_intent',
    intent,
    summary,
    createdAt,
  }

  return {
    ...session,
    sessionSummary: summarize(`Chat intent queued: ${summary}`),
    eventQueue: [...session.eventQueue, event],
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('event', createdAt),
        type: 'system_event',
        event,
        createdAt,
      },
    ],
  }
}

function transitionEventConsumed(session: ClassroomSession): ClassroomSession {
  return { ...session, eventQueue: session.eventQueue.slice(1) }
}

export function classroomReducer(session: ClassroomSession, action: ClassroomAction): ClassroomSession {
  const createdAt = resolveActionTime(action.now)

  switch (action.type) {
    case 'BATCH':
      return action.actions.reduce((nextSession, childAction) => classroomReducer(nextSession, childAction), session)
    case 'APPEND_LESSON_CONTENT':
      return transitionLessonContentAppended(session, action.blocks, createdAt)
    case 'SET_CURRENT_QUIZ':
      return transitionQuizActivated(session, action.quiz, createdAt)
    case 'QUIZ_RUN_FINISHED': {
      const finished = transitionRunFinished(session, action.result, createdAt)
      return finished.matched
        ? transitionQuizCompleted(finished.session, 'success', createdAt)
        : finished.session
    }
    case 'QUIZ_SUCCESS':
      return transitionQuizCompleted(session, 'success', createdAt)
    case 'QUIZ_SKIP':
      return transitionQuizCompleted(session, 'skip', createdAt)
    case 'LESSON_GENERATION_FAILED':
      return transitionLessonGenerationFailed(session, action.error, createdAt)
    case 'SET_PHASE':
      return { ...session, phase: action.phase }
    case 'SET_LEARNING_NOTES':
      return transitionLearningNotesUpdated(session, action.notes)
    case 'EMIT_CHAT_INTENT':
      return transitionChatIntentQueued(session, action.intent, action.summary, createdAt)
    case 'CONSUME_EVENT':
      return transitionEventConsumed(session)
    default: {
      const _exhaustive: never = action
      void _exhaustive
      return session
    }
  }
}
