import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import { createAIClassroom } from './ai-classroom'
import { createContentPackCatalog } from './content-catalog'
import type { ClassroomSnapshot } from './state'
import { createMemoryClassroomStorage } from './storage'

const contentVersion = `cv:sha256:${'a'.repeat(64)}`

function currentPack(): CourseContentPack {
  return {
    id: 'pack:cj.var.immutable',
    version: contentVersion,
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: 'cj.var.immutable',
      title: 'Immutable bindings',
      summary: 'Declare and use an immutable binding.',
      prerequisites: [],
    },
    blocks: [{
      id: 'block:let',
      type: 'prose',
      markdown: '`let` creates an immutable binding.',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: 'Immutable bindings',
      }],
    }, {
      id: 'block:let:program',
      type: 'code_sample',
      code: 'main() { println(42) }',
      language: 'cangjie',
      sampleType: 'program',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: 'Immutable bindings',
      }],
    }],
    learningSkills: [{
      id: 'skill:let:declare',
      conceptId: 'cj.var.immutable',
      title: 'Declare an immutable binding',
      description: 'Declare and print an immutable binding.',
      key: true,
    }],
    exerciseTemplates: [{
      id: 'template:let:practice',
      version: contentVersion,
      learningSkillId: 'skill:let:declare',
      purpose: 'practice',
      task: {
        type: 'code_output',
        prompt: 'Print 42 from an immutable binding.',
        starterCode: 'main() {}',
        expectedOutput: '42',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: ['Check the value assigned to the immutable binding.'],
      },
    }, {
      id: 'template:let:review',
      version: contentVersion,
      learningSkillId: 'skill:let:declare',
      purpose: 'review',
      task: {
        type: 'code_output',
        prompt: 'Print 84 from an immutable binding.',
        starterCode: 'main() {}',
        expectedOutput: '84',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    }],
  }
}

async function createCurrentCourseFixture() {
  const catalog = createContentPackCatalog([currentPack()])
  const ids = [
    'track:current',
    'exercise:base',
    'evidence:base',
    'remediation:base',
    'marker:base',
    'exercise:personalized',
  ]
  const classroom = createAIClassroom({
    catalog,
    storage: createMemoryClassroomStorage(),
    now: () => 100,
    createId: () => ids.shift()!,
  })
  await classroom.open()
  await classroom.execute({
    type: 'start_learning_track',
    trackId: ids.shift()!,
    goal: 'Learn immutable bindings.',
    conceptIds: ['cj.var.immutable'],
    explicitLearnerGoal: true,
  })
  await classroom.execute({
    type: 'create_exercise_instance',
    learningTrackId: classroom.snapshot().activeTrackId!,
    tutoringStepId: 'step:base',
    conceptId: 'cj.var.immutable',
    contentVersion,
    templateId: 'template:let:practice',
    personalizationInputs: {},
  })
  await classroom.execute({
    type: 'record_exercise_attempt',
    attemptId: 'attempt:base',
    exerciseInstanceId: 'exercise:base',
    submission: {
      type: 'code_output',
      code: 'main() { println(41) }',
    },
    observation: {
      type: 'run_result',
      result: {
        ok: true,
        phase: 'run',
        stdout: '41',
        stdoutTruncated: false,
        stderr: '',
        stderrTruncated: false,
        compilerOutput: '',
        compilerOutputTruncated: false,
        exitCode: 0,
      },
    },
  })
  await classroom.execute({
    type: 'retain_remediation',
    artifactId: 'unused:automatic-id-wins',
    failedAttemptId: 'attempt:base',
    misconceptionTheme: 'binding value mismatch',
    markdown: 'Check the value assigned to the immutable binding.',
  })
  await classroom.execute({
    type: 'create_exercise_instance',
    learningTrackId: classroom.snapshot().activeTrackId!,
    tutoringStepId: 'step:personalized',
    conceptId: 'cj.var.immutable',
    contentVersion,
    templateId: 'template:let:practice',
    personalizationInputs: {
      remediationArtifactIds: ['remediation:base'],
    },
  })
  await classroom.execute({
    type: 'remove_review_artifact',
    artifactId: 'remediation:base',
  })

  return { catalog, classroom }
}

function causalityRecords(snapshot: ClassroomSnapshot) {
  const exercise = snapshot.stream.find(entry =>
    entry.id === 'exercise:personalized')
  const attempt = snapshot.attempts.find(candidate =>
    candidate.id === 'attempt:base')
  const remediation = snapshot.removedReviewArtifacts.find(artifact =>
    artifact.id === 'remediation:base')
  if (
    !exercise
    || exercise.type !== 'exercise_instance'
    || !attempt
    || !remediation
    || remediation.type !== 'remediation'
  ) {
    throw new Error('Expected current Course remediation lineage')
  }
  return { attempt, exercise, remediation }
}

async function expectForgedSnapshotRejected(
  mutate: (records: ReturnType<typeof causalityRecords>) => void,
  message: RegExp,
) {
  const { catalog, classroom } = await createCurrentCourseFixture()
  const forged = classroom.snapshot()
  mutate(causalityRecords(forged))
  const reopened = createAIClassroom({
    catalog,
    storage: createMemoryClassroomStorage(forged),
  })
  await expect(reopened.open()).rejects.toThrow(message)
  await classroom.dispose()
}

describe('current Course remediation causality', () => {
  it('rejects failure Evidence recorded at the personalized Exercise revision', async () => {
    await expectForgedSnapshotRejected(({ attempt, exercise }) => {
      exercise.personalizationInputs.unresolvedFailureEvidenceIds = [
        'evidence:base',
      ]
      attempt.recordedRevision = exercise.recordedRevision
    }, /inapplicable failure Learning Evidence/)
  })

  it('rejects Remediation becoming ready at the personalized Exercise revision', async () => {
    await expectForgedSnapshotRejected(({ exercise, remediation }) => {
      remediation.updatedRevision = exercise.recordedRevision
    }, /inapplicable Remediation/)
  })

  it('rejects Remediation removed at the personalized Exercise revision', async () => {
    await expectForgedSnapshotRejected(({ exercise, remediation }) => {
      remediation.removedRevision = exercise.recordedRevision
    }, /inapplicable Remediation/)
  })
})
