import type {
  ChatIntentKind,
  ClassroomEvent,
  ClassroomPhase,
  ClassroomSession,
  ContentReference,
  ExerciseAttemptMode,
  ExerciseInstance,
  ExerciseMatchMode,
  LearningEvidence,
  ReviewArtifact,
  RunResult,
} from './types'
import { evidenceStrengthForExerciseAttempt } from './exercise-attempt-evidence'
import type { ExerciseAttemptEvidenceInput } from './exercise-attempt-evidence'
import { getChatIntentQueueBlock } from './chat-intent-guards'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'

export type ClassroomAction
  = | { type: 'APPEND_CONTENT_REFERENCE_GROUP', conceptId: string, blockIds: string[], skillId?: string, title?: string, now?: number }
    | { type: 'APPEND_BRIDGE_NOTE', conceptIds: string[], body: string, now?: number }
    | { type: 'APPEND_SKIP_MARKER', conceptId: string, blockIds: string[], reason: string, now?: number }
    | { type: 'CREATE_EXERCISE_INSTANCE', exercise: Omit<ExerciseInstance, 'id' | 'createdAt' | 'status'> & Partial<Pick<ExerciseInstance, 'id' | 'createdAt' | 'status'>>, now?: number }
    | { type: 'EXERCISE_RUN_FINISHED', result: RunResult, attemptedCode?: string, now?: number }
    | { type: 'EXERCISE_SUBMIT_FINISHED', result: RunResult, attemptedCode?: string, attempt?: ExerciseAttemptEvidenceInput, now?: number }
    | { type: 'EXERCISE_SUCCESS', attempt?: ExerciseAttemptEvidenceInput, now?: number }
    | { type: 'EXERCISE_SKIP', now?: number }
    | { type: 'SAVE_REVIEW_ARTIFACT', artifact: Omit<ReviewArtifact, 'artifactId' | 'createdAt'> & Partial<Pick<ReviewArtifact, 'artifactId' | 'createdAt'>>, emitMarker?: boolean, now?: number }
    | { type: 'REMOVE_REVIEW_ARTIFACT', artifactId: string, now?: number }
    | { type: 'RESTORE_REVIEW_ARTIFACT', artifactId: string, now?: number }
    | { type: 'LESSON_GENERATION_FAILED', error: string, now?: number }
    | { type: 'CLEAR_LESSON_GENERATION_ERRORS', now?: number }
    | { type: 'SET_PHASE', phase: ClassroomPhase, now?: number }
    | { type: 'EMIT_CHAT_INTENT', intent: ChatIntentKind, summary: string, activeConceptId?: string, now?: number }
    | { type: 'CONSUME_EVENT', now?: number }
    | { type: 'BATCH', actions: ClassroomAction[], now?: number }

type ExerciseInstanceInput = Omit<ExerciseInstance, 'id' | 'createdAt' | 'status'> & Partial<Pick<ExerciseInstance, 'id' | 'createdAt' | 'status'>>

interface InitialSessionOptions {
  lang: string
}

interface ExerciseEvaluation {
  matched: boolean
  expected: string
  actual: string
  diff?: string
}

function resolveActionTime(value?: number): number {
  return value ?? Date.now()
}

function createStreamItemId(prefix: string, createdAt: number, streamIndex: number): string {
  return `${prefix}:${createdAt}:${streamIndex}`
}

function trimTrailing(text: string): string {
  return text.replace(/\s+$/u, '')
}

function summarize(text: string): string {
  return text.length > 320 ? `${text.slice(0, 317)}...` : text
}

