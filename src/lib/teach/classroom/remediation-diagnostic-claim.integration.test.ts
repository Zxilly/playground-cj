import { describe, expect, it, vi } from 'vitest'
import type { CourseContentPack } from './content-packs'
import { createAIClassroom } from './ai-classroom'
import { createContentPackCatalog } from './content-catalog'
import { createMemoryClassroomStorage } from './storage'
import { runAutomaticRemediationJob } from '@/features/teach/components/automatic-remediation-job'

const VERSION
  = 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const CONTRACT
  = 'lc:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function approvedPack(): CourseContentPack {
  return {
    id: 'pack:remediation-claim',
    version: VERSION,
    learningContractVersion: CONTRACT,
    concept: {
      id: 'cj.remediation.claim',
      title: 'Remediation claim',
      summary: 'Exercises durable diagnostic ownership.',
      prerequisites: [],
    },
    blocks: [{
      id: 'block:claim',
      type: 'prose',
      markdown: 'A diagnostic claim has one durable owner.',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: 'Bindings',
      }],
    }, {
      id: 'block:claim:program',
      type: 'code_sample',
      code: 'main() { println(42) }',
      language: 'cangjie',
      sampleType: 'program',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: 'Bindings',
      }],
    }],
    learningSkills: [{
      id: 'skill:claim',
      conceptId: 'cj.remediation.claim',
      title: 'Claim a job',
      description: 'Claims exactly one diagnostic job.',
      key: true,
    }],
    exerciseTemplates: [{
      id: 'template:claim',
      version: VERSION,
      learningSkillId: 'skill:claim',
      purpose: 'practice',
      task: {
        type: 'code_output',
        prompt: 'Print the expected value.',
        starterCode: 'main() {}',
        expectedOutput: '42',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: ['Print 42.'],
      },
    }, {
      id: 'template:claim:review',
      version: VERSION,
      learningSkillId: 'skill:claim',
      purpose: 'review',
      task: {
        type: 'code_output',
        prompt: 'Print the review value.',
        starterCode: 'main() {}',
        expectedOutput: '84',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    }],
    review: {
      status: 'approved',
      reviewedBy:
        `external-review-attestation:test-key:${'0'.repeat(64)}`,
    },
  }
}

