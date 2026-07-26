import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import { createAIClassroom } from './ai-classroom'
import { createContentPackCatalog } from './content-catalog'
import { createMemoryClassroomStorage } from './storage'

function contentPack(
  contentVersion: string,
  learningContractVersion: string,
  expectedOutput: string,
): CourseContentPack {
  return {
    id: 'pack:cj.var.immutable',
    version: contentVersion,
    learningContractVersion,
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
      code: `main() { println(${expectedOutput}) }`,
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
    exerciseTemplates: [
      {
        id: 'template:let:practice',
        version: contentVersion,
        learningSkillId: 'skill:let:declare',
        purpose: 'practice',
        task: {
          type: 'code_output',
          prompt: `Print ${expectedOutput} from an immutable binding.`,
          starterCode: 'main() {}',
          expectedOutput,
          matchMode: 'exact',
          sourceRequirements: [{ type: 'top_level_main' }],
          hints: ['Check the value assigned to the immutable binding.'],
        },
      },
      {
        id: 'template:let:review',
        version: contentVersion,
        learningSkillId: 'skill:let:declare',
        purpose: 'review',
        task: {
          type: 'code_output',
          prompt: `Print ${Number(expectedOutput) * 2} from an immutable binding.`,
          starterCode: 'main() {}',
          expectedOutput: String(Number(expectedOutput) * 2),
          matchMode: 'exact',
          sourceRequirements: [{ type: 'top_level_main' }],
          hints: [],
        },
      },
    ],
    review: {
      status: 'approved',
      reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
    },
  }
}