export function createInitialClassroomSession({ lang }: InitialSessionOptions): ClassroomSession {
  const pack = getDefaultCourseContentIndex().pack
  return {
    version: 3,
    lang,
    phase: 'orient',
    contentPackId: pack.packId,
    contentVersion: pack.contentVersion,
    stream: [],
    learner: {
      evidence: [],
      reviewExposures: {},
      reviewArtifacts: [],
    },
    currentExercise: null,
    lastRun: null,
    sessionSummary: `Fresh AI classroom session for ${lang}.`,
    eventQueue: [],
    track: {
      activeTrackId: pack.tracks[0]?.trackId ?? 'default-entry',
      targetConceptId: pack.tracks[0]?.conceptIds[0] ?? null,
      targetSkillId: pack.tracks[0]?.skillIds[0] ?? null,
      adjustments: [],
    },
  }
}

export function evaluateExerciseOutput(exercise: Pick<ExerciseInstance, 'expectedOutput' | 'matchMode'>, output: string): ExerciseEvaluation {
  const expected = trimTrailing(exercise.expectedOutput)
  const actual = trimTrailing(output)
  const mode: ExerciseMatchMode = exercise.matchMode ?? 'exact'
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

function referencesForBlockIds(blockIds: string[]): ContentReference[] {
  const index = getDefaultCourseContentIndex()
  const order = new Map(index.pack.blocks.map(block => [block.blockId, block.order]))
  return blockIds
    .map(blockId => index.getBlock(blockId))
    .filter(block => block != null)
    .sort((a, b) => {
      if (a.conceptId === b.conceptId)
        return (order.get(a.blockId) ?? 0) - (order.get(b.blockId) ?? 0)
      const trackOrder = index.pack.tracks[0]?.conceptIds ?? []
      return trackOrder.indexOf(a.conceptId) - trackOrder.indexOf(b.conceptId)
    })
    .map(block => ({
      packId: index.pack.packId,
      contentVersion: block.contentVersion,
      blockId: block.blockId,
      conceptId: block.conceptId,
    }))
}

function withSeenExposures(session: ClassroomSession, references: ContentReference[], createdAt: number): ClassroomSession {
  const nextExposures = { ...session.learner.reviewExposures }
  for (const ref of references) {
    nextExposures[ref.blockId] = {
      blockId: ref.blockId,
      conceptId: ref.conceptId,
      contentVersion: ref.contentVersion,
      status: 'seen',
      updatedAt: createdAt,
    }
  }
  return {
    ...session,
    learner: {
      ...session.learner,
      reviewExposures: nextExposures,
    },
  }
}

function withoutLessonGenerationErrorMarkers(session: ClassroomSession): ClassroomSession {
  const stream = session.stream.filter(item =>
    item.type !== 'system_event' || item.event.type !== 'lesson_generation_error',
  )
  return stream.length === session.stream.length
    ? session
    : { ...session, stream }
}

function transitionContentReferenceGroupAppended(
  session: ClassroomSession,
  conceptId: string,
  blockIds: string[],
  skillId: string | undefined,
  title: string | undefined,
  createdAt: number,
): ClassroomSession {
  const references = referencesForBlockIds(blockIds).filter(ref => ref.conceptId === conceptId)
  if (references.length === 0)
    return session
  const baseSession = withoutLessonGenerationErrorMarkers(session)

  const appended: ClassroomSession = {
    ...baseSession,
    phase: 'teach',
    sessionSummary: summarize(`Content Reference Group appended for ${conceptId}.`),
    track: {
      ...baseSession.track,
      targetConceptId: conceptId,
      targetSkillId: skillId ?? baseSession.track.targetSkillId,
    },
    stream: [
      ...baseSession.stream,
      {
        id: createStreamItemId('content-group', createdAt, baseSession.stream.length),
        type: 'content_reference_group',
        groupId: createStreamItemId('group', createdAt, baseSession.stream.length),
        conceptId,
        skillId,
        title,
        references,
        createdAt,
      },
    ],
  }

  return withSeenExposures(appended, references, createdAt)
}

function transitionBridgeNoteAppended(session: ClassroomSession, conceptIds: string[], body: string, createdAt: number): ClassroomSession {
  const baseSession = withoutLessonGenerationErrorMarkers(session)
  return {
    ...baseSession,
    sessionSummary: summarize(`Bridge Note added for ${conceptIds.join(', ')}.`),
    stream: [
      ...baseSession.stream,
      {
        id: createStreamItemId('bridge', createdAt, baseSession.stream.length),
        type: 'bridge_note',
        conceptIds,
        body,
        createdAt,
      },
    ],
  }
}

function transitionSkipMarkerAppended(session: ClassroomSession, conceptId: string, blockIds: string[], reason: string, createdAt: number): ClassroomSession {
  const baseSession = withoutLessonGenerationErrorMarkers(session)
  const index = getDefaultCourseContentIndex()
  const reviewExposures = { ...baseSession.learner.reviewExposures }
  for (const blockId of blockIds) {
    const block = index.getBlock(blockId)
    if (!block || block.conceptId !== conceptId)
      continue
    reviewExposures[blockId] = {
      blockId,
      conceptId,
      contentVersion: block.contentVersion,
      status: 'skipped',
      updatedAt: createdAt,
    }
  }

  return {
    ...baseSession,
    learner: {
      ...baseSession.learner,
      reviewExposures,
    },
    stream: [
      ...baseSession.stream,
      {
        id: createStreamItemId('skip', createdAt, baseSession.stream.length),
        type: 'skip_marker',
        conceptId,
        blockIds,
        reason,
        createdAt,
      },
    ],
  }
}

function transitionExerciseCreated(
  session: ClassroomSession,
  exerciseInput: ExerciseInstanceInput,
  createdAt: number,
): ClassroomSession {
  const baseSession = withoutLessonGenerationErrorMarkers(session)
  const input = exerciseInput
  const streamIndex = baseSession.stream.length
  const exercise: ExerciseInstance = {
    ...input,
    id: input.id ?? createStreamItemId('exercise', createdAt, streamIndex),
    status: input.status ?? 'active',
    createdAt: input.createdAt ?? createdAt,
  }
  const stream = baseSession.stream.map(item =>
    item.type === 'exercise_instance' && item.exercise.status === 'active'
      ? { ...item, exercise: { ...item.exercise, status: 'superseded' as const } }
      : item,
  )

  return {
    ...baseSession,
    phase: 'practice',
    currentExercise: exercise,
    sessionSummary: summarize(`Exercise Instance active for ${exercise.skillId}.`),
    track: {
      ...baseSession.track,
      targetConceptId: exercise.conceptIds[0] ?? baseSession.track.targetConceptId,
      targetSkillId: exercise.skillId,
    },
    stream: [
      ...stream,
      {
        id: exercise.id,
        type: 'exercise_instance',
        exercise,
        createdAt,
      },
    ],
  }
}

function updateCurrentExerciseStatus(session: ClassroomSession, status: ExerciseInstance['status']): ClassroomSession {
  const exercise = session.currentExercise
  if (!exercise)
    return session
  return {
    ...session,
    currentExercise: { ...exercise, status },
    stream: session.stream.map(item =>
      item.type === 'exercise_instance' && item.exercise.id === exercise.id
        ? { ...item, exercise: { ...item.exercise, status } }
        : item,
    ),
  }
}

function transitionRunFinished(
  session: ClassroomSession,
  result: RunResult,
  attemptMode: ExerciseAttemptMode,
  createdAt: number,
): { session: ClassroomSession, matched: boolean | undefined, runResultId: string } {
  const exercise = session.currentExercise
  const matched = exercise?.status === 'active'
    ? result.ok && evaluateExerciseOutput(exercise, result.stdout).matched
    : undefined
  const runResultId = createStreamItemId('run', createdAt, session.stream.length)
  const recordedResult: RunResult = { ...result, attemptMode }

  return {
    matched,
    runResultId,
    session: {
      ...session,
      lastRun: recordedResult,
      sessionSummary: summarize(`Last run ${result.ok ? 'completed' : 'failed'}${matched ? ' and matched the current exercise' : ''}.`),
      stream: [
        ...session.stream,
        {
          id: runResultId,
          type: 'run_result',
          exerciseInstanceId: exercise?.id,
          result: recordedResult,
          matched,
          createdAt,
        },
      ],
    },
  }
}

function buildEvidence(
  exercise: ExerciseInstance,
  outcome: LearningEvidence['outcome'],
  strength: LearningEvidence['strength'],
  summary: string,
  createdAt: number,
  evidenceIndex: number,
  runResultId?: string,
): LearningEvidence {
  return {
    evidenceId: createStreamItemId('evidence', createdAt, evidenceIndex),
    skillId: exercise.skillId,
    conceptIds: exercise.conceptIds,
    exerciseInstanceId: exercise.id,
    exerciseIntent: exercise.intent,
    outcome,
    strength,
    summary,
    createdAt,
    runResultId,
  }
}

function appendEvidence(session: ClassroomSession, evidence: LearningEvidence, createdAt: number): ClassroomSession {
  return {
    ...session,
    learner: {
      ...session.learner,
      evidence: [
        ...session.learner.evidence,
        evidence,
      ],
    },
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('evidence-marker', createdAt, session.stream.length),
        type: 'learning_evidence_marker',
        evidenceId: evidence.evidenceId,
        conceptId: evidence.conceptIds[0] ?? 'unknown',
        skillId: evidence.skillId,
        exerciseIntent: evidence.exerciseIntent,
        outcome: evidence.outcome,
        strength: evidence.strength,
        summary: evidence.summary,
        createdAt,
      },
    ],
  }
}