async function pendingRemediationFixture() {
  let now = 1_000
  const catalog = createContentPackCatalog([approvedPack()])
  const storage = createMemoryClassroomStorage()
  const ids = [
    'exercise:claim',
    'evidence:claim',
    'remediation:claim',
    'marker:claim',
  ]
  const firstTab = createAIClassroom({
    catalog,
    storage,
    now: () => now,
    createId: () => ids.shift()!,
  })
  await firstTab.open()
  await firstTab.execute({
    type: 'start_learning_track',
    trackId: 'track:claim',
    goal: 'Test durable diagnostic ownership.',
    conceptIds: ['cj.remediation.claim'],
    explicitLearnerGoal: true,
  })
  await firstTab.execute({
    type: 'create_exercise_instance',
    learningTrackId: 'track:claim',
    tutoringStepId: 'step:claim',
    conceptId: 'cj.remediation.claim',
    contentVersion: VERSION,
    templateId: 'template:claim',
    personalizationInputs: {},
  })
  await firstTab.execute({
    type: 'record_exercise_attempt',
    attemptId: 'attempt:claim',
    exerciseInstanceId: 'exercise:claim',
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
  const secondTab = createAIClassroom({
    catalog,
    storage,
    now: () => now,
    createId: () => {
      throw new Error('claiming a diagnostic must not allocate aggregate ids')
    },
  })
  await secondTab.open()
  return {
    catalog,
    firstTab,
    secondTab,
    storage,
    setNow(value: number) {
      now = value
    },
  }
}

describe('durable Remediation diagnostic claims', () => {
  it('releases its persisted claim when an in-flight model call is aborted', async () => {
    const { catalog, firstTab, storage } = await pendingRemediationFixture()
    const controller = new AbortController()
    let markGenerationStarted!: () => void
    const generationStarted = new Promise<void>((resolve) => {
      markGenerationStarted = resolve
    })
    const operation = runAutomaticRemediationJob({
      classroom: firstTab,
      job: {
        artifactId: 'remediation:claim',
        failedAttemptId: 'attempt:claim',
        diagnosticAttempt: 1,
      },
      ownerNonce: 'owner:aborted',
      observedAt: 1_000,
      abortSignal: controller.signal,
      generate: async (_failedAttemptId, _claim, signal) => {
        markGenerationStarted()
        return new Promise<boolean>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        })
      },
    })

    await generationStarted
    controller.abort(new DOMException('tab disposed', 'AbortError'))
    await expect(operation).resolves.toEqual({
      handled: true,
      retryAt: null,
    })

    const observer = createAIClassroom({ catalog, storage })
    await observer.open()
    expect(observer.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticAttempts: 0,
      diagnosticClaim: null,
    })
  })

  it('lets only the persisted winner call the model across two aggregate tabs', async () => {
    const { firstTab, secondTab } = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    let releaseGeneration!: () => void
    const generationCanFinish = new Promise<void>((resolve) => {
      releaseGeneration = resolve
    })
    let modelCalls = 0
    const generate = async () => {
      modelCalls++
      await generationCanFinish
      return false
    }

    const operations = [
      runAutomaticRemediationJob({
        classroom: firstTab,
        job,
        ownerNonce: 'owner:first-tab',
        observedAt: 1_000,
        abortSignal: new AbortController().signal,
        generate,
      }),
      runAutomaticRemediationJob({
        classroom: secondTab,
        job,
        ownerNonce: 'owner:second-tab',
        observedAt: 1_000,
        abortSignal: new AbortController().signal,
        generate,
      }),
    ]
    await vi.waitFor(() => {
      expect(modelCalls).toBe(1)
    })
    releaseGeneration()
    await Promise.all(operations)
    expect(modelCalls).toBe(1)
  })

  it('grants one persisted owner when two tabs claim the same stable job', async () => {
    const { catalog, firstTab, secondTab, storage }
      = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }

    await Promise.all([
      firstTab.execute({
        type: 'claim_remediation_diagnostic',
        job,
        ownerNonce: 'owner:first-tab',
        observedAt: 1_000,
      }),
      secondTab.execute({
        type: 'claim_remediation_diagnostic',
        job,
        ownerNonce: 'owner:second-tab',
        observedAt: 1_000,
      }),
    ])

    const observer = createAIClassroom({ catalog, storage })
    await observer.open()
    expect(observer.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticClaim: {
        job,
        ownerNonce: expect.stringMatching(/^owner:(first|second)-tab$/),
        claimedAt: 1_000,
      },
    })
  })

  it('never starts a replacement model call merely because a claim is old', async () => {
    const {
      catalog,
      firstTab,
      secondTab,
      setNow,
      storage,
    } = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    const oldOwnerController = new AbortController()
    let markOldCallStarted!: () => void
    const oldCallStarted = new Promise<void>((resolve) => {
      markOldCallStarted = resolve
    })
    let settleOldProvider!: () => void
    const oldProviderSettled = new Promise<void>((resolve) => {
      settleOldProvider = resolve
    })
    const oldOperation = runAutomaticRemediationJob({
      classroom: firstTab,
      job,
      ownerNonce: 'owner:crashed-tab',
      observedAt: 1_000,
      abortSignal: oldOwnerController.signal,
      generate: async () => {
        markOldCallStarted()
        // Deliberately ignore AbortSignal, as arbitrary direct providers may.
        await oldProviderSettled
        return false
      },
    })
    await oldCallStarted
    oldOwnerController.abort(
      new DOMException('tab deadline elapsed', 'AbortError'),
    )

    setNow(46_000)
    let replacementModelCalls = 0
    await expect(runAutomaticRemediationJob({
      classroom: secondTab,
      job,
      ownerNonce: 'owner:recovery-tab',
      observedAt: 46_000,
      abortSignal: new AbortController().signal,
      generate: async () => {
        replacementModelCalls++
        return false
      },
    })).resolves.toEqual({
      handled: true,
      retryAt: null,
    })
    expect(replacementModelCalls).toBe(0)

    settleOldProvider()
    await expect(oldOperation).resolves.toEqual({
      handled: true,
      retryAt: null,
    })

    const observer = createAIClassroom({ catalog, storage })
    await observer.open()
    expect(observer.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticClaim: null,
    })
  })

  it('requires an explicit learner acknowledgement before recovering an old claim', async () => {
    const {
      catalog,
      firstTab,
      setNow,
      storage,
    } = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    await firstTab.execute({
      type: 'claim_remediation_diagnostic',
      job,
      ownerNonce: 'owner:before-clock-rollback',
      observedAt: 1_000,
    })

    const recoveryTab = createAIClassroom({
      catalog,
      storage,
      now: () => 0,
      createId: () => {
        throw new Error('claim recovery must not allocate aggregate ids')
      },
    })
    await recoveryTab.open()
    setNow(0)
    await expect(recoveryTab.execute({
      type: 'recover_potentially_abandoned_remediation_diagnostic_claim',
      artifactId: job.artifactId,
      observedAt: 45_999,
      acknowledgePotentialDuplicateProviderCall: true,
    })).rejects.toThrow(/not yet marked.*abandoned/i)
    expect(recoveryTab.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticClaim: {
        ownerNonce: 'owner:before-clock-rollback',
        expiresAt: 46_000,
      },
    })

    await recoveryTab.execute({
      type: 'recover_potentially_abandoned_remediation_diagnostic_claim',
      artifactId: job.artifactId,
      observedAt: 46_000,
      acknowledgePotentialDuplicateProviderCall: true,
    })
    expect(recoveryTab.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticClaim: null,
      updatedAt: 46_000,
    })
  })

  it('does not let the ordinary diagnostic retry command clear a persisted claim', async () => {
    const { firstTab } = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    await firstTab.execute({
      type: 'claim_remediation_diagnostic',
      job,
      ownerNonce: 'owner:still-running',
      observedAt: 1_000,
    })

    await expect(firstTab.execute({
      type: 'retry_remediation_diagnostic',
      artifactId: job.artifactId,
      explicitLearnerRetry: true,
    })).rejects.toThrow(/manual recovery.*duplicate provider/i)
    expect(firstTab.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticClaim: {
        job,
        ownerNonce: 'owner:still-running',
      },
    })
  })

  it('advances the stable job identity only when a scheduled retry becomes due', async () => {
    const {
      firstTab,
      secondTab,
      setNow,
    } = await pendingRemediationFixture()
    const firstJob = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    const firstAuthority = {
      job: firstJob,
      ownerNonce: 'owner:first-attempt',
    }
    await firstTab.execute({
      type: 'claim_remediation_diagnostic',
      ...firstAuthority,
      observedAt: 1_000,
    })
    await firstTab.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: firstJob.failedAttemptId,
      diagnosticAttempt: firstJob.diagnosticAttempt,
      failure: 'generation_failed',
      diagnosticClaim: firstAuthority,
    })

    const secondJob = {
      ...firstJob,
      diagnosticAttempt: 2,
    }
    setNow(5_999)
    await secondTab.execute({
      type: 'claim_remediation_diagnostic',
      job: secondJob,
      ownerNonce: 'owner:second-attempt',
      observedAt: 5_999,
    })
    expect(secondTab.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticAttempts: 1,
      nextDiagnosticAttemptAt: 6_000,
      diagnosticClaim: null,
    })

    setNow(6_000)
    await secondTab.execute({
      type: 'claim_remediation_diagnostic',
      job: secondJob,
      ownerNonce: 'owner:second-attempt',
      observedAt: 6_000,
    })
    expect(secondTab.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticAttempts: 1,
      diagnosticClaim: {
        job: secondJob,
        ownerNonce: 'owner:second-attempt',
        claimedAt: 6_000,
      },
    })
  })

  it('fences the old owner after the learner explicitly recovers its claim', async () => {
    const {
      catalog,
      firstTab,
      setNow,
      storage,
    } = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    await firstTab.execute({
      type: 'claim_remediation_diagnostic',
      job,
      ownerNonce: 'owner:stale',
      observedAt: 1_000,
    })
    setNow(46_000)
    const recoveryTab = createAIClassroom({
      catalog,
      storage,
      now: () => 46_000,
      createId: () => {
        throw new Error('claim recovery must not allocate aggregate ids')
      },
    })
    await recoveryTab.open()
    await recoveryTab.execute({
      type: 'recover_potentially_abandoned_remediation_diagnostic_claim',
      artifactId: job.artifactId,
      observedAt: 46_000,
      acknowledgePotentialDuplicateProviderCall: true,
    })
    await recoveryTab.execute({
      type: 'claim_remediation_diagnostic',
      job,
      ownerNonce: 'owner:current',
      observedAt: 46_000,
    })

    await firstTab.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: job.failedAttemptId,
      diagnosticAttempt: job.diagnosticAttempt,
      failure: 'generation_failed',
      diagnosticClaim: {
        job,
        ownerNonce: 'owner:stale',
      },
    })
    await firstTab.execute({
      type: 'retain_remediation',
      artifactId: 'request:stale',
      failedAttemptId: job.failedAttemptId,
      misconceptionTheme: 'stale diagnosis',
      markdown: 'This stale owner must not replace the current diagnostic.',
      diagnosticClaim: {
        job,
        ownerNonce: 'owner:stale',
      },
    })

    const beforeCurrentCompletion = createAIClassroom({ catalog, storage })
    await beforeCurrentCompletion.open()
    expect(beforeCurrentCompletion.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticAttempts: 0,
      diagnosticClaim: {
        job,
        ownerNonce: 'owner:current',
      },
    })
    expect(beforeCurrentCompletion.snapshot().stream).not.toContainEqual(
      expect.objectContaining({ id: 'request:stale' }),
    )

    await recoveryTab.execute({
      type: 'retain_remediation',
      artifactId: 'request:current',
      failedAttemptId: job.failedAttemptId,
      misconceptionTheme: 'off-by-one output',
      markdown: 'Check the bound value before printing it.',
      diagnosticClaim: {
        job,
        ownerNonce: 'owner:current',
      },
    })
    const afterCompletion = createAIClassroom({ catalog, storage })
    await afterCompletion.open()
    expect(afterCompletion.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'ready',
      diagnosticClaim: null,
      misconceptionTheme: 'off-by-one output',
    })
  })

  it('rejects a persisted claim whose stable job identity was forged', async () => {
    const { catalog, firstTab } = await pendingRemediationFixture()
    const job = {
      artifactId: 'remediation:claim',
      failedAttemptId: 'attempt:claim',
      diagnosticAttempt: 1,
    }
    await firstTab.execute({
      type: 'claim_remediation_diagnostic',
      job,
      ownerNonce: 'owner:valid',
      observedAt: 1_000,
    })
    const forged = firstTab.snapshot()
    const artifact = forged.reviewArtifacts[0]
    if (artifact?.type !== 'remediation' || !artifact.diagnosticClaim)
      throw new Error('expected a claimed Remediation')
    artifact.diagnosticClaim.job.failedAttemptId = 'attempt:forged'

    const reopened = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(reopened.open()).rejects.toThrow(
      /Remediation.*diagnostic claim.*identity/i,
    )
  })
})