async function createCrossContractFixture(
  options: { removeAfterHistoricalUse?: boolean } = {},
) {
  const historicalPack = contentPack('cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'lc:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '42')
  const currentPack = contentPack('cv:sha256:3333333333333333333333333333333333333333333333333333333333333333', 'lc:sha256:4444444444444444444444444444444444444444444444444444444444444444', '43')
  const storage = createMemoryClassroomStorage()
  const initialIds = [
    'track:historical',
    'exercise:historical',
    'evidence:historical',
    'remediation:historical',
    'marker:historical',
    'exercise:historical:personalized',
  ]
  const historical = createAIClassroom({
    catalog: createContentPackCatalog([historicalPack]),
    storage,
    now: () => 100,
    createId: () => initialIds.shift()!,
  })
  await historical.open()
  await historical.execute({
    type: 'start_learning_track',
    trackId: initialIds.shift()!,
    goal: 'Learn immutable bindings under the historical contract.',
    conceptIds: ['cj.var.immutable'],
    explicitLearnerGoal: true,
  })
  await historical.execute({
    type: 'create_exercise_instance',
    learningTrackId: historical.snapshot().activeTrackId!,
    tutoringStepId: 'step:historical',
    conceptId: 'cj.var.immutable',
    contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    templateId: 'template:let:practice',
    personalizationInputs: {},
  })
  await historical.execute({
    type: 'record_exercise_attempt',
    attemptId: 'attempt:historical',
    exerciseInstanceId: 'exercise:historical',
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
  await historical.execute({
    type: 'retain_remediation',
    artifactId: 'unused:automatic-shell-wins',
    failedAttemptId: 'attempt:historical',
    misconceptionTheme: 'binding value mismatch',
    markdown: 'Check the value assigned to the immutable binding.',
  })
  if (options.removeAfterHistoricalUse) {
    await historical.execute({
      type: 'create_exercise_instance',
      learningTrackId: historical.snapshot().activeTrackId!,
      tutoringStepId: 'step:historical:personalized',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {
        remediationArtifactIds: ['remediation:historical'],
      },
    })
    await historical.execute({
      type: 'remove_review_artifact',
      artifactId: 'remediation:historical',
    })
  }
  await historical.dispose()

  const currentCatalog = createContentPackCatalog(
    [historicalPack, currentPack],
    { 'cj.var.immutable': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
  )
  const currentIds = ['track:current', 'exercise:current']
  const current = createAIClassroom({
    catalog: currentCatalog,
    storage,
    now: () => 200,
    createId: () => currentIds.shift()!,
  })
  await current.open()
  await current.execute({
    type: 'start_learning_track',
    trackId: currentIds.shift()!,
    goal: 'Learn immutable bindings under the current contract.',
    conceptIds: ['cj.var.immutable'],
    explicitLearnerGoal: true,
  })

  return {
    current,
    currentCatalog,
    currentTrackId: current.snapshot().activeTrackId!,
  }
}

describe('remediation personalization provenance', () => {
  it('reopens a removed Remediation reference against its exact historical Content Pack', async () => {
    const { current } = await createCrossContractFixture({
      removeAfterHistoricalUse: true,
    })
    const snapshot = current.snapshot()

    expect(snapshot.removedReviewArtifacts).toEqual([
      expect.objectContaining({
        id: 'remediation:historical',
        type: 'remediation',
        evidenceIds: ['evidence:historical'],
      }),
    ])
    expect(snapshot.stream).toContainEqual(expect.objectContaining({
      id: 'exercise:historical:personalized',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      personalizationInputs: {
        unresolvedFailureEvidenceIds: [],
        remediationArtifactIds: ['remediation:historical'],
      },
    }))
  })

  it('rejects same-timestamp failure Evidence whose Attempt is not before the Exercise', async () => {
    const { current, currentCatalog } = await createCrossContractFixture({
      removeAfterHistoricalUse: true,
    })
    const forged = current.snapshot()
    const personalized = forged.stream.find(entry =>
      entry.id === 'exercise:historical:personalized')
    const attempt = forged.attempts.find(candidate =>
      candidate.id === 'attempt:historical')
    if (!personalized || personalized.type !== 'exercise_instance' || !attempt)
      throw new Error('expected historical personalization lineage')

    personalized.personalizationInputs.unresolvedFailureEvidenceIds = [
      'evidence:historical',
    ]
    attempt.recordedRevision = personalized.recordedRevision

    const reopened = createAIClassroom({
      catalog: currentCatalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(reopened.open()).rejects.toThrow(
      /inapplicable failure Learning Evidence/,
    )
  })

  it('rejects same-timestamp Remediation that became ready at the Exercise revision', async () => {
    const { current, currentCatalog } = await createCrossContractFixture({
      removeAfterHistoricalUse: true,
    })
    const forged = current.snapshot()
    const personalized = forged.stream.find(entry =>
      entry.id === 'exercise:historical:personalized')
    const remediation = forged.removedReviewArtifacts.find(artifact =>
      artifact.id === 'remediation:historical')
    if (
      !personalized
      || personalized.type !== 'exercise_instance'
      || !remediation
      || remediation.type !== 'remediation'
    ) {
      throw new Error('expected removed historical Remediation')
    }
    remediation.updatedRevision = personalized.recordedRevision

    const reopened = createAIClassroom({
      catalog: currentCatalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(reopened.open()).rejects.toThrow(/inapplicable Remediation/)
  })

  it('rejects same-timestamp Remediation removed at the Exercise revision', async () => {
    const { current, currentCatalog } = await createCrossContractFixture({
      removeAfterHistoricalUse: true,
    })
    const forged = current.snapshot()
    const personalized = forged.stream.find(entry =>
      entry.id === 'exercise:historical:personalized')
    const remediation = forged.removedReviewArtifacts.find(artifact =>
      artifact.id === 'remediation:historical')
    if (
      !personalized
      || personalized.type !== 'exercise_instance'
      || !remediation
      || remediation.type !== 'remediation'
    ) {
      throw new Error('expected removed historical Remediation')
    }
    remediation.removedRevision = personalized.recordedRevision

    const reopened = createAIClassroom({
      catalog: currentCatalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(reopened.open()).rejects.toThrow(/inapplicable Remediation/)
  })

  it('rejects a ready Remediation from a superseded Learning Contract', async () => {
    const { current, currentTrackId } = await createCrossContractFixture()

    await expect(current.execute({
      type: 'create_exercise_instance',
      learningTrackId: currentTrackId,
      tutoringStepId: 'step:stale-remediation',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      templateId: 'template:let:practice',
      personalizationInputs: {
        remediationArtifactIds: ['remediation:historical'],
      },
    })).rejects.toThrow(/not an applicable Remediation/)
  })

  it('rejects a persisted Exercise Instance forged to reference stale Remediation lineage', async () => {
    const { current, currentCatalog, currentTrackId }
      = await createCrossContractFixture()
    await current.execute({
      type: 'create_exercise_instance',
      learningTrackId: currentTrackId,
      tutoringStepId: 'step:current',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })

    const forged = current.snapshot()
    const currentInstance = forged.stream.find(entry =>
      entry.id === 'exercise:current')
    if (!currentInstance || currentInstance.type !== 'exercise_instance')
      throw new Error('expected current Exercise Instance')
    currentInstance.personalizationInputs.remediationArtifactIds = [
      'remediation:historical',
    ]

    const reopened = createAIClassroom({
      catalog: currentCatalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(reopened.open()).rejects.toThrow(/inapplicable Remediation/)
  })
})