function transitionExerciseCompleted(
  session: ClassroomSession,
  outcome: 'success' | 'skip',
  createdAt: number,
  runResultId?: string,
  attempt?: ExerciseAttemptEvidenceInput,
): ClassroomSession {
  const exercise = session.currentExercise
  if (!exercise || exercise.status !== 'active')
    return session

  const summary = outcome === 'success'
    ? `Exercise completed successfully for ${exercise.skillId}.`
    : `Exercise skipped for ${exercise.skillId}.`
  const event: ClassroomEvent = {
    type: outcome === 'success' ? 'exercise_success' : 'exercise_skip',
    exerciseInstanceId: exercise.id,
    exerciseIntent: exercise.intent,
    skillId: exercise.skillId,
    conceptIds: exercise.conceptIds,
    summary,
    createdAt,
  }
  const evidence = buildEvidence(
    exercise,
    outcome,
    evidenceStrengthForExerciseAttempt(outcome, attempt, { exerciseIntent: exercise.intent }),
    summary,
    createdAt,
    session.learner.evidence.length,
    runResultId,
  )

  const completed = updateCurrentExerciseStatus({
    ...session,
    sessionSummary: summarize(`${outcome} evidence recorded for ${exercise.skillId}.`),
    eventQueue: [...session.eventQueue, event],
  }, outcome)

  return appendEvidence(completed, evidence, createdAt)
}

