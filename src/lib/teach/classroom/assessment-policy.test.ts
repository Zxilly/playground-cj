import { describe, expect, it } from 'vitest'
import {
  createAssessmentHistoryIndex,
  MAX_ELIGIBILITY_ASSISTANCE_EVENT_IDS,
} from './assessment-policy'
import {

  createEmptyClassroom,

} from './state'
import type { ClassroomSnapshot, ExerciseAssistanceEvent, ExerciseAttempt, ExerciseInstance } from './state'

function diagnostic(text: string) {
  const digest = text === ''
    ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  return {
    head: text,
    tail: '',
    sourceTruncated: false,
    originalUtf8Bytes: new TextEncoder().encode(text).byteLength,
    omittedUtf8Bytes: 0,
    sha256: digest,
    previewSha256: digest,
  }
}

function exercise(
  id: string,
  overrides: Partial<ExerciseInstance> = {},
): ExerciseInstance {
  return {
    id,
    type: 'exercise_instance',
    learningTrackId: 'track:1',
    tutoringStepId: `step:${id}`,
    conceptId: 'concept:bindings',
    learningSkillId: 'skill:declare-let',
    packId: 'pack:bindings',
    contentVersion: `cv:sha256:${'a'.repeat(64)}`,
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    templateId: 'template:practice',
    templateVersion: `cv:sha256:${'a'.repeat(64)}`,
    purpose: 'practice',
    personalizationInputs: {
      unresolvedFailureEvidenceIds: [],
      remediationArtifactIds: [],
    },
    personalizationPolicyVersion: 2,
    effectiveDifficulty: 'standard',
    task: {
      type: 'code_output',
      prompt: 'Print 42.',
      starterCode: 'main() {}',
      expectedOutput: '42',
      matchMode: 'exact',
      sourceRequirements: [{ type: 'top_level_main' }],
      hints: ['Use println.'],
    },
    createdAt: 1,
    recordedRevision: 1,
    ...overrides,
  }
}

function attempt(
  id: string,
  exerciseInstanceId: string,
  recordedRevision: number,
): ExerciseAttempt {
  return {
    id,
    exerciseInstanceId,
    assistanceEventIds: [],
    teacherExposureEpochId: null,
    submission: {
      type: 'code_output',
      code: 'main() { println(42) }',
    },
    result: {
      passed: true,
      runnerOk: true,
      phase: 'run',
      stdout: diagnostic('42'),
      stderr: diagnostic(''),
      compilerOutput: diagnostic(''),
      outputEvaluation: {
        matched: true,
        stdoutSha256: diagnostic('42').sha256,
        stdoutSourceTruncated: false,
      },
      exitCode: 0,
    },
    assistance: 'none',
    createdAt: recordedRevision,
    recordedRevision,
  }
}

function hint(
  id: string,
  exerciseInstanceId: string,
  recordedRevision: number,
): ExerciseAssistanceEvent {
  return {
    id,
    type: 'hint',
    exerciseInstanceId,
    hintIndex: 0,
    createdAt: recordedRevision,
    recordedRevision,
  }
}

