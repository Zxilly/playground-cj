import { describe, expect, it } from 'vitest'
import {
  classroomReducer,
  createInitialClassroomSession,
  evaluateExerciseOutput,
} from './reducer'
import { createCodeSuggestionAssistance } from './exercise-attempt-evidence'
import type { ClassroomAction } from './reducer'
import { deriveConceptProgressEntries, deriveSessionPendingWork } from './selectors'
import type { ExerciseInstance, RunResult } from './types'

const exerciseInput: ClassroomAction = {
  type: 'CREATE_EXERCISE_INSTANCE',
  exercise: {
    templateId: 'cj.io.println.print-value.cangjie',
    templateVersion: '2026-05-28',
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    prompt: 'Print Cangjie.',
    starterCode: 'main() {\n    println("TODO")\n}',
    expectedOutput: 'Cangjie',
    matchMode: 'exact',
    intent: 'mainline',
    personalizationInputs: {
      summary: 'test exercise',
      difficulty: 1,
    },
  },
  now: 1002,
}

const failedRun: RunResult = {
  ok: true,
  stdout: 'wrong\n',
  stderr: '',
  exitCode: 0,
  durationMs: 11,
}

describe('classroom reducer v3', () => {
  it('initializes a fresh session around a reusable content pack', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })

    expect(session.version).toBe(3)
    expect(session.phase).toBe('orient')
    expect(session.contentPackId).toBe('default-entry')
    expect(session.stream).toEqual([])
    expect(session.currentExercise).toBeNull()
    expect(session.learner).toEqual({
      evidence: [],
      reviewExposures: {},
      reviewArtifacts: [],
    })
    expect(deriveSessionPendingWork(session)).toBe('none')
  })

  it('appends validated content references and records review exposure', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.output', 'cj.io.println.heading'],
      skillId: 'cj.io.println.print-value',
      now: 1001,
    })

    expect(session.phase).toBe('teach')
    expect(session.stream).toHaveLength(1)
    expect(session.stream[0]).toMatchObject({
      id: 'content-group:1001:0',
      type: 'content_reference_group',
      conceptId: 'cj.io.println',
      references: [
        expect.objectContaining({ blockId: 'cj.io.println.heading' }),
        expect.objectContaining({ blockId: 'cj.io.println.output' }),
      ],
    })
    expect(session.learner.reviewExposures['cj.io.println.heading']).toMatchObject({
      status: 'seen',
      conceptId: 'cj.io.println',
    })
  })

  it('removes stale lesson generation error markers once new classroom content is produced', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'LESSON_GENERATION_FAILED',
      error: 'network failed',
      now: 1001,
    })

    expect(session.stream).toHaveLength(1)
    expect(session.stream[0]).toMatchObject({
      type: 'system_event',
      event: {
        type: 'lesson_generation_error',
      },
    })

    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      skillId: 'cj.io.println.print-value',
      now: 1002,
    })

    expect(session.stream).toHaveLength(1)
    expect(session.stream[0]).toMatchObject({
      id: 'content-group:1002:0',
      type: 'content_reference_group',
      conceptId: 'cj.io.println',
    })
    expect(session.stream.some(item => item.type === 'system_event' && item.event.type === 'lesson_generation_error')).toBe(false)
  })

  it('can clear stale lesson generation errors after a successful no-op retry', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Explain println again.',
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'LESSON_GENERATION_FAILED',
      error: 'network failed',
      now: 1002,
    })

    expect(session.stream.some(item => item.type === 'system_event' && item.event.type === 'lesson_generation_error')).toBe(true)

    session = classroomReducer(session, {
      type: 'CLEAR_LESSON_GENERATION_ERRORS',
      now: 1003,
    })

    expect(session.eventQueue).toHaveLength(1)
    expect(session.stream).toEqual([
      expect.objectContaining({
        type: 'system_event',
        event: expect.objectContaining({ type: 'chat_intent' }),
      }),
    ])
  })

  it('creates exercise instances and supersedes the previous active exercise', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, exerciseInput)
    session = classroomReducer(session, {
      ...exerciseInput,
      now: 1003,
      exercise: {
        ...exerciseInput.exercise,
        templateId: 'cj.var.immutable.choose-let.answer',
        skillId: 'cj.var.immutable.choose-let',
        conceptIds: ['cj.var.immutable'],
        expectedOutput: '42',
      },
    })

    expect(session.phase).toBe('practice')
    expect(session.currentExercise).toMatchObject({
      id: 'exercise:1003:1',
      skillId: 'cj.var.immutable.choose-let',
      status: 'active',
    })
    expect(session.stream.filter(item => item.type === 'exercise_instance').map(item => item.exercise.status))
      .toEqual(['superseded', 'active'])
    expect(deriveSessionPendingWork(session)).toBe('awaiting_user')
  })

  it('records a run result without turning it into evidence', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, {
      type: 'EXERCISE_RUN_FINISHED',
      result: failedRun,
      now: 1003,
    })

    expect(session.currentExercise?.status).toBe('active')
    expect(session.lastRun).toEqual({ ...failedRun, attemptMode: 'run' })
    expect(session.learner.evidence).toEqual([])
    expect(session.eventQueue).toEqual([])
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: false,
      result: {
        attemptMode: 'run',
      },
    })
  })

  it('turns a successful submit into independent evidence and an event', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: 'Cangjie\n' },
      now: 1003,
    })

    expect(session.currentExercise?.status).toBe('success')
    expect(session.lastRun).toMatchObject({ attemptMode: 'submit' })
    expect(session.learner.evidence).toEqual([
      expect.objectContaining({
        conceptIds: ['cj.io.println'],
        skillId: 'cj.io.println.print-value',
        exerciseIntent: 'mainline',
        outcome: 'success',
        strength: 'independent',
      }),
    ])
    expect(session.eventQueue).toEqual([
      expect.objectContaining({
        type: 'exercise_success',
        exerciseIntent: 'mainline',
        conceptIds: ['cj.io.println'],
      }),
    ])
    expect(session.stream.at(-1)).toMatchObject({
      type: 'learning_evidence_marker',
      exerciseIntent: 'mainline',
      outcome: 'success',
    })
    expect(session.stream.find(item => item.type === 'run_result')).toMatchObject({
      type: 'run_result',
      result: {
        attemptMode: 'submit',
      },
    })
  })

  it('turns a successful submit after applied assistance into aided evidence', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: 'Cangjie\n' },
      attempt: {
        assistance: [createCodeSuggestionAssistance(1003)],
      },
      now: 1004,
    })

    expect(session.currentExercise?.status).toBe('success')
    expect(session.learner.evidence).toEqual([
      expect.objectContaining({
        outcome: 'success',
        strength: 'aided',
      }),
    ])
    expect(session.stream.at(-1)).toMatchObject({
      type: 'learning_evidence_marker',
      outcome: 'success',
      strength: 'aided',
    })
  })

  it('records failed submit evidence and coalesces repeated failure events', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: failedRun,
      attemptedCode: 'attempt-1',
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: 'still wrong\n' },
      attemptedCode: 'attempt-2',
      now: 1004,
    })

    expect(session.currentExercise?.status).toBe('active')
    expect(session.learner.evidence.map(e => e.outcome)).toEqual(['failure', 'failure'])
    expect(session.eventQueue).toHaveLength(1)
    expect(session.eventQueue[0]).toMatchObject({
      type: 'exercise_failure',
      exerciseIntent: 'mainline',
      attemptedCode: 'attempt-1',
      expectedOutput: 'Cangjie',
    })
  })

  it('keeps runner outages out of learning evidence when submit cannot complete', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: {
        ok: false,
        stdout: '',
        stderr: 'Remote action failed: runner unavailable',
        exitCode: null,
        failureKind: 'runner_unavailable',
      },
      attemptedCode: 'attempt-1',
      now: 1003,
    })

    expect(session.currentExercise?.status).toBe('active')
    expect(session.learner.evidence).toEqual([])
    expect(session.eventQueue).toEqual([])
    expect(session.lastRun).toMatchObject({
      attemptMode: 'submit',
      failureKind: 'runner_unavailable',
    })
    expect(session.stream.at(-1)).toMatchObject({
      type: 'run_result',
      matched: false,
      result: {
        attemptMode: 'submit',
        failureKind: 'runner_unavailable',
      },
    })
  })

  it('guards chat intents from bypassing active exercises or queued generation', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    for (const intent of ['advance', 'change_topic', 'review_check'] as const) {
      expect(classroomReducer(session, {
        type: 'EMIT_CHAT_INTENT',
        intent,
        summary: `Learner requested ${intent}.`,
        now: 1003,
      })).toBe(session)
    }
    expect(session.eventQueue).toEqual([])

    const withHelpQueued = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner wants help with the active exercise.',
      now: 1004,
    })

    expect(withHelpQueued.eventQueue).toEqual([
      expect.objectContaining({
        type: 'chat_intent',
        intent: 'go_deeper',
      }),
    ])

    expect(classroomReducer(withHelpQueued, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'slow_down',
      summary: 'Learner also wants this slower.',
      now: 1005,
    })).toBe(withHelpQueued)
  })

  it('creates distinct evidence ids for repeated attempts in the same millisecond', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: failedRun,
      attemptedCode: 'attempt-1',
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: 'still wrong\n' },
      attemptedCode: 'attempt-2',
      now: 1003,
    })

    const evidenceIds = session.learner.evidence.map(evidence => evidence.evidenceId)
    expect(evidenceIds).toEqual(['evidence:1003:0', 'evidence:1003:1'])
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length)
  })

  it('records skip evidence without model-assigned progress', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseInput)

    session = classroomReducer(session, { type: 'EXERCISE_SKIP', now: 1003 })

    expect(session.currentExercise?.status).toBe('skip')
    expect(session.learner.evidence).toEqual([
      expect.objectContaining({
        outcome: 'skip',
        strength: 'self_report',
      }),
    ])
    expect(session.eventQueue).toEqual([
      expect.objectContaining({ type: 'exercise_skip', exerciseIntent: 'mainline' }),
    ])
  })

  it('keeps review check intent on generated exercise events', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      ...exerciseInput,
      exercise: {
        ...exerciseInput.exercise,
        intent: 'review_check',
      },
    })

    const failed = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: failedRun,
      attemptedCode: 'attempt-review',
      now: 1003,
    })

    expect(failed.eventQueue[0]).toMatchObject({
      type: 'exercise_failure',
      exerciseIntent: 'review_check',
    })
    expect(failed.learner.evidence[0]).toMatchObject({
      exerciseIntent: 'review_check',
      outcome: 'failure',
    })
    expect(failed.stream.at(-1)).toMatchObject({
      type: 'learning_evidence_marker',
      exerciseIntent: 'review_check',
      outcome: 'failure',
    })

    const passed = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: 'Cangjie\n' },
      now: 1004,
    })

    expect(passed.eventQueue[0]).toMatchObject({
      type: 'exercise_success',
      exerciseIntent: 'review_check',
    })
    expect(passed.learner.evidence[0]).toMatchObject({
      exerciseIntent: 'review_check',
      outcome: 'success',
      strength: 'mastery',
    })
    expect(passed.stream.at(-1)).toMatchObject({
      type: 'learning_evidence_marker',
      exerciseIntent: 'review_check',
      outcome: 'success',
      strength: 'mastery',
    })
    expect(deriveConceptProgressEntries(passed).find(entry => entry.conceptId === 'cj.io.println')).toMatchObject({
      status: 'mastered',
      readiness: 'ready_for_next',
    })
  })

  it('keeps aided review check success below mastery', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      ...exerciseInput,
      exercise: {
        ...exerciseInput.exercise,
        intent: 'review_check',
      },
    })

    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ...failedRun, stdout: 'Cangjie\n' },
      attempt: {
        assistance: [createCodeSuggestionAssistance(1004)],
      },
      now: 1004,
    })

    expect(session.learner.evidence[0]).toMatchObject({
      exerciseIntent: 'review_check',
      outcome: 'success',
      strength: 'aided',
    })
    expect(deriveConceptProgressEntries(session).find(entry => entry.conceptId === 'cj.io.println')).toMatchObject({
      status: 'demonstrated',
    })
  })

  it('saves retained review artifacts separately from core content', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })

    session = classroomReducer(session, {
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Why println',
        body: 'Personalized reminder.',
        summary: 'clarifies println',
        evidenceIds: [],
      },
      now: 1001,
    })
    const artifactId = session.learner.reviewArtifacts[0].artifactId
    session = classroomReducer(session, {
      type: 'REMOVE_REVIEW_ARTIFACT',
      artifactId,
      now: 1002,
    })
    const streamLengthAfterRemoval = session.stream.length

    expect(session.stream.at(-1)).toMatchObject({
      type: 'retention_marker',
      artifactId,
    })
    expect(session.learner.reviewArtifacts[0]).toMatchObject({
      artifactId,
      removedAt: 1002,
    })
    expect(session.sessionSummary).toBe(`Review Artifact removed: ${artifactId}`)

    const removedSession = session
    expect(classroomReducer(removedSession, {
      type: 'REMOVE_REVIEW_ARTIFACT',
      artifactId,
      now: 1003,
    })).toBe(removedSession)
    expect(classroomReducer(removedSession, {
      type: 'REMOVE_REVIEW_ARTIFACT',
      artifactId: 'missing-artifact',
      now: 1003,
    })).toBe(removedSession)

    session = classroomReducer(session, {
      type: 'RESTORE_REVIEW_ARTIFACT',
      artifactId,
      now: 1003,
    })

    expect(session.stream).toHaveLength(streamLengthAfterRemoval)
    expect(session.learner.reviewArtifacts[0]).toMatchObject({
      artifactId,
      title: 'Why println',
    })
    expect(session.learner.reviewArtifacts[0].removedAt).toBeUndefined()
  })

  it('safely handles invalid regex expectations', () => {
    const exercise: Pick<ExerciseInstance, 'expectedOutput' | 'matchMode'> = {
      expectedOutput: '[',
      matchMode: 'regex',
    }

    expect(() => evaluateExerciseOutput(exercise, '123')).not.toThrow()
    expect(evaluateExerciseOutput(exercise, '123')).toMatchObject({
      matched: false,
      diff: expect.stringContaining('Invalid regex'),
    })
  })
})