function transitionExerciseFailureEnqueued(
  session: ClassroomSession,
  result: RunResult,
  attemptedCode: string | undefined,
  createdAt: number,
  runResultId?: string,
  attempt?: ExerciseAttemptEvidenceInput,
): ClassroomSession {
  const exercise = session.currentExercise
  if (!exercise || exercise.status !== 'active')
    return session

  const queuedFailureExists = session.eventQueue.some(
    e => e.type === 'exercise_failure' && e.exerciseInstanceId === exercise.id,
  )
  const actual = result.ok ? result.stdout : (result.stderr || result.stdout)
  const reason = result.ok ? 'mismatch' : 'run_failed'
  const summary = session.lang === 'en'
    ? `This submission did not pass: ${reason === 'mismatch' ? 'the output did not match the expected result' : 'the code did not run successfully'}. AI will provide the next suggestion.`
    : `这次提交没有通过：${reason === 'mismatch' ? '输出与预期不一致' : '代码没有成功运行'}。AI 会给出下一步建议。`
  const evidence = buildEvidence(
    exercise,
    'failure',
    evidenceStrengthForExerciseAttempt('failure', attempt, { exerciseIntent: exercise.intent }),
    summary,
    createdAt,
    session.learner.evidence.length,
    runResultId,
  )

  if (queuedFailureExists) {
    return appendEvidence({
      ...session,
      sessionSummary: summarize(`Additional exercise failure recorded for ${exercise.skillId}.`),
    }, evidence, createdAt)
  }

  const event: ClassroomEvent = {
    type: 'exercise_failure',
    exerciseInstanceId: exercise.id,
    exerciseIntent: exercise.intent,
    templateId: exercise.templateId,
    skillId: exercise.skillId,
    conceptIds: exercise.conceptIds,
    prompt: exercise.prompt,
    attemptedCode: attemptedCode ?? '',
    expectedOutput: exercise.expectedOutput,
    actualOutput: actual,
    summary,
    createdAt,
  }

  return appendEvidence({
    ...session,
    sessionSummary: summarize(`Exercise failure recorded for ${exercise.skillId}, awaiting remediation.`),
    eventQueue: [...session.eventQueue, event],
  }, evidence, createdAt)
}