describe('assessment history index', () => {
  it('carries identical forms across Learning Contract versions', () => {
    const original = exercise('exercise:original')
    const repeated = exercise('exercise:repeated', {
      learningContractVersion: `lc:sha256:${'c'.repeat(64)}`,
      templateId: 'template:renamed',
      templateVersion: `cv:sha256:${'d'.repeat(64)}`,
      contentVersion: `cv:sha256:${'d'.repeat(64)}`,
      recordedRevision: 4,
    })
    const snapshot: ClassroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 4,
      stream: [original, repeated],
      assistanceEvents: [hint('hint:1', original.id, 2)],
      attempts: [attempt('attempt:1', original.id, 3)],
    }

    const history = createAssessmentHistoryIndex(snapshot)
    expect(history.applicableAssistance(repeated, 5).map(event => event.id))
      .toEqual(['hint:1'])
    expect(history.wasPreviouslyAttempted(repeated, 5)).toBe(true)
    expect(history.expectedEvidenceType(repeated, {
      assistance: 'hint',
      recordedRevision: 5,
    })).toBe('aided')

    expect(history.projectCurrentEligibility(repeated)).toEqual({
      applicableAssistanceEventIds: ['hint:1'],
      applicableAssistanceEventCount: 1,
      applicableAssistanceEventIdsTruncated: false,
      applicableAssistanceTypes: ['hint'],
      teacherExposureActive: false,
      assessmentPreviouslyAttempted: true,
      expectedNextAssistance: 'hint',
      expectedNextEvidenceType: 'aided',
    })
  })

  it('projects repeated unassisted forms as Practice rather than Independent', () => {
    const original = exercise('exercise:original')
    const repeated = exercise('exercise:repeated', {
      learningContractVersion: `lc:sha256:${'c'.repeat(64)}`,
      templateId: 'template:renamed',
      recordedRevision: 3,
    })
    const history = createAssessmentHistoryIndex({
      ...createEmptyClassroom(),
      revision: 3,
      stream: [original, repeated],
      attempts: [attempt('attempt:1', original.id, 2)],
    })

    expect(history.projectCurrentEligibility(repeated)).toMatchObject({
      applicableAssistanceEventIds: [],
      assessmentPreviouslyAttempted: true,
      expectedNextAssistance: 'none',
      expectedNextEvidenceType: 'practice',
    })
  })

  it('treats overlapping code evaluators as repeated even when fingerprints differ', () => {
    const original = exercise('exercise:original')
    if (original.task.type !== 'code_output')
      throw new Error('expected a code-output assessment')
    const originalCodeTask = structuredClone(original.task)
    const sourceRuleOnly = exercise('exercise:source-rule', {
      templateId: 'template:source-rule',
      recordedRevision: 4,
      task: {
        ...originalCodeTask,
        sourceRequirements: [
          { type: 'top_level_main' },
          { type: 'binding', binding: 'let', name: 'answer' },
        ],
      },
    })
    const contains = exercise('exercise:contains', {
      templateId: 'template:contains',
      recordedRevision: 5,
      task: {
        ...originalCodeTask,
        expectedOutput: '4',
        matchMode: 'contains',
      },
    })
    const snapshot: ClassroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 5,
      stream: [original, sourceRuleOnly, contains],
      assistanceEvents: [hint('hint:1', original.id, 2)],
      attempts: [attempt('attempt:1', original.id, 3)],
    }

    const history = createAssessmentHistoryIndex(snapshot)
    expect(history.wasPreviouslyAttempted(sourceRuleOnly, 6)).toBe(true)
    expect(history.wasPreviouslyAttempted(contains, 6)).toBe(true)
    expect(history.applicableAssistance(sourceRuleOnly, 6)).toEqual([
      snapshot.assistanceEvents[0],
    ])
    expect(history.applicableAssistance(contains, 6)).toEqual([
      snapshot.assistanceEvents[0],
    ])
  })

  it('carries quiz history across distractor and multiple-flag changes', () => {
    const original = exercise('exercise:quiz-original', {
      templateId: 'template:quiz-original',
      task: {
        type: 'quiz',
        questions: [{
          question: 'Choose the immutable binding.',
          options: ['let', 'var'],
          answerIndices: [0],
          multiple: false,
          explanation: '`let` is immutable.',
        }],
      },
    })
    const presentationChanged = exercise('exercise:quiz-presentation-change', {
      templateId: 'template:quiz-presentation-change',
      recordedRevision: 4,
      task: {
        type: 'quiz',
        questions: [{
          question: 'Choose the immutable binding again.',
          options: ['let', 'var', 'distractor'],
          answerIndices: [0],
          multiple: true,
          explanation: 'The accepted answer is unchanged.',
        }],
      },
    })
    const assistance = hint('hint:quiz', original.id, 2)
    const snapshot: ClassroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 4,
      stream: [original, presentationChanged],
      assistanceEvents: [assistance],
      attempts: [attempt('attempt:quiz', original.id, 3)],
    }

    const history = createAssessmentHistoryIndex(snapshot)
    expect(history.wasPreviouslyAttempted(presentationChanged, 5)).toBe(true)
    expect(history.applicableAssistance(presentationChanged, 5)).toEqual([
      assistance,
    ])
    expect(history.expectedEvidenceType(
      presentationChanged,
      {
        assistance: 'none',
        recordedRevision: 5,
      },
    )).toBe('practice')
  })

  it('bounds projected assistance IDs without weakening the eligibility result', () => {
    const original = exercise('exercise:original')
    const assistanceEvents = Array.from(
      { length: MAX_ELIGIBILITY_ASSISTANCE_EVENT_IDS + 8 },
      (_, index) => hint(`hint:${index}`, original.id, index + 2),
    )
    const history = createAssessmentHistoryIndex({
      ...createEmptyClassroom(),
      revision: assistanceEvents.length + 1,
      stream: [original],
      assistanceEvents,
    })

    const eligibility = history.projectCurrentEligibility(original)
    expect(eligibility.applicableAssistanceEventCount)
      .toBe(assistanceEvents.length)
    expect(eligibility.applicableAssistanceEventIdsTruncated).toBe(true)
    expect(eligibility.applicableAssistanceEventIds).toHaveLength(
      MAX_ELIGIBILITY_ASSISTANCE_EVENT_IDS,
    )
    expect(eligibility.applicableAssistanceEventIds.at(-1))
      .toBe(`hint:${assistanceEvents.length - 1}`)
    expect(eligibility).toMatchObject({
      expectedNextAssistance: 'hint',
      expectedNextEvidenceType: 'aided',
    })
  })

  it('does not rescan snapshot collections for repeated queries', () => {
    const original = exercise('exercise:original')
    const repeated = exercise('exercise:repeated', { recordedRevision: 4 })
    const passes = {
      stream: 0,
      assistance: 0,
      attempts: 0,
    }
    const observedArray = <T>(
      values: T[],
      onPass: () => void,
    ): T[] => new Proxy(values, {
      get(target, property, receiver) {
        if (property === Symbol.iterator || property === 'forEach')
          onPass()
        return Reflect.get(target, property, receiver)
      },
    })
    const snapshot: ClassroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 4,
      stream: observedArray(
        [original, repeated],
        () => passes.stream++,
      ),
      assistanceEvents: observedArray(
        [hint('hint:1', original.id, 2)],
        () => passes.assistance++,
      ),
      attempts: observedArray(
        [attempt('attempt:1', original.id, 3)],
        () => passes.attempts++,
      ),
    }
    const history = createAssessmentHistoryIndex(snapshot)
    const constructionPasses = { ...passes }

    for (let index = 0; index < 2_000; index++) {
      history.applicableAssistance(repeated, 5)
      history.wasPreviouslyAttempted(repeated, 5)
      history.expectedEvidenceType(repeated, {
        assistance: 'none',
        recordedRevision: 5,
      })
      history.projectCurrentEligibility(repeated)
    }

    expect(passes).toEqual(constructionPasses)
    expect(constructionPasses).toEqual({
      stream: 1,
      assistance: 1,
      attempts: 1,
    })
  })
})