function transitionLessonGenerationFailed(session: ClassroomSession, error: string, createdAt: number): ClassroomSession {
  const event: ClassroomEvent = {
    type: 'lesson_generation_error',
    summary: error,
    createdAt,
  }

  return {
    ...session,
    sessionSummary: summarize(`Lesson orchestration failed: ${error}`),
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('generation-error', createdAt, session.stream.length),
        type: 'system_event',
        event,
        createdAt,
      },
    ],
  }
}

function transitionReviewArtifactSaved(
  session: ClassroomSession,
  artifactInput: Omit<ReviewArtifact, 'artifactId' | 'createdAt'> & Partial<Pick<ReviewArtifact, 'artifactId' | 'createdAt'>>,
  emitMarker: boolean | undefined,
  createdAt: number,
): ClassroomSession {
  const baseSession = withoutLessonGenerationErrorMarkers(session)
  const artifact: ReviewArtifact = {
    ...artifactInput,
    artifactId: artifactInput.artifactId ?? createStreamItemId('artifact', createdAt, baseSession.learner.reviewArtifacts.length),
    createdAt: artifactInput.createdAt ?? createdAt,
  }

  const nextSession: ClassroomSession = {
    ...baseSession,
    learner: {
      ...baseSession.learner,
      reviewArtifacts: [
        ...baseSession.learner.reviewArtifacts.filter(existing => existing.artifactId !== artifact.artifactId),
        artifact,
      ],
    },
    sessionSummary: summarize(`Review Artifact saved for ${artifact.conceptId}: ${artifact.summary}`),
  }

  if (emitMarker === false)
    return nextSession

  return {
    ...nextSession,
    stream: [
      ...nextSession.stream,
      {
        id: createStreamItemId('retention', createdAt, nextSession.stream.length),
        type: 'retention_marker',
        artifactId: artifact.artifactId,
        conceptId: artifact.conceptId,
        kind: artifact.kind,
        summary: artifact.summary,
        createdAt,
      },
    ],
  }
}

function transitionReviewArtifactRemoved(session: ClassroomSession, artifactId: string, createdAt: number): ClassroomSession {
  let removed = false
  const reviewArtifacts = session.learner.reviewArtifacts.map((artifact) => {
    if (artifact.artifactId !== artifactId || artifact.removedAt != null)
      return artifact
    removed = true
    return { ...artifact, removedAt: createdAt }
  })

  if (!removed)
    return session

  return {
    ...session,
    sessionSummary: summarize(`Review Artifact removed: ${artifactId}`),
    learner: {
      ...session.learner,
      reviewArtifacts,
    },
  }
}

function transitionReviewArtifactRestored(session: ClassroomSession, artifactId: string): ClassroomSession {
  let restored = false
  const reviewArtifacts = session.learner.reviewArtifacts.map((artifact) => {
    if (artifact.artifactId !== artifactId || artifact.removedAt == null)
      return artifact
    restored = true
    const restoredArtifact = { ...artifact }
    delete restoredArtifact.removedAt
    return restoredArtifact
  })

  if (!restored)
    return session

  return {
    ...session,
    sessionSummary: summarize(`Review Artifact restored: ${artifactId}`),
    learner: {
      ...session.learner,
      reviewArtifacts,
    },
  }
}

function transitionChatIntentQueued(
  session: ClassroomSession,
  intent: ChatIntentKind,
  summary: string,
  activeConceptId: string | undefined,
  createdAt: number,
): ClassroomSession {
  if (getChatIntentQueueBlock(session, intent))
    return session

  const queuedTail = session.eventQueue.at(-1)
  if (
    queuedTail?.type === 'chat_intent'
    && queuedTail.intent === intent
    && queuedTail.summary === summary
  ) {
    return session
  }

  const event: ClassroomEvent = {
    type: 'chat_intent',
    intent,
    summary,
    activeConceptId,
    createdAt,
  }

  return {
    ...session,
    sessionSummary: summarize(`Chat intent queued: ${summary}`),
    eventQueue: [...session.eventQueue, event],
    stream: [
      ...session.stream,
      {
        id: createStreamItemId('event', createdAt, session.stream.length),
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
    case 'APPEND_CONTENT_REFERENCE_GROUP':
      return transitionContentReferenceGroupAppended(session, action.conceptId, action.blockIds, action.skillId, action.title, createdAt)
    case 'APPEND_BRIDGE_NOTE':
      return transitionBridgeNoteAppended(session, action.conceptIds, action.body, createdAt)
    case 'APPEND_SKIP_MARKER':
      return transitionSkipMarkerAppended(session, action.conceptId, action.blockIds, action.reason, createdAt)
    case 'CREATE_EXERCISE_INSTANCE':
      return transitionExerciseCreated(session, action.exercise, createdAt)
    case 'EXERCISE_RUN_FINISHED': {
      const finished = transitionRunFinished(session, action.result, 'run', createdAt)
      return finished.session
    }
    case 'EXERCISE_SUBMIT_FINISHED': {
      const finished = transitionRunFinished(session, action.result, 'submit', createdAt)
      if (action.result.failureKind === 'runner_unavailable')
        return finished.session
      if (finished.matched)
        return transitionExerciseCompleted(finished.session, 'success', createdAt, finished.runResultId, action.attempt)
      return transitionExerciseFailureEnqueued(finished.session, action.result, action.attemptedCode, createdAt, finished.runResultId, action.attempt)
    }
    case 'EXERCISE_SUCCESS':
      return transitionExerciseCompleted(session, 'success', createdAt, undefined, action.attempt)
    case 'EXERCISE_SKIP':
      return transitionExerciseCompleted(session, 'skip', createdAt)
    case 'SAVE_REVIEW_ARTIFACT':
      return transitionReviewArtifactSaved(session, action.artifact, action.emitMarker, createdAt)
    case 'REMOVE_REVIEW_ARTIFACT':
      return transitionReviewArtifactRemoved(session, action.artifactId, createdAt)
    case 'RESTORE_REVIEW_ARTIFACT':
      return transitionReviewArtifactRestored(session, action.artifactId)
    case 'LESSON_GENERATION_FAILED':
      return transitionLessonGenerationFailed(session, action.error, createdAt)
    case 'CLEAR_LESSON_GENERATION_ERRORS':
      return withoutLessonGenerationErrorMarkers(session)
    case 'SET_PHASE':
      return { ...session, phase: action.phase }
    case 'EMIT_CHAT_INTENT':
      return transitionChatIntentQueued(session, action.intent, action.summary, action.activeConceptId, createdAt)
    case 'CONSUME_EVENT':
      return transitionEventConsumed(session)
    default: {
      const _exhaustive: never = action
      void _exhaustive
      return session
    }
  }
}
