import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import {
  classroomCommandSchema,
  createAIClassroom,
} from './ai-classroom'
import { createContentPackCatalog } from './content-catalog'
import {
  ClassroomRevisionConflictError,
  createMemoryClassroomStorage,
} from './storage'
import { deriveConceptProgress } from './progress'
import {
  classroomSnapshotUtf8Bytes,
  MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES,
  MAX_RESOLVED_RETENTION_AUDIT_TAIL,
  renderPersistedDiagnostic,
} from './persistence-policy'
import { classroomSnapshotSchema, createEmptyClassroom } from './state'

function pack(review: 'approved' | 'pending'): CourseContentPack {
  return {
    id: 'pack:cj.var.immutable',
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: 'cj.var.immutable',
      title: '不可变绑定 let',
      summary: 'let 绑定初始化后不能重新赋值。',
      prerequisites: [],
    },
    blocks: [{
      id: 'block:let',
      type: 'prose' as const,
      markdown: '`let` 创建不可变绑定。',
      sourceReferences: [{
        sourceId: 'static-tour' as const,
        ref: '02-basics/01-bindings/01',
        title: 'let（不可变绑定）',
      }],
    }, {
      id: 'block:let:code',
      type: 'code_sample' as const,
      code: 'main() { let answer = 42; println(answer) }',
      language: 'cangjie' as const,
      sampleType: 'program' as const,
      sourceReferences: [{
        sourceId: 'static-tour' as const,
        ref: '02-basics/01-bindings/01',
        title: 'let（不可变绑定）',
      }],
    }],
    learningSkills: review === 'approved'
      ? [{
          id: 'skill:let:declare',
          conceptId: 'cj.var.immutable',
          title: '声明不可变绑定',
          description: '能声明并使用 let 绑定。',
          key: true,
        }]
      : [],
    exerciseTemplates: review === 'approved'
      ? [{
          id: 'template:let:practice',
          version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          learningSkillId: 'skill:let:declare',
          purpose: 'practice' as const,
          task: {
            type: 'code_output' as const,
            prompt: '声明一个不可变绑定并打印它。',
            starterCode: 'main() {}',
            expectedOutput: '42',
            matchMode: 'exact' as const,
            sourceRequirements: [{ type: 'top_level_main' as const }],
            hints: ['先检查不可变绑定的声明和值。'],
          },
        }, {
          id: 'template:let:review',
          version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          learningSkillId: 'skill:let:declare',
          purpose: 'review' as const,
          task: {
            type: 'code_output' as const,
            prompt: '在新的程序中声明不可变绑定并输出它的两倍。',
            starterCode: 'main() {}',
            expectedOutput: '84',
            matchMode: 'exact' as const,
            sourceRequirements: [{ type: 'top_level_main' as const }],
            hints: [],
          },
        }, {
          id: 'template:let:recall',
          version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          learningSkillId: 'skill:let:declare',
          purpose: 'practice' as const,
          task: {
            type: 'recall' as const,
            prompt: '写出声明不可变绑定的关键字。',
            referenceAnswer: 'let binding',
          },
        }, {
          id: 'template:let:quiz',
          version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          learningSkillId: 'skill:let:declare',
          purpose: 'practice' as const,
          task: {
            type: 'quiz' as const,
            questions: [{
              question: '哪些说法正确？',
              options: ['let 不可重新赋值', 'var 不可重新赋值', 'let 可用于局部绑定'],
              answerIndices: [0, 2],
              multiple: true,
              explanation: 'let 是不可变绑定，也可用于局部绑定。',
            }, {
              question: '哪个关键字创建可变绑定？',
              options: ['let', 'var'],
              answerIndices: [1],
              multiple: false,
              explanation: 'var 创建可变绑定。',
            }],
          },
        }]
      : [],
  }
}

async function createPendingRemediationFixture() {
  let now = 1_000
  const catalog = createContentPackCatalog([pack('approved')])
  const storage = createMemoryClassroomStorage()
  const ids = [
    'track:1',
    'exercise:1',
    'evidence:1',
    'remediation:1',
    'marker:1',
    'marker:retained:1',
    'marker:retained:2',
  ]
  const classroom = createAIClassroom({
    catalog,
    storage,
    now: () => now,
    createId: () => ids.shift()!,
  })
  await classroom.open()
  await classroom.execute({
    type: 'start_learning_track',
    trackId: ids.shift()!,
    goal: '学习不可变绑定',
    conceptIds: ['cj.var.immutable'],
    explicitLearnerGoal: true,
  })
  const learningTrackId = classroom.snapshot().activeTrackId!
  await classroom.execute({
    type: 'create_exercise_instance',
    learningTrackId,
    tutoringStepId: 'step:1',
    conceptId: 'cj.var.immutable',
    contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    templateId: 'template:let:practice',
    personalizationInputs: {},
  })
  await classroom.execute({
    type: 'record_exercise_attempt',
    attemptId: 'attempt:failed',
    exerciseInstanceId: 'exercise:1',
    submission: { type: 'code_output', code: 'main() { println(41) }' },
    observation: {
      type: 'run_result',
      result: { ok: true, phase: 'run', stdout: '41', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
    },
  })
  return {
    catalog,
    classroom,
    storage,
    setNow: (value: number) => {
      now = value
    },
  }
}

function trackPack(
  conceptId: string,
  prerequisites: string[],
  expectedOutput: string,
): CourseContentPack {
  const suffix = conceptId.split('.').at(-1)!
  const skillId = `skill:${suffix}`
  const task = (purpose: 'practice' | 'placement' | 'review') => ({
    id: `template:${suffix}:${purpose}`,
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningSkillId: skillId,
    purpose,
    task: {
      type: 'code_output' as const,
      prompt: `${purpose} ${conceptId}`,
      starterCode: 'main() {}',
      expectedOutput: purpose === 'review'
        ? `${expectedOutput}:review`
        : expectedOutput,
      matchMode: 'exact' as const,
      sourceRequirements: [{ type: 'top_level_main' as const }],
      hints: [],
    },
  })
  return {
    id: `pack:${conceptId}`,
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: conceptId,
      title: conceptId,
      summary: `Learn ${conceptId}.`,
      prerequisites,
    },
    blocks: [{
      id: `block:${suffix}`,
      type: 'prose',
      markdown: `Core Content for ${conceptId}.`,
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: conceptId,
      }],
    }, {
      id: `block:${suffix}:program`,
      type: 'code_sample',
      code: `main() { println("${expectedOutput}") }`,
      language: 'cangjie',
      sampleType: 'program',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: conceptId,
      }],
    }],
    learningSkills: [{
      id: skillId,
      conceptId,
      title: `Use ${conceptId}`,
      description: `Demonstrate ${conceptId}.`,
      key: true,
    }],
    exerciseTemplates: [
      task('practice'),
      task('placement'),
      task('review'),
    ],
  }
}

describe('ai classroom', () => {
  it('makes an explicit Track start exactly idempotent by caller-owned Track id', async () => {
    const storage = createMemoryClassroomStorage()
    const catalog = createContentPackCatalog([pack('approved')])
    const first = createAIClassroom({ catalog, storage })
    const second = createAIClassroom({ catalog, storage })
    await Promise.all([first.open(), second.open()])
    const request = {
      type: 'start_learning_track',
      trackId: 'track:stable-request',
      goal: 'One explicit learner action',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    } as const

    await Promise.all([
      first.execute(request as never),
      second.execute(request as never),
    ])
    expect(first.snapshot().tracks).toHaveLength(1)
    await expect(first.execute(request as never)).resolves.toMatchObject({
      revision: 1,
      activeTrackId: 'track:stable-request',
      tracks: [{ id: 'track:stable-request' }],
    })
    await expect(first.execute({
      ...request,
      goal: 'A different action forged under the same id',
    } as never)).rejects.toThrow(/different content/)
    await expect(storage.load()).resolves.toMatchObject({
      revision: 1,
      tracks: [{ id: 'track:stable-request' }],
    })
  })

  it('lets an explicit learner action reactivate an earlier Learning Track', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'First goal',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const firstTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'start_learning_track',
      trackId: globalThis.crypto.randomUUID(),
      goal: 'Second goal',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    expect(classroom.snapshot().activeTrackId).not.toBe(firstTrackId)

    await classroom.execute({
      type: 'activate_learning_track',
      trackId: firstTrackId,
      explicitLearnerChoice: true,
    })

    expect(classroom.snapshot().activeTrackId).toBe(firstTrackId)
    await expect(classroom.execute({
      type: 'activate_learning_track',
      trackId: 'track:missing',
      explicitLearnerChoice: true,
    })).rejects.toThrow(/does not exist/)
    classroom.dispose()
  })

  it('serializes a command behind an in-flight open', async () => {
    let releaseLoad!: () => void
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve
    })
    const persisted = createMemoryClassroomStorage()
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: async () => {
          await loadGate
          return persisted.load()
        },
        save: (snapshot, expectedRevision) =>
          persisted.save(snapshot, expectedRevision),
      },
      now: () => 100,
      createId: () => 'track:1',
    })

    const opening = classroom.open()
    const executing = classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    releaseLoad()

    await expect(opening).resolves.toMatchObject({ revision: 0 })
    await expect(executing).resolves.toMatchObject({ revision: 1 })
  })

  it('does not persist a queued command after its commit authority is revoked', async () => {
    let releaseFirstSave!: () => void
    let markFirstSaveStarted!: () => void
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const firstSaveStarted = new Promise<void>((resolve) => {
      markFirstSaveStarted = resolve
    })
    const persisted = createMemoryClassroomStorage()
    let saveCalls = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: persisted.load,
        save: async (snapshot, expectedRevision) => {
          saveCalls += 1
          if (saveCalls === 1) {
            markFirstSaveStarted()
            await firstSaveGate
          }
          await persisted.save(snapshot, expectedRevision)
        },
      },
      now: () => 100,
      createId: () => `generated:${saveCalls}`,
    })
    await classroom.open()

    const first = classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:first',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'first',
      markdown: 'first clarification',
    })
    await firstSaveStarted

    let active = true
    const commitGuard = {
      assertActive: () => {
        if (!active)
          throw new DOMException('Teacher turn is no longer active', 'AbortError')
      },
    }
    const guardedExecute = classroom.execute as unknown as (
      command: Parameters<typeof classroom.execute>[0],
      options: { commitGuard: typeof commitGuard },
    ) => Promise<ReturnType<typeof classroom.snapshot>>
    const second = guardedExecute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:second',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'second',
      markdown: 'second clarification',
    }, { commitGuard })

    active = false
    releaseFirstSave()
    await expect(first).resolves.toMatchObject({ revision: 1 })
    await expect(second).rejects.toThrow(/Teacher turn is no longer active/)
    expect(saveCalls).toBe(1)
    await expect(persisted.load()).resolves.toMatchObject({
      revision: 1,
      reviewArtifacts: [{ id: 'artifact:first' }],
    })
  })

  it('rechecks commit authority before every optimistic-conflict retry', async () => {
    let active = true
    let saveCalls = 0
    const commitGuard = {
      assertActive: () => {
        if (!active)
          throw new DOMException('Teacher turn is no longer active', 'AbortError')
      },
    }
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: async () => null,
        save: async (_snapshot, expectedRevision) => {
          saveCalls += 1
          if (saveCalls === 1) {
            active = false
            throw new ClassroomRevisionConflictError(
              expectedRevision,
              expectedRevision + 1,
            )
          }
          throw new Error('A revoked command reached another persistence attempt')
        },
      },
      now: () => 100,
      createId: () => 'stream:guarded',
    })
    await classroom.open()
    const guardedExecute = classroom.execute as unknown as (
      command: Parameters<typeof classroom.execute>[0],
      options: { commitGuard: typeof commitGuard },
    ) => Promise<ReturnType<typeof classroom.snapshot>>

    await expect(guardedExecute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:guarded',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'guarded',
      markdown: 'guarded clarification',
    }, { commitGuard })).rejects.toThrow(/Teacher turn is no longer active/)
    expect(saveCalls).toBe(1)
  })

  it('rejects new work immediately and waits for an in-flight save before disposal completes', async () => {
    let releaseSave!: () => void
    let markSaveStarted!: () => void
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const saveStarted = new Promise<void>((resolve) => {
      markSaveStarted = resolve
    })
    const persisted = createMemoryClassroomStorage()
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: persisted.load,
        save: async (snapshot, expectedRevision) => {
          markSaveStarted()
          await saveGate
          await persisted.save(snapshot, expectedRevision)
        },
      },
      now: () => 100,
      createId: () => 'track:1',
    })
    await classroom.open()

    const executing = classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await saveStarted

    const disposing = classroom.dispose()
    expect(classroom.dispose()).toBe(disposing)
    expect(() => classroom.subscribe(() => undefined)).toThrow(/disposed/)
    expect(() => classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: '不能排入关闭中的聚合根',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })).toThrow(/disposed/)

    let disposalSettled = false
    void disposing.then(() => {
      disposalSettled = true
    })
    await Promise.resolve()
    expect(disposalSettled).toBe(false)

    releaseSave()
    await expect(executing).resolves.toMatchObject({ revision: 1 })
    await expect(disposing).resolves.toBeUndefined()
  })

  it('waits for an in-flight open before disposal completes', async () => {
    let releaseLoad!: () => void
    let markLoadStarted!: () => void
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve
    })
    const loadStarted = new Promise<void>((resolve) => {
      markLoadStarted = resolve
    })
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: async () => {
          markLoadStarted()
          await loadGate
          return null
        },
        save: async () => undefined,
      },
    })

    const opening = classroom.open()
    await loadStarted
    const disposing = classroom.dispose()
    let disposalSettled = false
    void disposing.then(() => {
      disposalSettled = true
    })
    await Promise.resolve()
    expect(disposalSettled).toBe(false)

    releaseLoad()
    await expect(opening).rejects.toThrow(/disposed/)
    await expect(disposing).resolves.toBeUndefined()
  })

  it('waits for an in-flight cross-tab refresh before disposal completes', async () => {
    let storageListener!: (revision: number) => void
    let releaseRefresh!: () => void
    let markRefreshStarted!: () => void
    let loadCount = 0
    let unsubscribed = false
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve
    })
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: async () => {
          loadCount++
          if (loadCount === 1)
            return null
          markRefreshStarted()
          await refreshGate
          return { ...createEmptyClassroom(), revision: 1 }
        },
        save: async () => undefined,
        subscribe: (listener) => {
          storageListener = listener
          return () => {
            unsubscribed = true
          }
        },
      },
    })
    await classroom.open()

    storageListener(1)
    await refreshStarted
    const disposing = classroom.dispose()
    expect(unsubscribed).toBe(true)
    let disposalSettled = false
    void disposing.then(() => {
      disposalSettled = true
    })
    await Promise.resolve()
    expect(disposalSettled).toBe(false)

    releaseRefresh()
    await expect(disposing).resolves.toBeUndefined()
  })

  it('starts at revision zero and increments once per persisted state change', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => 'track:1',
    })

    expect((await classroom.open()).revision).toBe(0)
    expect((await classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })).revision).toBe(1)
    expect((await classroom.open()).revision).toBe(1)

    // Removing an item that does not exist is an idempotent no-op.
    expect((await classroom.execute({
      type: 'remove_review_artifact',
      artifactId: 'missing',
    })).revision).toBe(1)
  })

  it('rebases a concurrent command after an optimistic write conflict', async () => {
    const storage = createMemoryClassroomStorage()
    const catalog = createContentPackCatalog([pack('approved')])
    const first = createAIClassroom({
      catalog,
      storage,
      now: () => 100,
      createId: () => 'marker:first',
    })
    const second = createAIClassroom({
      catalog,
      storage,
      now: () => 101,
      createId: () => 'marker:second',
    })
    await Promise.all([first.open(), second.open()])

    await Promise.all([
      first.execute({
        type: 'retain_clarification',
        learningTrackId: null,
        artifactId: 'artifact:first',
        conceptId: 'cj.var.immutable',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        misconceptionTheme: 'first',
        markdown: 'first clarification',
      }),
      second.execute({
        type: 'retain_clarification',
        learningTrackId: null,
        artifactId: 'artifact:second',
        conceptId: 'cj.var.immutable',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        misconceptionTheme: 'second',
        markdown: 'second clarification',
      }),
    ])

    const persisted = await storage.load()
    expect(persisted).toMatchObject({
      revision: 2,
      reviewArtifacts: [
        { id: 'artifact:first' },
        { id: 'artifact:second' },
      ],
    })
  })

  it('refuses to redirect captured Track commands after a CAS conflict activates another Track', async () => {
    const storage = createMemoryClassroomStorage()
    const catalog = createContentPackCatalog([pack('approved')])
    const bootstrapIds = ['track:A', 'stream:A']
    const bootstrap = createAIClassroom({
      catalog,
      storage,
      now: () => 100,
      createId: () => bootstrapIds.shift()!,
    })
    await bootstrap.open()
    await bootstrap.execute({
      type: 'start_learning_track',
      trackId: bootstrapIds.shift()!,
      goal: 'Track A',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const trackAId = bootstrap.snapshot().activeTrackId!
    await bootstrap.execute({
      type: 'append_content_reference_group',
      learningTrackId: trackAId,
      tutoringStepId: 'step:A',
      conceptId: 'cj.var.immutable',
      learningSkillId: 'skill:let:declare',
      blockIds: ['block:let'],
    })
    const encounterId = bootstrap.snapshot().stream[0].id

    const appendIds = ['bridge:stale', 'exposure:stale']
    const appendClient = createAIClassroom({
      catalog,
      storage,
      now: () => 200,
      createId: () => appendIds.shift()!,
    })
    const adjustmentClient = createAIClassroom({
      catalog,
      storage,
      now: () => 201,
      createId: () => 'adjustment:stale',
    })
    const exerciseClient = createAIClassroom({
      catalog,
      storage,
      now: () => 202,
      createId: () => 'exercise:stale',
    })
    const switcher = createAIClassroom({
      catalog,
      storage,
      now: () => 203,
      createId: () => 'track:B',
    })
    await Promise.all([
      appendClient.open(),
      adjustmentClient.open(),
      exerciseClient.open(),
      switcher.open(),
    ])
    await switcher.execute({
      type: 'start_learning_track',
      trackId: 'track:B',
      goal: 'Track B',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })

    await expect(appendClient.execute({
      type: 'append_bridge_note',
      learningTrackId: trackAId,
      tutoringStepId: 'step:stale-append',
      conceptId: 'cj.var.immutable',
      markdown: 'This stale command must stay scoped to Track A.',
      teacherInteractionId: 'teacher:stale',
    })).rejects.toThrow(/Track track:A is no longer active/)
    await expect(adjustmentClient.execute({
      type: 'adjust_learning_track',
      learningTrackId: trackAId,
      adjustment: {
        type: 'review',
        conceptId: 'cj.var.immutable',
        encounteredStreamEntryId: encounterId,
      },
    })).rejects.toThrow(/Track track:A is no longer active/)
    await expect(exerciseClient.execute({
      type: 'create_exercise_instance',
      learningTrackId: trackAId,
      tutoringStepId: 'step:stale-exercise',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })).rejects.toThrow(/Track track:A is no longer active/)

    expect(await storage.load()).toMatchObject({
      revision: 3,
      activeTrackId: 'track:B',
      stream: [{
        id: 'stream:A',
        learningTrackId: 'track:A',
      }],
    })
  })

  it('does not publish a candidate snapshot when persistence fails', async () => {
    const storage = {
      load: async () => null,
      save: async () => {
        throw new Error('disk full')
      },
    }
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage,
      now: () => 100,
      createId: () => 'track:1',
    })
    await classroom.open()
    let notifications = 0
    classroom.subscribe(() => notifications++)

    await expect(classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })).rejects.toThrow('disk full')
    expect(classroom.snapshot()).toEqual(createEmptyClassroom())
    expect(notifications).toBe(0)
  })

  it('does not report a committed command as failed when a subscriber throws', async () => {
    const observerErrors: unknown[] = []
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => 'track:1',
      onStorageError: error => observerErrors.push(error),
    })
    await classroom.open()
    classroom.subscribe(() => {
      throw new Error('broken observer')
    })

    await expect(classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })).resolves.toMatchObject({ revision: 1 })
    expect(observerErrors).toMatchObject([{ message: 'broken observer' }])
  })

  it('rejects unknown command fields at the runtime boundary', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => 'unused',
    })
    await classroom.open()

    await expect(classroom.execute({
      type: 'remove_review_artifact',
      artifactId: 'missing',
      unexpected: true,
    } as never)).rejects.toThrow(/unrecognized|unexpected/i)
  })

  it('prevents retained explanations from becoming generated long-form tutorials', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
    })
    await classroom.open()

    await expect(classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:tutorial',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'tutorial',
      markdown: '# 完整教程\n\n这不再是短 Clarification。',
    })).rejects.toThrow(/Clarification.*tutorial headings/i)
    await expect(classroom.execute({
      type: 'retain_remediation',
      artifactId: 'artifact:tutorial',
      failedAttemptId: 'attempt:missing',
      misconceptionTheme: 'tutorial',
      markdown: '## 从头教学\n\n这不再是针对失败的 Remediation。',
    })).rejects.toThrow(/Remediation.*tutorial headings/i)
    expect(classroom.snapshot()).toEqual(createEmptyClassroom())
  })

  it('rejects unknown persisted-state fields at the runtime boundary', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: {
        load: async () => ({ ...createEmptyClassroom(), unexpected: true }),
        save: async () => undefined,
      },
      now: () => 100,
      createId: () => 'unused',
    })

    await expect(classroom.open()).rejects.toThrow(/unrecognized|unexpected/i)
  })

  it('preserves the caller-owned UUID-quality Learning Track identity', async () => {
    const trackId = globalThis.crypto.randomUUID()
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })

    expect(classroom.snapshot().tracks[0].id).toBe(trackId)
  })

  it('does not expose mutable aggregate state to callers', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => 'unused',
    })
    const opened = await classroom.open()
    opened.revision = 99
    classroom.snapshot().tracks.push({
      id: 'forged',
      goal: 'forged',
      conceptIds: ['cj.var.immutable'],
      contentVersions: { 'cj.var.immutable': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      createdAt: 0,
      recordedRevision: 1,
      adjustments: [],
    })

    expect(classroom.snapshot()).toEqual(createEmptyClassroom())
  })

  it('preserves Course Content Pack order in a Content Reference Group', async () => {
    const ids = ['track:1', 'stream:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!

    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      learningSkillId: 'skill:let:declare',
      blockIds: ['block:let:code', 'block:let'],
    })).rejects.toThrow(/Course Content Pack order/)
    expect(classroom.snapshot().stream).toEqual([])
  })

  it('creates versioned deterministic scaffolding variants without changing the evaluator', async () => {
    const ids = ['track:1', 'exercise:standard', 'exercise:easy', 'exercise:hard']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!

    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:2',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { difficultyTarget: 'easy' },
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:3',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { difficultyTarget: 'hard' },
    })

    const instances = classroom.snapshot().stream.filter(entry =>
      entry.type === 'exercise_instance')
    expect(instances[0]).toMatchObject({
      id: 'exercise:standard',
      type: 'exercise_instance',
      conceptId: 'cj.var.immutable',
      learningSkillId: 'skill:let:declare',
      templateId: 'template:let:practice',
      templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      personalizationPolicyVersion: 2,
      effectiveDifficulty: 'standard',
      task: {
        type: 'code_output',
        starterCode: 'main() {}',
        expectedOutput: '42',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    })
    expect(instances[1]).toMatchObject({
      id: 'exercise:easy',
      effectiveDifficulty: 'easy',
      task: {
        starterCode: 'main() {}',
        expectedOutput: '42',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: ['先检查不可变绑定的声明和值。'],
      },
    })
    expect(instances[2]).toMatchObject({
      id: 'exercise:hard',
      effectiveDifficulty: 'hard',
      task: {
        starterCode: '',
        expectedOutput: '42',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    })
    expect(instances[1]?.task).not.toEqual(instances[0]?.task)
  })

  it('rejects an easy target when its template has no authored scaffolding', async () => {
    const contentPack = pack('approved')
    const template = contentPack.exerciseTemplates.find(candidate =>
      candidate.id === 'template:let:practice')
    if (!template || template.task.type !== 'code_output')
      throw new Error('expected code-output practice template')
    template.task.hints = []
    const ids = ['track:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })

    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: classroom.snapshot().activeTrackId!,
      tutoringStepId: 'step:easy',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { difficultyTarget: 'easy' },
    })).rejects.toThrow(/no authored easy scaffolding variant/)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: classroom.snapshot().activeTrackId!,
      tutoringStepId: 'step:medium',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { difficultyTarget: 'medium' },
    } as never)).rejects.toThrow(/invalid option|easy.*hard/i)
    expect(classroom.snapshot().stream).toEqual([])
  })

  it('does not award output-only success when the Learning Skill source contract is missing', async () => {
    const strictPack = pack('approved')
    const practice = strictPack.exerciseTemplates.find(template =>
      template.id === 'template:let:practice')
    if (!practice || practice.task.type !== 'code_output')
      throw new Error('expected code-output practice template')
    practice.task.sourceRequirements = [
      { type: 'binding', binding: 'let', name: 'answer' },
      { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
    ]
    const ids = [
      'track:1',
      'exercise:1',
      'evidence:1',
      'remediation:1',
      'marker:1',
      'evidence:2',
      'remediation:2',
      'marker:2',
      'evidence:3',
    ]
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([strictPack]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: practice.id,
      personalizationInputs: {},
    })

    const shortcutAttempt = {
      type: 'record_exercise_attempt',
      attemptId: 'attempt:shortcut',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42\n', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    } as const
    const failedSnapshot = await classroom.execute(shortcutAttempt)
    expect(classroom.snapshot().attempts.at(-1)?.result.passed).toBe(false)
    expect(classroom.snapshot().reviewArtifacts).toHaveLength(1)
    expect((await classroom.execute(shortcutAttempt)).revision).toBe(failedSnapshot.revision)
    expect(classroom.snapshot().reviewArtifacts).toHaveLength(1)

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:stderr-is-not-stdout',
      exerciseInstanceId: 'exercise:1',
      submission: {
        type: 'code_output',
        code: 'main(): Int64 { let answer = 42; println(answer); return 0 }',
      },
      observation: {
        type: 'run_result',
        result: {
          ok: true,
          phase: 'run',
          stdout: '',
          stdoutTruncated: false,
          stderr: '42\n',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: 0,
        },
      },
    })
    const stderrAttempt = classroom.snapshot().attempts.at(-1)
    expect(stderrAttempt?.result).toMatchObject({
      passed: false,
    })
    expect(renderPersistedDiagnostic(stderrAttempt!.result.stdout!)).toBe('')
    expect(renderPersistedDiagnostic(stderrAttempt!.result.stderr!)).toBe('42\n')

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:valid',
      exerciseInstanceId: 'exercise:1',
      submission: {
        type: 'code_output',
        code: 'main(): Int64 { let answer = 42; println(answer); return 0 }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42\n', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(classroom.snapshot().attempts.at(-1)?.result.passed).toBe(true)
  })

  it('fails closed when stdout was truncated even if the retained prefix contains the expected output', async () => {
    const contentPack = structuredClone(pack('approved'))
    const practice = contentPack.exerciseTemplates.find(template =>
      template.id === 'template:let:practice')
    if (!practice || practice.task.type !== 'code_output')
      throw new Error('expected code-output practice template')
    const storage = createMemoryClassroomStorage()
    const ids = [
      'track:truncated',
      'exercise:truncated',
      'evidence:truncated',
      'remediation:truncated',
      'marker:truncated',
    ]
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage,
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '验证截断输出',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: classroom.snapshot().activeTrackId!,
      tutoringStepId: 'step:truncated',
      conceptId: 'cj.var.immutable',
      contentVersion: contentPack.version,
      templateId: practice.id,
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:truncated',
      exerciseInstanceId: 'exercise:truncated',
      submission: {
        type: 'code_output',
        code: 'main() { println(42) }',
      },
      observation: {
        type: 'run_result',
        result: {
          ok: true,
          phase: 'run',
          stdout: '42',
          stdoutTruncated: true,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: 0,
        },
      },
    })

    const attempt = classroom.snapshot().attempts.at(-1)!
    expect(attempt.result.passed).toBe(false)
    expect(attempt.result.outputEvaluation).toMatchObject({
      matched: false,
      stdoutSourceTruncated: true,
    })
    expect(attempt.result.stdout).toMatchObject({
      head: '42',
      sourceTruncated: true,
      omittedUtf8Bytes: 0,
    })

    const reopened = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage,
    })
    await expect(reopened.open()).resolves.toMatchObject({
      attempts: [expect.objectContaining({
        result: expect.objectContaining({ passed: false }),
      })],
    })
  })

  it('persists revealed hints and derives all later Attempt assistance from history', async () => {
    let now = 100
    const catalog = createContentPackCatalog([pack('approved')])
    const storage = createMemoryClassroomStorage()
    const ids = ['track:1', 'exercise:1', 'assistance:1', 'evidence:1']
    const first = createAIClassroom({
      catalog,
      storage,
      now: () => now,
      createId: () => ids.shift()!,
    })
    await first.open()
    await first.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = first.snapshot().activeTrackId!
    await first.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { difficultyTarget: 'easy' },
    })
    const assistanceSnapshot = await first.execute({
      type: 'record_exercise_assistance',
      exerciseInstanceId: 'exercise:1',
      assistance: { type: 'hint', hintIndex: 0 },
    })
    expect(assistanceSnapshot.assistanceEvents).toMatchObject([{
      id: 'assistance:1',
      type: 'hint',
      hintIndex: 0,
      exerciseInstanceId: 'exercise:1',
    }])
    expect((await first.execute({
      type: 'record_exercise_assistance',
      exerciseInstanceId: 'exercise:1',
      assistance: { type: 'hint', hintIndex: 0 },
    })).revision).toBe(assistanceSnapshot.revision)

    now = 200
    await first.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:1',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run' as const, stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(first.snapshot().attempts[0]).toMatchObject({
      assistance: 'hint',
      assistanceEventIds: ['assistance:1'],
    })
    expect(first.snapshot().evidence[0].type).toBe('aided')

    now = 300
    const reopened = createAIClassroom({
      catalog,
      storage,
      now: () => now,
      createId: () => 'evidence:2',
    })
    await reopened.open()
    await reopened.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:2',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(reopened.snapshot().attempts[1]).toMatchObject({
      assistance: 'hint',
      assistanceEventIds: ['assistance:1'],
    })
    expect(reopened.snapshot().evidence[1].type).toBe('aided')
  })

  it('carries same-assessment hint assistance across reload, a new Track, and a new instance', async () => {
    const catalog = createContentPackCatalog([pack('approved')])
    const storage = createMemoryClassroomStorage()
    let sequence = 0
    const first = createAIClassroom({
      catalog,
      storage,
      now: () => 100,
      createId: () => `first:${++sequence}`,
    })
    await first.open()
    await first.execute({
      type: 'start_learning_track',
      trackId: `first:${++sequence}`,
      goal: 'First goal',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await first.execute({
      type: 'create_exercise_instance',
      learningTrackId: first.snapshot().activeTrackId!,
      tutoringStepId: 'hinted-instance',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { difficultyTarget: 'easy' },
    })
    const hintedInstance = first.snapshot().stream.find(
      entry => entry.type === 'exercise_instance',
    )
    if (!hintedInstance)
      throw new Error('expected a hinted Exercise Instance')
    await first.execute({
      type: 'record_exercise_assistance',
      exerciseInstanceId: hintedInstance.id,
      assistance: { type: 'hint', hintIndex: 0 },
    })
    const hintId = first.snapshot().assistanceEvents[0]!.id
    await first.dispose()

    const reopened = createAIClassroom({
      catalog,
      storage,
      now: () => 200,
      createId: () => `reopened:${++sequence}`,
    })
    await reopened.open()
    await reopened.execute({
      type: 'start_learning_track',
      trackId: `reopened:${++sequence}`,
      goal: 'Second goal',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await reopened.execute({
      type: 'create_exercise_instance',
      learningTrackId: reopened.snapshot().activeTrackId!,
      tutoringStepId: 'same-assessment-after-reload',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    const repeatedInstance = reopened.snapshot().stream.filter(entry => entry.type === 'exercise_instance').at(-1)
    if (!repeatedInstance)
      throw new Error('expected a repeated Exercise Instance')
    await reopened.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:after-hint',
      exerciseInstanceId: repeatedInstance.id,
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    expect(reopened.snapshot().attempts.at(-1)).toMatchObject({
      assistance: 'hint',
      assistanceEventIds: [hintId],
    })
    expect(reopened.snapshot().evidence.at(-1)?.type).toBe('aided')
  })

  it('records retries and new instances of an attempted static form as Practice Evidence', async () => {
    const contentPack = pack('approved')
    const catalog = createContentPackCatalog([contentPack])
    let sequence = 0
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => 100 + sequence,
      createId: () => `generated:${++sequence}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++sequence}`,
      goal: 'Practice without brute-force evidence inflation',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'quiz:first',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:quiz',
      personalizationInputs: {},
    })
    const firstInstance = classroom.snapshot().stream.find(
      entry => entry.type === 'exercise_instance',
    )
    if (!firstInstance)
      throw new Error('expected the first quiz Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:wrong',
      exerciseInstanceId: firstInstance.id,
      submission: { type: 'quiz', answerIndices: [[1], [0]] },
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:retry-correct',
      exerciseInstanceId: firstInstance.id,
      submission: { type: 'quiz', answerIndices: [[0, 2], [1]] },
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'quiz:new-instance-same-form',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:quiz',
      personalizationInputs: {},
    })
    const secondInstance = classroom.snapshot().stream.filter(entry => entry.type === 'exercise_instance').at(-1)
    if (!secondInstance)
      throw new Error('expected the repeated quiz Exercise Instance')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:new-instance-correct',
      exerciseInstanceId: secondInstance.id,
      submission: { type: 'quiz', answerIndices: [[0, 2], [1]] },
    })

    expect(classroom.snapshot().evidence.map(item => item.type)).toEqual([
      'independent',
      'practice',
      'practice',
    ])
    expect(deriveConceptProgress(classroom.snapshot(), contentPack)).toBe('practicing')

    const forged = structuredClone(classroom.snapshot())
    forged.evidence[1]!.type = 'independent'
    const forgedClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(forgedClassroom.open()).rejects.toThrow(/assessment freshness/)
  })

  it('makes every Attempt after the workspace Teacher Exposure Epoch aided', async () => {
    const ids = ['track:1', 'exercise:1', 'interaction:1', 'evidence:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    const marked = await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:turn-1',
    })
    expect(marked.teacherExposureEpoch).toMatchObject({
      id: 'interaction:1',
      interactionId: 'teacher:turn-1',
    })
    expect((await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:turn-2',
    })).revision).toBe(marked.revision)

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:1',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(classroom.snapshot().attempts[0]).toMatchObject({
      assistance: 'teacher_exposure',
      assistanceEventIds: [],
      teacherExposureEpochId: 'interaction:1',
    })
    expect(classroom.snapshot().evidence[0]?.type).toBe('aided')
  })

  it('uses revision-causal timestamps when the client wall clock moves backward', async () => {
    let now = 10_000
    const ids = ['track:1', 'exercise:1', 'exposure:1', 'evidence:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => now,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: 'Survive a wall-clock rollback',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: classroom.snapshot().activeTrackId!,
      tutoringStepId: 'step:before-rollback',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:before-rollback',
    })

    now = 1
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:after-rollback',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    expect(classroom.snapshot().attempts[0]).toMatchObject({
      assistance: 'teacher_exposure',
      createdAt: 10_000,
      teacherExposureEpochId: 'exposure:1',
    })
    expect(classroom.snapshot().evidence[0]?.type).toBe('aided')
  })

  it.each([
    {
      templateId: 'template:let:recall',
      submission: { type: 'recall' as const, answer: 'let binding' },
    },
    {
      templateId: 'template:let:quiz',
      submission: { type: 'quiz' as const, answerIndices: [[0, 2], [1]] },
    },
  ])(
    'treats the Teacher Exposure Epoch as assistance for $templateId',
    async ({ submission, templateId }) => {
      const ids = ['track:1', 'interaction:1', 'exercise:1', 'evidence:1']
      const classroom = createAIClassroom({
        catalog: createContentPackCatalog([pack('approved')]),
        storage: createMemoryClassroomStorage(),
        now: () => 100,
        createId: () => ids.shift()!,
      })
      await classroom.open()
      await classroom.execute({
        type: 'start_learning_track',
        trackId: ids.shift()!,
        goal: '学习不可变绑定',
        conceptIds: ['cj.var.immutable'],
        explicitLearnerGoal: true,
      })
      await classroom.execute({
        type: 'record_teacher_exposure',
        interactionId: 'teacher:turn-1',
      })
      await classroom.execute({
        type: 'create_exercise_instance',
        learningTrackId: classroom.snapshot().activeTrackId!,
        tutoringStepId: 'step:1',
        conceptId: 'cj.var.immutable',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        templateId,
        personalizationInputs: {},
      })
      if (submission.type === 'recall') {
        await classroom.execute({
          type: 'record_exercise_attempt',
          attemptId: 'attempt:1',
          exerciseInstanceId: 'exercise:1',
          submission,
        })
      }
      else {
        await classroom.execute({
          type: 'record_exercise_attempt',
          attemptId: 'attempt:1',
          exerciseInstanceId: 'exercise:1',
          submission,
        })
      }

      expect(classroom.snapshot().attempts[0]).toMatchObject({
        assistance: 'teacher_exposure',
        assistanceEventIds: [],
        teacherExposureEpochId: 'interaction:1',
      })
      expect(classroom.snapshot().evidence[0]?.type).toBe('aided')
    },
  )

  it('keeps the exposure epoch across reload, a new Track, and a future Exercise Instance', async () => {
    const catalog = createContentPackCatalog([pack('approved')])
    const storage = createMemoryClassroomStorage()
    const firstIds = ['track:first', 'exposure:workspace']
    const first = createAIClassroom({
      catalog,
      storage,
      now: () => 100,
      createId: () => firstIds.shift()!,
    })
    await first.open()
    await first.execute({
      type: 'start_learning_track',
      trackId: firstIds.shift()!,
      goal: 'First goal',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await first.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:first-track',
    })
    await first.dispose()

    const reopenedIds = ['track:second', 'exercise:future', 'evidence:future']
    const reopened = createAIClassroom({
      catalog,
      storage,
      now: () => 200,
      createId: () => reopenedIds.shift()!,
    })
    await reopened.open()
    await reopened.execute({
      type: 'start_learning_track',
      trackId: reopenedIds.shift()!,
      goal: 'Second goal',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await reopened.execute({
      type: 'create_exercise_instance',
      learningTrackId: reopened.snapshot().activeTrackId!,
      tutoringStepId: 'future-instance-after-reload',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:recall',
      personalizationInputs: {},
    })
    await reopened.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:future',
      exerciseInstanceId: 'exercise:future',
      submission: { type: 'recall', answer: 'let binding' },
    })

    expect(reopened.snapshot().teacherExposureEpoch?.id).toBe('exposure:workspace')
    expect(reopened.snapshot().attempts[0]).toMatchObject({
      assistance: 'teacher_exposure',
      teacherExposureEpochId: 'exposure:workspace',
    })
    expect(reopened.snapshot().evidence[0]?.type).toBe('aided')
  })

  it('does not retroactively rewrite an Attempt recorded before exposure', async () => {
    const ids = ['track:1', 'exercise:1', 'evidence:1', 'exposure:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: classroom.snapshot().activeTrackId!,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:recall',
      personalizationInputs: {},
    })
    const attempt = {
      type: 'record_exercise_attempt' as const,
      attemptId: 'attempt:before-exposure',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'recall' as const, answer: 'let binding' },
    }
    await classroom.execute(attempt)
    await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:later',
    })
    const replayed = await classroom.execute(attempt)

    expect(replayed.attempts[0]).toMatchObject({
      assistance: 'none',
      teacherExposureEpochId: null,
    })
    expect(replayed.evidence[0]?.type).toBe('independent')
  })

  it('rejects dangling Personalization Input references', async () => {
    const ids = ['track:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!

    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { declaredBackgroundIds: ['background:missing'] },
    } as never)).rejects.toThrow(/unrecognized|declaredBackgroundIds/i)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { unresolvedFailureEvidenceIds: ['evidence:missing'] },
    })).rejects.toThrow(/unresolved failure Learning Evidence/)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:legacy-error-pattern',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { recentErrorPatternIds: ['evidence:missing'] },
    } as never)).rejects.toThrow(/unrecognized|recentErrorPatternIds/i)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { remediationArtifactIds: ['artifact:missing'] },
    })).rejects.toThrow(/Remediation/)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:placement',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: { recentCodeSummary: 'unverified model prose' },
    } as never)).rejects.toThrow(/unrecognized|recentCodeSummary/i)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:recall-personalized',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:recall',
      personalizationInputs: { difficultyTarget: 'hard' },
    })).rejects.toThrow(/no validated personalization policy/i)
  })

  it('accepts only unresolved failures after the latest success and preserves historical causality', async () => {
    const catalog = createContentPackCatalog([pack('approved')])
    const ids = [
      'track:1',
      'exercise:base',
      'evidence:old-failure',
      'remediation:old',
      'marker:old',
      'exercise:before-success',
      'evidence:success',
      'evidence:new-failure',
      'remediation:new',
      'marker:new',
      'exercise:after-success',
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
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:base',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:old-failure',
      exerciseInstanceId: 'exercise:base',
      submission: { type: 'code_output', code: 'main() { println(41) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '41', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:before-success',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:old-failure'],
      },
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:success',
      exerciseInstanceId: 'exercise:base',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:resolved-failure-reuse',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:old-failure'],
      },
    })).rejects.toThrow(/not current unresolved failure/i)

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:new-failure',
      exerciseInstanceId: 'exercise:base',
      submission: { type: 'code_output', code: 'main() { println(40) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '40', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:after-success',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:new-failure'],
      },
    })

    const validSnapshot = classroom.snapshot()
    const reopened = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(validSnapshot),
      now: () => 101,
      createId: () => 'unused',
    })
    await expect(reopened.open()).resolves.toMatchObject({
      revision: validSnapshot.revision,
    })

    const tampered = structuredClone(validSnapshot)
    const postSuccess = tampered.stream.find(entry =>
      entry.type === 'exercise_instance'
      && entry.tutoringStepId === 'step:after-success')
    if (!postSuccess || postSuccess.type !== 'exercise_instance')
      throw new Error('missing post-success Exercise Instance fixture')
    postSuccess.personalizationInputs.unresolvedFailureEvidenceIds = [
      'evidence:old-failure',
    ]
    const rejected = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(tampered),
      now: () => 101,
      createId: () => 'unused',
    })
    await expect(rejected.open()).rejects.toThrow(
      /resolved or inapplicable failure Learning Evidence/i,
    )
  })

  it('evaluates Recall submissions with deterministic normalized exact matching', async () => {
    const ids = ['track:1', 'exercise:recall', 'evidence:recall']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:recall',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:recall',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:recall',
      exerciseInstanceId: 'exercise:recall',
      submission: { type: 'recall', answer: '  let   binding  ' },
    })

    expect(classroom.snapshot().attempts[0].result.passed).toBe(true)
    expect(classroom.snapshot().evidence[0]).toMatchObject({
      type: 'independent',
      outcome: 'success',
    })
  })

  it('evaluates Quiz submissions by deterministic per-question answer sets', async () => {
    const ids = ['track:1', 'exercise:quiz', 'evidence:quiz']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:quiz',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:quiz',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:quiz',
      exerciseInstanceId: 'exercise:quiz',
      submission: { type: 'quiz', answerIndices: [[2, 0], [1]] },
    })

    expect(classroom.snapshot().attempts[0].result.passed).toBe(true)
    expect(classroom.snapshot().evidence[0]).toMatchObject({
      type: 'independent',
      outcome: 'success',
    })
  })

  it('rejects a submission shape that does not match the Exercise Instance', async () => {
    const ids = ['track:1', 'exercise:recall']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:recall',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:recall',
      personalizationInputs: {},
    })

    await expect(classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:wrong',
      exerciseInstanceId: 'exercise:recall',
      submission: { type: 'quiz', answerIndices: [[0]] },
    })).rejects.toThrow(/does not match/)
  })

  it('appends bounded Bridge Notes and evidence-grounded ordered Skip Markers', async () => {
    const ids = [
      'track:1',
      'bridge:1',
      'exposure:1',
      'exercise:1',
      'evidence:1',
      'skip:1',
    ]
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await expect(classroom.execute({
      type: 'append_bridge_note',
      learningTrackId,
      tutoringStepId: 'step:forged-content',
      conceptId: 'cj.var.immutable',
      markdown: '# 重新教学\n\n```cangjie\nmain() {}\n```',
      teacherInteractionId: 'teacher:forged',
    })).rejects.toThrow(/Bridge Note/)
    expect(classroom.snapshot().teacherExposureEpoch).toBeNull()
    await classroom.execute({
      type: 'append_bridge_note',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      markdown: '你已经展示了基础语法，因此我们直接连接到不可变性。',
      teacherInteractionId: 'teacher:bridge',
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:evidence',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:success',
      exerciseInstanceId: 'exercise:1',
      submission: {
        type: 'code_output',
        code: 'main() { let answer = 42; println(answer) }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'append_skip_marker',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      blockIds: ['block:let', 'block:let:code'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:1'],
      },
    })

    const exposureRevision = classroom.snapshot().teacherExposureEpoch?.recordedRevision
    expect(exposureRevision).toBeDefined()
    expect(classroom.snapshot().teacherExposureEpoch).toMatchObject({
      recordedRevision: 2,
    })
    expect(classroom.snapshot().stream).toMatchObject([
      { id: 'bridge:1', type: 'bridge_note' },
      { id: 'exercise:1', type: 'exercise_instance' },
      {
        id: 'skip:1',
        type: 'skip_marker',
        blockIds: ['block:let', 'block:let:code'],
        basis: {
          type: 'successful_evidence',
          evidenceIds: ['evidence:1'],
        },
      },
    ])
  })

  it('requires exact current success witnesses for every key skill and rejects blocked Concepts', async () => {
    const contentPack = pack('approved')
    contentPack.learningSkills.push({
      id: 'skill:let:explain',
      conceptId: contentPack.concept.id,
      title: 'Explain immutable binding',
      description: 'Explain why the binding cannot be reassigned.',
      key: true,
    })
    contentPack.exerciseTemplates.push({
      id: 'template:let:explain',
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningSkillId: 'skill:let:explain',
      purpose: 'practice',
      task: {
        type: 'code_output',
        prompt: 'Print the explanation check.',
        starterCode: 'main() {}',
        expectedOutput: 'explained',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    }, {
      id: 'template:let:explain:review',
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningSkillId: 'skill:let:explain',
      purpose: 'review',
      task: {
        type: 'code_output',
        prompt: 'Print a distinct explanation review check.',
        starterCode: 'main() {}',
        expectedOutput: 'explained:review',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    })
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Ground every skipped block',
      conceptIds: [contentPack.concept.id],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    const successfulChecks = [
      ['template:let:practice', '42'],
      ['template:let:explain', 'explained'],
    ] as const
    for (const [templateId, stdout] of successfulChecks) {
      await classroom.execute({
        type: 'create_exercise_instance',
        learningTrackId,
        tutoringStepId: `step:${templateId}`,
        conceptId: contentPack.concept.id,
        contentVersion: contentPack.version,
        templateId,
        personalizationInputs: {},
      })
      const exercise = classroom.snapshot().stream.at(-1)!
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: `attempt:${templateId}`,
        exerciseInstanceId: exercise.id,
        submission: {
          type: 'code_output',
          code: `main() { println("${stdout}") }`,
        },
        observation: {
          type: 'run_result',
          result: { ok: true, phase: 'run', stdout, stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
        },
      })
    }
    const evidenceIds = classroom.snapshot().evidence.map(item => item.id)
    const skip = (tutoringStepId: string, witnesses: string[]) =>
      classroom.execute({
        type: 'append_skip_marker',
        learningTrackId,
        tutoringStepId,
        conceptId: contentPack.concept.id,
        blockIds: ['block:let'],
        basis: {
          type: 'successful_evidence',
          evidenceIds: witnesses,
        },
      })

    await expect(skip('step:missing-skill', evidenceIds.slice(0, 1)))
      .rejects
      .toThrow(/every key Learning Skill/)
    await expect(skip('step:reordered', [...evidenceIds].reverse()))
      .rejects
      .toThrow(/every key Learning Skill/)
    await expect(skip('step:grounded', evidenceIds)).resolves.toMatchObject({
      teacherExposureEpoch: null,
    })

    const exercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance'
      && entry.templateId === 'template:let:practice')!
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: `attempt:block:${attempt}`,
        exerciseInstanceId: exercise.id,
        submission: {
          type: 'code_output',
          code: 'main() { println(0) }',
        },
        observation: {
          type: 'run_result',
          result: { ok: true, phase: 'run', stdout: '0', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
        },
      })
    }
    await expect(skip('step:blocked', evidenceIds))
      .rejects
      .toThrow(/pacing frontier/)
  })

  it('uses current non-Placement Evidence across Tracks without reopening Teacher Exposure', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'First Track',
      conceptIds: ['track.first'],
      explicitLearnerGoal: true,
    })
    const firstTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: firstTrackId,
      tutoringStepId: 'step:first-track-practice',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream[0]
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:first-track-success',
      exerciseInstanceId: exercise.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const priorTrackEvidenceId = classroom.snapshot().evidence[0].id
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Second Track',
      conceptIds: ['track.first', 'track.second'],
      explicitLearnerGoal: true,
    })
    const secondTrackId = classroom.snapshot().activeTrackId!

    await expect(classroom.execute({
      type: 'append_skip_marker',
      learningTrackId: secondTrackId,
      tutoringStepId: 'step:prior-track-skip',
      conceptId: 'track.first',
      blockIds: ['block:first'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: [priorTrackEvidenceId],
      },
    })).resolves.toMatchObject({
      teacherExposureEpoch: null,
      stream: [
        {},
        {
          type: 'skip_marker',
          learningTrackId: secondTrackId,
        },
      ],
    })
  })

  it('uses the current applicable acceleration and rejects a superseded basis', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    const third = trackPack('track.third', ['track.second'], '3')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second, third]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Accelerate twice',
      conceptIds: ['track.first', 'track.second', 'track.third'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    const accelerate = async (conceptId: string, expectedOutput: string) => {
      const suffix = conceptId.split('.').at(-1)!
      await classroom.execute({
        type: 'create_exercise_instance',
        learningTrackId,
        tutoringStepId: `step:${suffix}:placement`,
        conceptId,
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        templateId: `template:${suffix}:placement`,
        personalizationInputs: {},
      })
      const exercise = classroom.snapshot().stream.at(-1)!
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: `attempt:${suffix}:placement`,
        exerciseInstanceId: exercise.id,
        submission: {
          type: 'code_output',
          code: `main() { println(${expectedOutput}) }`,
        },
        observation: {
          type: 'run_result',
          result: {
            ok: true,
            phase: 'run',
            stdout: expectedOutput,
            stdoutTruncated: false,
            stderr: '',
            stderrTruncated: false,
            compilerOutput: '',
            compilerOutputTruncated: false,
            exitCode: 0,
          },
        },
      })
      const placementEvidenceId = classroom.snapshot().evidence.at(-1)!.id
      await classroom.execute({
        type: 'adjust_learning_track',
        learningTrackId,
        adjustment: {
          type: 'accelerate',
          conceptId,
          placementEvidenceId,
        },
      })
      return classroom.snapshot().tracks[0].adjustments.at(-1)!.id
    }
    const earlierAdjustmentId = await accelerate('track.second', '2')
    const currentAdjustmentId = await accelerate('track.third', '3')
    const append = (adjustmentId: string, step: string) =>
      classroom.execute({
        type: 'append_skip_marker',
        learningTrackId,
        tutoringStepId: step,
        conceptId: 'track.first',
        blockIds: ['block:first'],
        basis: {
          type: 'track_adjustment',
          adjustmentId,
        },
      })

    await expect(append(earlierAdjustmentId, 'step:stale'))
      .rejects
      .toThrow(/exact current applicable/)
    await expect(append(currentAdjustmentId, 'step:current'))
      .resolves
      .toMatchObject({
        stream: [
          {},
          {},
          {
            type: 'skip_marker',
            conceptId: 'track.first',
          },
        ],
      })
  })

  it('rejects a future Skip Marker even when another Track has successful Evidence', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', [], '2')
    const catalog = createContentPackCatalog([first, second])
    let id = 0
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Prior Track',
      conceptIds: ['track.second'],
      explicitLearnerGoal: true,
    })
    const priorTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: priorTrackId,
      tutoringStepId: 'step:prior-practice',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream[0]
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:prior-success',
      exerciseInstanceId: exercise.id,
      submission: { type: 'code_output', code: 'main() { println(2) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '2', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const evidenceId = classroom.snapshot().evidence[0].id
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Current Track',
      conceptIds: ['track.first', 'track.second'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    const command = {
      type: 'append_skip_marker' as const,
      learningTrackId,
      tutoringStepId: 'step:future-skip',
      conceptId: 'track.second',
      blockIds: ['block:second'],
      basis: {
        type: 'successful_evidence' as const,
        evidenceIds: [evidenceId],
      },
    }
    await expect(classroom.execute(command)).rejects.toThrow(/pacing frontier/)

    const forged = classroom.snapshot()
    forged.revision += 1
    forged.stream.push({
      id: 'skip:future',
      type: 'skip_marker',
      learningTrackId,
      tutoringStepId: command.tutoringStepId,
      conceptId: command.conceptId,
      packId: second.id,
      contentVersion: second.version,
      blockIds: command.blockIds,
      basis: command.basis,
      createdAt: 100,
      recordedRevision: forged.revision,
    })
    const restored = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(restored.open()).rejects.toThrow(/pacing frontier/)
  })

  it('derives independent Learning Evidence from an observable Exercise Attempt', async () => {
    const ids = ['track:1', 'exercise:1', 'evidence:1']
    const contentPack = pack('approved')
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:1',
      exerciseInstanceId: 'exercise:1',
      submission: {
        type: 'code_output',
        code: 'main() { let answer = 42; println(answer) }',
      },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42\n', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    expect(classroom.snapshot().attempts).toMatchObject([{
      id: 'attempt:1',
      result: { passed: true },
    }])
    expect(renderPersistedDiagnostic(
      classroom.snapshot().attempts[0].result.stdout!,
    )).toBe('42\n')
    expect(classroom.snapshot().evidence).toMatchObject([{
      id: 'evidence:1',
      type: 'independent',
      outcome: 'success',
      attemptId: 'attempt:1',
      exerciseInstanceId: 'exercise:1',
      templateId: 'template:let:practice',
    }])
    expect(deriveConceptProgress(classroom.snapshot(), contentPack)).toBe('demonstrated')
  })

  it('treats an Attempt id as idempotent only for the same observation and assistance', async () => {
    const ids = ['track:1', 'exercise:1', 'evidence:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    const original = {
      type: 'record_exercise_attempt' as const,
      attemptId: 'attempt:1',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output' as const, code: 'main() { println(42) }' },
      observation: {
        type: 'run_result' as const,
        result: { ok: true, phase: 'run' as const, stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    }
    const committed = await classroom.execute(original)

    expect((await classroom.execute(original)).revision).toBe(committed.revision)
    await expect(classroom.execute({
      ...original,
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '41', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })).rejects.toThrow(/Attempt id.*already in use/)
    await expect(classroom.execute({
      ...original,
      assistance: 'hint',
    } as never)).rejects.toThrow(/unrecognized/i)
  })

  it('does not persist an Attempt or Evidence when the runner is unavailable', async () => {
    const ids = ['track:1', 'exercise:1']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    const before = classroom.snapshot()

    await expect(classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:contradictory-run-result',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: {
          ok: false,
          phase: 'run',
          stdout: '42',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: 0,
        },
      },
    })).rejects.toThrow(/run success must agree with the binary exit code/)

    await expect(classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:blank-unavailable-message',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: {
          ok: false,
          phase: null,
          stdout: '',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: null,
          failureKind: 'runner_unavailable',
          failureMessage: '   ',
        },
      },
    })).rejects.toThrow(/failureMessage/)

    await expect(classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:unavailable',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: {
          ok: false,
          phase: null,
          stdout: '',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: null,
          failureKind: 'runner_unavailable',
          failureMessage: 'offline',
        },
      },
    })).rejects.toThrow(/Runner unavailable/)
    expect(classroom.snapshot()).toEqual(before)
  })

  it('persists a bounded compiler diagnostic summary without duplicating raw output', async () => {
    const ids = [
      'track:1',
      'exercise:1',
      'evidence:1',
      'remediation:1',
      'marker:1',
    ]
    const storage = createMemoryClassroomStorage()
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage,
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: classroom.snapshot().activeTrackId!,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    const compilerDiagnostic = `syntax error\n${'x'.repeat(900_000)}\ntail marker`

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:compile-failure',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() {' },
      observation: {
        type: 'run_result',
        result: {
          ok: false,
          phase: 'compile',
          stdout: '',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: compilerDiagnostic,
          compilerOutputTruncated: false,
          exitCode: null,
        },
      },
    })

    const attempt = classroom.snapshot().attempts[0]
    expect(attempt.result).toMatchObject({
      passed: false,
      runnerOk: false,
      phase: 'compile',
      exitCode: null,
    })
    expect(attempt.result.compilerOutput?.originalUtf8Bytes).toBe(
      new TextEncoder().encode(compilerDiagnostic).byteLength,
    )
    expect(attempt.result.compilerOutput?.omittedUtf8Bytes).toBeGreaterThan(0)
    expect(new TextEncoder().encode(
      (attempt.result.compilerOutput?.head ?? '')
      + (attempt.result.compilerOutput?.tail ?? ''),
    ).byteLength).toBeLessThanOrEqual(MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES)
    expect(renderPersistedDiagnostic(attempt.result.compilerOutput!))
      .toMatch(/syntax error[\s\S]*tail marker/)
    expect(JSON.stringify(classroom.snapshot())).not.toContain(
      'x'.repeat(MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES + 1),
    )
    expect(classroomSnapshotUtf8Bytes(classroom.snapshot())).toBeLessThan(80_000)
    expect(attempt.result.feedback).toBeUndefined()
    expect(classroomSnapshotSchema.parse(classroom.snapshot())).toEqual(classroom.snapshot())
    await expect(storage.load()).resolves.toEqual(classroom.snapshot())
  })

  it('compacts resolved retention lifecycles through the aggregate command seam', async () => {
    let marker = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `marker:resolved:${marker++}`,
    })
    await classroom.open()

    for (let index = 0; index < MAX_RESOLVED_RETENTION_AUDIT_TAIL + 2; index++) {
      const artifactId = `artifact:resolved:${index}`
      await classroom.execute({
        type: 'retain_clarification',
        learningTrackId: null,
        artifactId,
        conceptId: 'cj.var.immutable',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        misconceptionTheme: `resolved theme ${index}`,
        markdown: `Resolved clarification ${index}.`,
      })
      await classroom.execute({
        type: 'remove_review_artifact',
        artifactId,
      })
      await classroom.execute({
        type: 'allow_review_artifact_retention',
        artifactId,
      })
    }

    const snapshot = classroom.snapshot()
    expect(snapshot.removedReviewArtifacts).toHaveLength(
      MAX_RESOLVED_RETENTION_AUDIT_TAIL,
    )
    expect(snapshot.removedReviewArtifacts.some(
      artifact => artifact.id === 'artifact:resolved:0',
    )).toBe(false)
    expect(snapshot.stream.some(
      entry => entry.type === 'retention_marker'
        && entry.artifactId === 'artifact:resolved:0',
    )).toBe(false)
    expect(snapshot.removedReviewArtifacts.every(
      artifact => !artifact.suppressionActive,
    )).toBe(true)
  })

  it('rejects unsupported Mastery Evidence instead of trusting a client clock', () => {
    const forged: unknown = {
      ...createEmptyClassroom(),
      evidence: [{
        id: 'evidence:forged',
        type: 'mastery',
        outcome: 'success',
        conceptId: 'cj.var.immutable',
        learningSkillId: 'skill:let:declare',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        createdAt: 100,
      }],
    }

    expect(classroomSnapshotSchema.safeParse(forged).success).toBe(false)
  })

  it('rejects non-addressed Content Versions at command and snapshot seams', () => {
    expect(classroomCommandSchema.safeParse({
      type: 'create_exercise_instance',
      learningTrackId: 'track:1',
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: `lc:sha256:${'a'.repeat(64)}`,
      templateId: 'template:let:practice',
      personalizationInputs: {},
    }).success).toBe(false)

    const snapshot = createEmptyClassroom()
    snapshot.tracks.push({
      id: 'track:1',
      goal: 'Reject an invalid curriculum identity.',
      conceptIds: ['cj.var.immutable'],
      contentVersions: {
        'cj.var.immutable': `lc:sha256:${'a'.repeat(64)}`,
      },
      createdAt: 1,
      recordedRevision: 1,
      adjustments: [],
    })
    expect(classroomSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects forged Learning Contract provenance on instances and evidence', async () => {
    const instanceFixture = await createPendingRemediationFixture()
    const forgedInstance = instanceFixture.classroom.snapshot()
    const instance = forgedInstance.stream.find(entry =>
      entry.type === 'exercise_instance')
    if (!instance || instance.type !== 'exercise_instance')
      throw new Error('test fixture requires an Exercise Instance')
    instance.learningContractVersion = 'lc:sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    const instanceClassroom = createAIClassroom({
      catalog: instanceFixture.catalog,
      storage: createMemoryClassroomStorage(forgedInstance),
    })
    await expect(instanceClassroom.open()).rejects.toThrow(
      /Exercise Instance.*Learning Contract Version/,
    )

    const evidenceFixture = await createPendingRemediationFixture()
    const forgedEvidence = evidenceFixture.classroom.snapshot()
    forgedEvidence.evidence[0].learningContractVersion = 'lc:sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    const evidenceClassroom = createAIClassroom({
      catalog: evidenceFixture.catalog,
      storage: createMemoryClassroomStorage(forgedEvidence),
    })
    await expect(evidenceClassroom.open()).rejects.toThrow(
      /Learning Evidence.*Learning Contract Version/,
    )
  })

  it('re-hashes persisted diagnostic previews when loading a snapshot', async () => {
    const fixture = await createPendingRemediationFixture()
    const forged = fixture.classroom.snapshot()
    const stdout = forged.attempts[0]?.result.stdout
    if (!stdout)
      throw new Error('test fixture requires persisted stdout')
    stdout.head = '42'
    expect(classroomSnapshotSchema.safeParse(forged).success).toBe(true)

    const classroom = createAIClassroom({
      catalog: fixture.catalog,
      storage: createMemoryClassroomStorage(forged),
    })

    await expect(classroom.open()).rejects.toThrow(
      /stdout preview SHA-256 does not match/i,
    )
  })

  it('fails closed on unknown historical Content Versions and altered template tasks', async () => {
    const ids = ['track:1', 'exercise:1']
    const catalog = createContentPackCatalog([pack('approved')])
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
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })

    const unknownVersion = classroom.snapshot()
    const unknownEntry = unknownVersion.stream[0]
    if (unknownEntry.type !== 'exercise_instance')
      throw new Error('expected exercise instance')
    unknownEntry.contentVersion = 'cv:sha256:0000000000000000000000000000000000000000000000000000000000000000'
    const unknownVersionClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(unknownVersion),
    })
    await expect(unknownVersionClassroom.open()).rejects.toThrow(/unknown Content Version/)

    const alteredTask = classroom.snapshot()
    const alteredEntry = alteredTask.stream[0]
    if (alteredEntry.type !== 'exercise_instance' || alteredEntry.task.type !== 'code_output')
      throw new Error('expected code-output exercise instance')
    alteredEntry.task.expectedOutput = 'forged'
    const alteredTaskClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(alteredTask),
    })
    await expect(alteredTaskClassroom.open()).rejects.toThrow(/personalization policy/i)
  })

  it('requires an explicit Content Version for exercises and Clarifications', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
    })
    await classroom.open()

    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: 'track:missing',
      tutoringStepId: 'step:missing-version',
      conceptId: 'cj.var.immutable',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    } as never)).rejects.toThrow(/contentVersion/)
    await expect(classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:missing-version',
      conceptId: 'cj.var.immutable',
      misconceptionTheme: 'missing provenance',
      markdown: 'This must not be retained without an exact version.',
    } as never)).rejects.toThrow(/contentVersion/)
  })

  it('rejects a forged deterministic result or duplicate Evidence for one Attempt', async () => {
    const ids = ['track:1', 'exercise:1', 'evidence:1']
    const catalog = createContentPackCatalog([pack('approved')])
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
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:1',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    const forgedResult = classroom.snapshot()
    forgedResult.attempts[0].result.passed = false
    const forgedResultClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forgedResult),
    })
    await expect(forgedResultClassroom.open()).rejects.toThrow(/deterministic evaluation/)

    const driftedEvaluation = classroom.snapshot()
    driftedEvaluation.attempts[0].result.outputEvaluation!.stdoutSha256
      = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    const driftedEvaluationClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(driftedEvaluation),
    })
    await expect(driftedEvaluationClassroom.open()).rejects.toThrow(
      /output evaluation drifted/,
    )

    const duplicateEvidence = classroom.snapshot()
    duplicateEvidence.evidence.push({
      ...duplicateEvidence.evidence[0],
      id: 'evidence:duplicate',
    })
    const duplicateEvidenceClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(duplicateEvidence),
    })
    await expect(duplicateEvidenceClassroom.open()).rejects.toThrow(/exactly one Learning Evidence/)
  })

  it('does not infer mastery from an untrusted delayed client timestamp', async () => {
    let now = 100
    const ids = ['track:1', 'exercise:practice', 'evidence:practice', 'exercise:review', 'evidence:review']
    const contentPack = pack('approved')
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage: createMemoryClassroomStorage(),
      now: () => now,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:practice',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:practice',
      exerciseInstanceId: 'exercise:practice',
      submission: { type: 'code_output', code: 'main() { println(42) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '42', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(deriveConceptProgress(classroom.snapshot(), contentPack)).toBe('demonstrated')

    now += 2 * 86_400_000
    await classroom.execute({
      type: 'create_review_check',
      learningTrackId,
      tutoringStepId: 'step:review',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:review',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:review',
      exerciseInstanceId: 'exercise:review',
      submission: { type: 'code_output', code: 'main() { println(84) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '84', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    expect(classroom.snapshot().evidence.at(-1)?.type).toBe('independent')
    expect(deriveConceptProgress(classroom.snapshot(), contentPack)).toBe('demonstrated')
  })

  it('never treats a delayed replay of the same Review assessment contract as mastery', async () => {
    let now = 100
    const ids = [
      'track:1',
      'exercise:review:first',
      'evidence:review:first',
      'exercise:review:replay',
      'evidence:review:replay',
    ]
    const contentPack = pack('approved')
    const catalog = createContentPackCatalog([contentPack])
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => now,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_review_check',
      learningTrackId,
      tutoringStepId: 'step:review:first',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:review',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:review:first',
      exerciseInstanceId: 'exercise:review:first',
      submission: { type: 'code_output', code: 'main() { println(84) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '84', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    now += 2 * 86_400_000
    await classroom.execute({
      type: 'create_review_check',
      learningTrackId,
      tutoringStepId: 'step:review:replay',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:review',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:review:replay',
      exerciseInstanceId: 'exercise:review:replay',
      submission: { type: 'code_output', code: 'main() { println(84) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '84', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    expect(classroom.snapshot().evidence.map(item => item.type)).toEqual([
      'independent',
      'practice',
    ])
    expect(deriveConceptProgress(classroom.snapshot(), contentPack)).toBe('demonstrated')
  })

  it('supports Retained Item Control without rewriting the Classroom Stream', async () => {
    const ids = ['marker:1', 'marker:2']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()

    await classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: '重新赋值与重新声明',
      markdown: '`let` 不能重新赋值，也不能在同一作用域遮蔽。',
    })
    await classroom.execute({
      type: 'remove_review_artifact',
      artifactId: 'artifact:1',
    })

    expect(classroom.snapshot().reviewArtifacts).toEqual([])
    expect(classroom.snapshot().removedReviewArtifacts).toMatchObject([{
      id: 'artifact:1',
      type: 'clarification',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      removedAt: 100,
      createdRevision: 1,
      updatedRevision: 1,
      removedRevision: 2,
      retentionAllowedRevision: null,
    }])
    expect(classroom.snapshot().stream).toMatchObject([{
      type: 'retention_marker',
      artifactId: 'artifact:1',
      artifactType: 'clarification',
    }])
    await expect(classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: '重新赋值与重新声明',
      markdown: '`let` 不能重新赋值，也不能在同一作用域遮蔽。',
    })).rejects.toThrow(/cannot be reused/)
    await expect(classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:new-id',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: '  重新赋值与重新声明！ ',
      markdown: '换一个随机 ID 也不能绕过相同主题的 suppression。',
    })).rejects.toThrow(/suppressed/)

    await classroom.execute({
      type: 'allow_review_artifact_retention',
      artifactId: 'artifact:1',
    })
    await expect(classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'artifact:new-id',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: '重新赋值与重新声明',
      markdown: '学习者明确允许后，可以再次保留同一语义主题。',
    })).resolves.toMatchObject({ revision: 4 })
    expect(classroom.snapshot().removedReviewArtifacts[0]).toMatchObject({
      suppressionActive: false,
      retentionAllowedAt: 100,
      retentionAllowedRevision: 3,
    })
  })

  it('deduplicates an exact merged Clarification request without swallowing a distinct request', async () => {
    const markerIds = ['marker:first', 'marker:merge', 'marker:independent']
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => markerIds.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'retain_clarification',
      learningTrackId: null,
      artifactId: 'request:first',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'same theme',
      markdown: 'First explanation.',
    })
    const mergedCommand = {
      type: 'retain_clarification' as const,
      learningTrackId: null,
      artifactId: 'request:merge',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'same theme',
      markdown: 'Merged explanation.',
    }
    await classroom.execute(mergedCommand)
    const afterMerge = classroom.snapshot()

    await expect(classroom.execute(mergedCommand)).resolves.toEqual(afterMerge)
    expect(classroom.snapshot()).toEqual(afterMerge)

    await classroom.execute({
      ...mergedCommand,
      artifactId: 'request:independent',
    })
    expect(classroom.snapshot()).toMatchObject({
      revision: afterMerge.revision + 1,
      reviewArtifacts: [{
        id: 'request:first',
        markdown: 'Merged explanation.',
        updatedRevision: afterMerge.revision + 1,
      }],
    })
    expect(classroom.snapshot().stream).toHaveLength(afterMerge.stream.length + 1)

    await expect(classroom.execute({
      ...mergedCommand,
      markdown: 'A reused token cannot change its payload.',
    })).rejects.toThrow(/request.*already.*different/i)
  })

  it('retains Remediation only from a real failed attempt and preserves its provenance', async () => {
    let now = 100
    const catalog = createContentPackCatalog([pack('approved')])
    const ids = [
      'track:1',
      'exercise:1',
      'evidence:1',
      'remediation:1',
      'marker:1',
      'exercise:2',
      'evidence:2',
      'remediation:2',
      'marker:2',
      'remediation:restored',
      'marker:restored',
    ]
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => now,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: '学习不可变绑定',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:1',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:failed',
      exerciseInstanceId: 'exercise:1',
      submission: { type: 'code_output', code: 'main() { println(41) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '41', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(classroom.snapshot().reviewArtifacts).toMatchObject([{
      id: 'remediation:1',
      type: 'remediation',
      conceptId: 'cj.var.immutable',
      learningSkillId: 'skill:let:declare',
      diagnosticStatus: 'pending',
      misconceptionTheme: null,
      markdown: null,
      attemptIds: ['attempt:failed'],
      evidenceIds: ['evidence:1'],
      createdRevision: 3,
      updatedRevision: 3,
    }])
    await classroom.execute({
      type: 'retain_remediation',
      artifactId: 'artifact:remediation',
      failedAttemptId: 'attempt:failed',
      misconceptionTheme: '输出值不匹配',
      markdown: '检查绑定的初始值，再运行程序。',
    })

    expect(classroom.snapshot().reviewArtifacts).toMatchObject([{
      id: 'remediation:1',
      type: 'remediation',
      conceptId: 'cj.var.immutable',
      diagnosticStatus: 'ready',
      misconceptionTheme: '输出值不匹配',
      attemptIds: ['attempt:failed'],
      evidenceIds: ['evidence:1'],
      createdRevision: 3,
      updatedRevision: 4,
    }])
    expect(classroom.snapshot().stream.find(entry =>
      entry.type === 'retention_marker'
      && entry.artifactId === 'remediation:1')).toMatchObject({
      id: 'marker:1',
      type: 'retention_marker',
      artifactId: 'remediation:1',
      artifactType: 'remediation',
    })
    await expect(classroom.execute({
      type: 'retain_remediation',
      artifactId: 'artifact:retry-with-changed-content',
      failedAttemptId: 'attempt:failed',
      misconceptionTheme: '另一种诊断',
      markdown: '后台重试不能覆盖已经展示给学习者的诊断。',
    })).rejects.toThrow(/already complete with different content/)

    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:contradictory-personalization',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {
        difficultyTarget: 'hard',
        unresolvedFailureEvidenceIds: ['evidence:1'],
      },
    })).rejects.toThrow(/Hard scaffolding cannot be combined/)

    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:personalized',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:practice',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:1'],
        remediationArtifactIds: ['remediation:1'],
      },
    })
    expect(classroom.snapshot().stream.at(-1)).toMatchObject({
      type: 'exercise_instance',
      personalizationPolicyVersion: 2,
      effectiveDifficulty: 'easy',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:1'],
        remediationArtifactIds: ['remediation:1'],
      },
      task: {
        hints: ['先检查不可变绑定的声明和值。'],
      },
    })

    now = 200
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:failed:second',
      exerciseInstanceId: 'exercise:2',
      submission: { type: 'code_output', code: 'main() { println(40) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '40', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'retain_remediation',
      artifactId: 'artifact:ignored-because-theme-is-merged',
      failedAttemptId: 'attempt:failed:second',
      misconceptionTheme: '输出值不匹配',
      markdown: '检查绑定的初始值，并逐步确认输出。',
    })
    expect(classroom.snapshot().reviewArtifacts[1]).toMatchObject({
      id: 'remediation:2',
      diagnosticStatus: 'ready',
      attemptIds: ['attempt:failed:second'],
      evidenceIds: ['evidence:2'],
      createdAt: 200,
      updatedAt: 200,
      createdRevision: 6,
      updatedRevision: 7,
    })

    await classroom.execute({
      type: 'remove_review_artifact',
      artifactId: 'remediation:1',
    })
    expect(classroom.snapshot().reviewArtifacts).toHaveLength(0)
    expect(classroom.snapshot().removedReviewArtifacts).toMatchObject([
      {
        id: 'remediation:1',
        type: 'remediation',
        conceptId: 'cj.var.immutable',
        learningSkillId: 'skill:let:declare',
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:1'],
        suppressionActive: true,
        removedAt: 200,
        createdRevision: 3,
        updatedRevision: 4,
        removedRevision: 8,
        retentionAllowedRevision: null,
      },
      {
        id: 'remediation:2',
        type: 'remediation',
        attemptIds: ['attempt:failed:second'],
        evidenceIds: ['evidence:2'],
        suppressionActive: true,
        removedAt: 200,
        createdRevision: 6,
        updatedRevision: 7,
        removedRevision: 8,
        retentionAllowedRevision: null,
      },
    ])
    await expect(classroom.execute({
      type: 'retain_remediation',
      artifactId: 'remediation:new-random-id',
      failedAttemptId: 'attempt:failed',
      misconceptionTheme: '换一段措辞也不能绕过',
      markdown: '这段内容不应在 suppression 生效时被重新保留。',
    })).rejects.toThrow(/suppressed/)
    await classroom.execute({
      type: 'allow_review_artifact_retention',
      artifactId: 'remediation:1',
    })
    expect(classroom.snapshot().removedReviewArtifacts[0]).toMatchObject({
      suppressionActive: false,
      retentionAllowedRevision: 9,
    })
    expect(classroom.snapshot().reviewArtifacts).toMatchObject([{
      id: 'remediation:restored',
      type: 'remediation',
      diagnosticStatus: 'pending',
      attemptIds: ['attempt:failed'],
      evidenceIds: ['evidence:1'],
      createdRevision: 9,
    }])
    expect(classroom.snapshot().stream.at(-1)).toMatchObject({
      id: 'marker:restored',
      type: 'retention_marker',
      artifactId: 'remediation:restored',
      artifactType: 'remediation',
    })
    await expect(classroom.execute({
      type: 'retain_remediation',
      artifactId: 'remediation:new-random-id',
      failedAttemptId: 'attempt:failed',
      misconceptionTheme: '输出值不匹配',
      markdown: '学习者重新允许后，再保留这个失败谱系的诊断。',
    })).resolves.toMatchObject({ revision: 10 })
    const historicalPersonalizedExercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance' && entry.id === 'exercise:2')
    expect(historicalPersonalizedExercise).toMatchObject({
      personalizationInputs: {
        remediationArtifactIds: ['remediation:1'],
      },
    })
    expect(classroom.snapshot().attempts).toHaveLength(2)
    expect(classroom.snapshot().evidence).toHaveLength(2)

    const forgedSuppression = classroom.snapshot()
    forgedSuppression.removedReviewArtifacts[0].suppressionKey = 'forged-topic'
    const forgedSuppressionClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forgedSuppression),
    })
    await expect(forgedSuppressionClassroom.open()).rejects.toThrow(
      /forged semantic suppression/,
    )

    const forgedDiagnostic = classroom.snapshot()
    const readyRemediation = forgedDiagnostic.reviewArtifacts.find(artifact =>
      artifact.type === 'remediation')
    if (!readyRemediation)
      throw new Error('expected a ready Remediation')
    readyRemediation.diagnosticStatus = 'pending'
    const forgedDiagnosticClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forgedDiagnostic),
    })
    await expect(forgedDiagnosticClassroom.open()).rejects.toThrow(
      /diagnostic status/,
    )
  })

  it('keeps automatic and restored Remediation markers on the failed instance Track', async () => {
    const ids = [
      'track:A',
      'exercise:A:review',
      'track:B',
      'evidence:A:failure',
      'remediation:A:auto',
      'marker:A:auto',
      'remediation:A:restored',
      'marker:A:restored',
    ]
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => ids.shift()!,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: 'Track A',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    const trackAId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_review_check',
      learningTrackId: trackAId,
      tutoringStepId: 'step:A:review',
      conceptId: 'cj.var.immutable',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:let:review',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'start_learning_track',
      trackId: ids.shift()!,
      goal: 'Track B',
      conceptIds: ['cj.var.immutable'],
      explicitLearnerGoal: true,
    })
    expect(classroom.snapshot().activeTrackId).toBe('track:B')

    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:A:failed-review',
      exerciseInstanceId: 'exercise:A:review',
      submission: { type: 'code_output', code: 'main() { println(0) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '0', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    expect(classroom.snapshot().stream.find(entry =>
      entry.id === 'marker:A:auto')).toMatchObject({
      type: 'retention_marker',
      learningTrackId: 'track:A',
      artifactId: 'remediation:A:auto',
    })

    await classroom.execute({
      type: 'remove_review_artifact',
      artifactId: 'remediation:A:auto',
    })
    await classroom.execute({
      type: 'allow_review_artifact_retention',
      artifactId: 'remediation:A:auto',
    })
    await classroom.execute({
      type: 'retain_remediation',
      artifactId: 'remediation:A:fallback',
      failedAttemptId: 'attempt:A:failed-review',
      misconceptionTheme: 'historical review failure',
      markdown: 'Use the failed Review Check provenance from Track A.',
    })

    expect(classroom.snapshot()).toMatchObject({
      activeTrackId: 'track:B',
      stream: [
        {
          id: 'exercise:A:review',
          learningTrackId: 'track:A',
        },
        {
          id: 'marker:A:auto',
          learningTrackId: 'track:A',
        },
        {
          id: 'marker:A:restored',
          type: 'retention_marker',
          learningTrackId: 'track:A',
          artifactId: 'remediation:A:restored',
        },
        {
          id: 'remediation:A:fallback',
          type: 'retention_marker',
          learningTrackId: 'track:A',
          artifactId: 'remediation:A:restored',
          request: {
            artifactId: 'remediation:A:fallback',
          },
        },
      ],
    })
  })

  it('rejects Remediation for a passing or missing attempt', async () => {
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([pack('approved')]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => 'unused',
    })
    await classroom.open()

    await expect(classroom.execute({
      type: 'retain_remediation',
      artifactId: 'artifact:forged',
      failedAttemptId: 'attempt:missing',
      misconceptionTheme: 'forged',
      markdown: 'forged',
    })).rejects.toThrow(/failed Exercise Attempt/)
  })

  it('deduplicates an exact Remediation retention request by its stable token', async () => {
    const { classroom } = await createPendingRemediationFixture()
    const command = {
      type: 'retain_remediation' as const,
      artifactId: 'request:remediation',
      failedAttemptId: 'attempt:failed',
      misconceptionTheme: 'wrong output',
      markdown: 'Check the bound value before running again.',
    }
    await classroom.execute(command)
    const afterFirst = classroom.snapshot()

    await expect(classroom.execute(command)).resolves.toEqual(afterFirst)
    expect(classroom.snapshot()).toEqual(afterFirst)

    await classroom.execute({
      ...command,
      artifactId: 'request:remediation:independent',
    })
    expect(classroom.snapshot().revision).toBe(afterFirst.revision + 1)
    expect(classroom.snapshot().stream).toHaveLength(afterFirst.stream.length + 1)

    await expect(classroom.execute({
      ...command,
      markdown: 'The same request token cannot replace the completed diagnosis.',
    })).rejects.toThrow(/request.*already.*different/i)
  })

  it('persists a scheduled retry after a background Remediation diagnostic fails', async () => {
    const { catalog, classroom, setNow, storage }
      = await createPendingRemediationFixture()

    setNow(2_000)
    await classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 1,
      failure: 'generation_failed',
    } as never)
    const afterFailure = classroom.snapshot()
    await expect(classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 1,
      failure: 'generation_failed',
    })).resolves.toEqual(afterFailure)
    await expect(classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 1,
      failure: 'retention_not_completed',
    })).rejects.toThrow(/diagnostic attempt 1.*different failure/i)
    classroom.dispose()
    const reopened = createAIClassroom({ catalog, storage })
    await reopened.open()
    expect(reopened.snapshot().reviewArtifacts[0]).toMatchObject({
      id: 'remediation:1',
      diagnosticStatus: 'pending',
      diagnosticAttempts: 1,
      diagnosticFailure: 'generation_failed',
      nextDiagnosticAttemptAt: 7_000,
      updatedAt: 2_000,
      createdRevision: 3,
      updatedRevision: 4,
    })
  })

  it('ignores stale Remediation diagnostic failures from an older attempt', async () => {
    const { classroom } = await createPendingRemediationFixture()
    await classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 1,
      failure: 'generation_failed',
    })
    await classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 2,
      failure: 'retention_not_completed',
    })
    const afterLatestFailure = classroom.snapshot()

    await expect(classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 1,
      failure: 'generation_failed',
    })).resolves.toEqual(afterLatestFailure)
  })

  it('stops automatic Remediation diagnostics after three failures until the learner retries', async () => {
    const { classroom, setNow } = await createPendingRemediationFixture()

    setNow(2_000)
    await classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 1,
      failure: 'generation_failed',
    })
    setNow(7_000)
    await classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 2,
      failure: 'retention_not_completed',
    })
    setNow(17_000)
    await classroom.execute({
      type: 'record_remediation_diagnostic_failure',
      failedAttemptId: 'attempt:failed',
      diagnosticAttempt: 3,
      failure: 'generation_failed',
    })
    expect(classroom.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'failed',
      diagnosticAttempts: 3,
      diagnosticFailure: 'generation_failed',
      nextDiagnosticAttemptAt: null,
      createdRevision: 3,
      updatedRevision: 6,
    })

    setNow(20_000)
    await classroom.execute({
      type: 'retry_remediation_diagnostic',
      artifactId: 'remediation:1',
      explicitLearnerRetry: true,
    } as never)
    expect(classroom.snapshot().reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      diagnosticAttempts: 0,
      diagnosticFailure: null,
      nextDiagnosticAttemptAt: null,
      updatedAt: 20_000,
      createdRevision: 3,
      updatedRevision: 7,
    })
  })

  it('rejects forged Remediation diagnostic retry state when reopening storage', async () => {
    const { catalog, classroom } = await createPendingRemediationFixture()
    const forged = classroom.snapshot()
    const artifact = forged.reviewArtifacts[0]
    if (!artifact || artifact.type !== 'remediation')
      throw new Error('expected a pending Remediation')
    artifact.diagnosticStatus = 'failed'
    artifact.diagnosticAttempts = 1
    artifact.diagnosticFailure = 'generation_failed'
    artifact.nextDiagnosticAttemptAt = null

    const reopened = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(reopened.open()).rejects.toThrow(/diagnostic retry state/)
  })

  it('advances the default frontier after successful observable work', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Follow the authored sequence',
      conceptIds: ['track.first', 'track.second'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!

    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:jump',
      conceptId: 'track.second',
      learningSkillId: 'skill:second',
      blockIds: ['block:second'],
    })).rejects.toThrow(/current Learning Track frontier/)
    await expect(classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:jump',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:practice',
      personalizationInputs: {},
    })).rejects.toThrow(/current Learning Track frontier/)

    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:first',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    const firstExercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance' && entry.conceptId === 'track.first')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:first',
      exerciseInstanceId: firstExercise!.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:second',
      conceptId: 'track.second',
      learningSkillId: 'skill:second',
      blockIds: ['block:second'],
    })).resolves.toMatchObject({ revision: 4 })
  })

  it('advances supported pacing after Teacher-aided success without claiming demonstrated progress', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    const catalog = createContentPackCatalog([first, second])
    const storage = createMemoryClassroomStorage()
    let id = 0
    const classroom = createAIClassroom({
      catalog,
      storage,
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Keep learning with Teacher support',
      conceptIds: ['track.first', 'track.second'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:first',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:supported-pacing',
    })
    const firstExercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance' && entry.conceptId === 'track.first')!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:aided-success',
      exerciseInstanceId: firstExercise.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    const beforeAdvance = classroom.snapshot()
    expect(beforeAdvance.evidence.at(-1)?.type).toBe('aided')
    expect(deriveConceptProgress(beforeAdvance, first)).toBe('practicing')
    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:second',
      conceptId: 'track.second',
      learningSkillId: 'skill:second',
      blockIds: ['block:second'],
    })).resolves.toMatchObject({ revision: 5 })

    const reopened = createAIClassroom({ catalog, storage })
    await expect(reopened.open()).resolves.toMatchObject({ revision: 5 })
    expect(deriveConceptProgress(reopened.snapshot(), first)).toBe('practicing')
  })

  it('makes tool-addressed mainline writes idempotent without accepting changed payloads', async () => {
    const contentPack = trackPack('track.first', [], '1')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([contentPack]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Retry tools safely',
      conceptIds: ['track.first'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:skip-basis',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:placement',
      personalizationInputs: {},
    })
    const placementInstance = classroom.snapshot().stream[0]
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:skip-basis',
      exerciseInstanceId: placementInstance.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await expect(classroom.execute({
      type: 'append_skip_marker',
      learningTrackId,
      tutoringStepId: 'step:unconsumed-placement-skip',
      conceptId: 'track.first',
      blockIds: ['block:first'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: [classroom.snapshot().evidence[0].id],
      },
    })).rejects.toThrow(/pacing frontier/)
    await classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'accelerate',
        conceptId: 'track.first',
        placementEvidenceId: classroom.snapshot().evidence[0].id,
      },
    })
    await expect(classroom.execute({
      type: 'append_skip_marker',
      learningTrackId,
      tutoringStepId: 'step:placement-is-not-success-basis',
      conceptId: 'track.first',
      blockIds: ['block:first'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: [classroom.snapshot().evidence[0].id],
      },
    })).rejects.toThrow(/every key Learning Skill/)
    const skipAdjustmentId = classroom.snapshot().tracks[0].adjustments[0].id
    const commands = [
      {
        type: 'append_content_reference_group' as const,
        learningTrackId,
        tutoringStepId: 'tool:content',
        conceptId: 'track.first',
        learningSkillId: 'skill:first',
        blockIds: ['block:first'],
      },
      {
        type: 'append_bridge_note' as const,
        learningTrackId,
        tutoringStepId: 'tool:bridge',
        conceptId: 'track.first',
        markdown: 'A short path-orientation note.',
        teacherInteractionId: 'teacher:bridge',
      },
      {
        type: 'append_skip_marker' as const,
        learningTrackId,
        tutoringStepId: 'tool:skip',
        conceptId: 'track.first',
        blockIds: ['block:first'],
        basis: {
          type: 'track_adjustment' as const,
          adjustmentId: skipAdjustmentId,
        },
      },
      {
        type: 'create_exercise_instance' as const,
        learningTrackId,
        tutoringStepId: 'tool:exercise',
        conceptId: 'track.first',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        templateId: 'template:first:practice',
        personalizationInputs: {},
      },
    ]

    for (const [index, command] of commands.entries()) {
      const firstResult = await classroom.execute(command)
      const replayed = await classroom.execute(command)
      expect(replayed.revision).toBe(firstResult.revision)
      expect(replayed.stream).toHaveLength(index + 2)
    }
    await expect(classroom.execute({
      type: 'append_bridge_note',
      learningTrackId,
      tutoringStepId: 'tool:bridge',
      conceptId: 'track.first',
      markdown: 'A changed retry payload.',
      teacherInteractionId: 'teacher:changed',
    })).rejects.toThrow(/different Bridge Note/)
    expect(classroom.snapshot()).toMatchObject({
      revision: 8,
      stream: [{}, {}, {}, {}, {}],
    })
  })

  it('allows only a Placement Check before an evidence-backed accelerate adjustment', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    const third = trackPack('track.third', ['track.second'], '3')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second, third]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Check prior knowledge before advancing',
      conceptIds: ['track.first', 'track.second', 'track.third'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:placement',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:placement',
      personalizationInputs: {},
    })
    const placement = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance' && entry.purpose === 'placement')!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:placement',
      exerciseInstanceId: placement.id,
      submission: { type: 'code_output', code: 'main() { println(2) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '2', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const placementEvidence = classroom.snapshot().evidence[0]

    await expect(classroom.execute({
      type: 'append_bridge_note',
      learningTrackId,
      tutoringStepId: 'step:premature',
      conceptId: 'track.second',
      markdown: 'This is still a future Concept.',
      teacherInteractionId: 'teacher:premature',
    })).rejects.toThrow(/current Learning Track frontier/)
    const accelerate = {
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'accelerate',
        conceptId: 'track.second',
        placementEvidenceId: placementEvidence.id,
      },
    } as const
    await classroom.execute(accelerate)
    expect(classroom.snapshot().tracks[0].adjustments[0]).toMatchObject({
      type: 'accelerate',
      decision: 'accelerate_placement_success',
    })
    expect(classroom.snapshot().tracks[0].adjustments[0])
      .not
      .toHaveProperty('reason')
    await expect(classroom.execute(accelerate)).resolves.toMatchObject({ revision: 4 })
    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:accelerated',
      conceptId: 'track.second',
      learningSkillId: 'skill:second',
      blockIds: ['block:second'],
    })).resolves.toMatchObject({ revision: 5 })
    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:after-accelerated-target',
      conceptId: 'track.third',
      learningSkillId: 'skill:third',
      blockIds: ['block:third'],
    })).resolves.toMatchObject({ revision: 6 })
  })

  it('does not let unconsumed Placement Evidence silently skip a later frontier', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    const third = trackPack('track.third', ['track.second'], '3')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second, third]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Require an explicit acceleration decision',
      conceptIds: ['track.first', 'track.second', 'track.third'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:second-placement',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:placement',
      personalizationInputs: {},
    })
    const secondPlacement = classroom.snapshot().stream[0]
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:second-placement',
      exerciseInstanceId: secondPlacement.id,
      submission: { type: 'code_output', code: 'main() { println(2) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '2', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const placementEvidenceId = classroom.snapshot().evidence[0].id
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:first-practice',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    const firstExercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance' && entry.conceptId === 'track.first')!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:first',
      exerciseInstanceId: firstExercise.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })

    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:forged-third',
      conceptId: 'track.third',
      learningSkillId: 'skill:third',
      blockIds: ['block:third'],
    })).rejects.toThrow(/current Learning Track frontier/)
    await classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'accelerate',
        conceptId: 'track.second',
        placementEvidenceId,
      },
    })
    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:third',
      conceptId: 'track.third',
      learningSkillId: 'skill:third',
      blockIds: ['block:third'],
    })).resolves.toMatchObject({ revision: 7 })
  })

  it('requires failure Evidence for Focused Catch-Up and never treats a failed Placement as acceleration', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Diagnose a future Concept',
      conceptIds: ['track.first', 'track.second'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:placement',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:placement',
      personalizationInputs: {},
    })
    const placement = classroom.snapshot().stream[0]
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:failed-placement',
      exerciseInstanceId: placement.id,
      submission: { type: 'code_output', code: 'main() { println(0) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '0', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const failureEvidence = classroom.snapshot().evidence[0]

    await expect(classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'accelerate',
        conceptId: 'track.second',
        placementEvidenceId: failureEvidence.id,
      },
    })).rejects.toThrow(/successful independent Placement Evidence/)
    await classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'focused_catch_up',
        conceptId: 'track.second',
        failureEvidenceId: failureEvidence.id,
      },
    })
    await expect(classroom.execute({
      type: 'append_bridge_note',
      learningTrackId,
      tutoringStepId: 'step:catch-up',
      conceptId: 'track.second',
      markdown: 'We will focus on the observed gap.',
      teacherInteractionId: 'teacher:catch-up',
    })).resolves.toMatchObject({ revision: 5 })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:regular-practice',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:practice',
      personalizationInputs: {},
    })
    const regularPractice = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance'
      && entry.tutoringStepId === 'step:regular-practice')
    if (!regularPractice || regularPractice.type !== 'exercise_instance')
      throw new Error('expected regular practice')
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:failed-practice',
      exerciseInstanceId: regularPractice.id,
      submission: { type: 'code_output', code: 'main() { println(0) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '0', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    const practiceFailure = classroom.snapshot().evidence.at(-1)
    if (!practiceFailure)
      throw new Error('expected practice failure Evidence')
    await expect(classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'focused_catch_up',
        conceptId: 'track.second',
        failureEvidenceId: practiceFailure.id,
      },
    })).rejects.toThrow(/failed Placement Evidence/)
  })

  it('constrains review and delay adjustments to their observable basis and exact target', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', [], '2')
    const third = trackPack('track.third', [], '3')
    let id = 0
    const classroom = createAIClassroom({
      catalog: createContentPackCatalog([first, second, third]),
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Use evidence-backed adjustments',
      conceptIds: ['track.first', 'track.second', 'track.third'],
      explicitLearnerGoal: true,
    })
    const learningTrackId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:first',
      conceptId: 'track.first',
      learningSkillId: 'skill:first',
      blockIds: ['block:first'],
    })
    const encounter = classroom.snapshot().stream[0]
    await expect(classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'review',
        conceptId: 'track.second',
        encounteredStreamEntryId: encounter.id,
      },
    })).rejects.toThrow(/earlier encounter/)
    await expect(classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'review',
        conceptId: 'track.first',
        encounteredStreamEntryId: encounter.id,
      },
    })).resolves.toMatchObject({ revision: 3 })

    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:practice',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    const exercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance')!
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: `attempt:failure:${attempt}`,
        exerciseInstanceId: exercise.id,
        submission: { type: 'code_output', code: 'main() { println(0) }' },
        observation: {
          type: 'run_result',
          result: { ok: true, phase: 'run', stdout: '0', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
        },
      })
    }
    const blockedEvidenceIds = classroom.snapshot().evidence.map(item => item.id)
    await expect(classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'delay',
        conceptId: 'track.first',
        nextConceptId: 'track.third',
        blockedEvidenceIds,
      },
    })).rejects.toThrow(/next eligible target track.second/)
    await classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId,
      adjustment: {
        type: 'delay',
        conceptId: 'track.first',
        nextConceptId: 'track.second',
        blockedEvidenceIds,
      },
    })
    const delayAdjustment = classroom.snapshot().tracks[0].adjustments.at(-1)!
    await expect(classroom.execute({
      type: 'append_skip_marker',
      learningTrackId,
      tutoringStepId: 'step:delayed-skip',
      conceptId: 'track.first',
      blockIds: ['block:first'],
      basis: {
        type: 'track_adjustment',
        adjustmentId: delayAdjustment.id,
      },
    })).resolves.toMatchObject({ teacherExposureEpoch: null })
    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:delayed',
      conceptId: 'track.second',
      learningSkillId: 'skill:second',
      blockIds: ['block:second'],
    })).resolves.toMatchObject({ revision: 10 })
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId,
      tutoringStepId: 'step:delayed-practice',
      conceptId: 'track.second',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:second:practice',
      personalizationInputs: {},
    })
    const delayedExercise = classroom.snapshot().stream.find(entry =>
      entry.type === 'exercise_instance'
      && entry.tutoringStepId === 'step:delayed-practice')!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:delayed-target-success',
      exerciseInstanceId: delayedExercise.id,
      submission: { type: 'code_output', code: 'main() { println(2) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '2', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await expect(classroom.execute({
      type: 'append_content_reference_group',
      learningTrackId,
      tutoringStepId: 'step:after-delayed-target',
      conceptId: 'track.third',
      learningSkillId: 'skill:third',
      blockIds: ['block:third'],
    })).resolves.toMatchObject({ revision: 13 })
  })

  it('rejects persisted future mainline writes and forged Track Adjustments', async () => {
    const first = trackPack('track.first', [], '1')
    const second = trackPack('track.second', ['track.first'], '2')
    const catalog = createContentPackCatalog([first, second])
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => 'track:1',
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: 'track:1',
      goal: 'Reject forged persisted history',
      conceptIds: ['track.first', 'track.second'],
      explicitLearnerGoal: true,
    })

    const forgedJump = classroom.snapshot()
    forgedJump.revision = 2
    forgedJump.stream.push({
      id: 'stream:forged-jump',
      type: 'content_reference_group',
      learningTrackId: 'track:1',
      tutoringStepId: 'step:forged',
      conceptId: 'track.second',
      learningSkillId: 'skill:second',
      packId: second.id,
      contentVersion: second.version,
      blockIds: ['block:second'],
      createdAt: 100,
      recordedRevision: 2,
    })
    const forgedJumpClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forgedJump),
    })
    await expect(forgedJumpClassroom.open()).rejects.toThrow(
      /current Learning Track frontier/,
    )

    const forgedAdjustment = classroom.snapshot()
    forgedAdjustment.revision = 2
    forgedAdjustment.tracks[0].adjustments.push({
      id: 'adjustment:forged',
      type: 'accelerate',
      decision: 'accelerate_placement_success',
      conceptId: 'track.second',
      placementEvidenceId: 'evidence:missing',
      createdAt: 100,
      recordedRevision: 2,
    })
    const forgedAdjustmentClassroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forgedAdjustment),
    })
    await expect(forgedAdjustmentClassroom.open()).rejects.toThrow(
      /unavailable Learning Evidence/,
    )
  })

  it('rejects a persisted Skip Marker that cites another Track adjustment', async () => {
    const first = trackPack('track.first', [], '1')
    const catalog = createContentPackCatalog([first])
    let id = 0
    const classroom = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(),
      now: () => 100,
      createId: () => `generated:${++id}`,
    })
    await classroom.open()
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Track A',
      conceptIds: ['track.first'],
      explicitLearnerGoal: true,
    })
    const trackAId = classroom.snapshot().activeTrackId!
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: trackAId,
      tutoringStepId: 'step:placement',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:placement',
      personalizationInputs: {},
    })
    const placement = classroom.snapshot().stream[0]
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:placement',
      exerciseInstanceId: placement.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'adjust_learning_track',
      learningTrackId: trackAId,
      adjustment: {
        type: 'accelerate',
        conceptId: 'track.first',
        placementEvidenceId: classroom.snapshot().evidence[0].id,
      },
    })
    const trackAAdjustmentId
      = classroom.snapshot().tracks[0].adjustments[0].id
    await classroom.execute({
      type: 'create_exercise_instance',
      learningTrackId: trackAId,
      tutoringStepId: 'step:practice',
      conceptId: 'track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template:first:practice',
      personalizationInputs: {},
    })
    const practice = classroom.snapshot().stream.at(-1)!
    await classroom.execute({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:practice',
      exerciseInstanceId: practice.id,
      submission: { type: 'code_output', code: 'main() { println(1) }' },
      observation: {
        type: 'run_result',
        result: { ok: true, phase: 'run', stdout: '1', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 },
      },
    })
    await classroom.execute({
      type: 'start_learning_track',
      trackId: `generated:${++id}`,
      goal: 'Track B',
      conceptIds: ['track.first'],
      explicitLearnerGoal: true,
    })
    const forged = classroom.snapshot()
    forged.revision += 1
    forged.stream.push({
      id: 'skip:cross-track',
      type: 'skip_marker',
      learningTrackId: forged.activeTrackId,
      tutoringStepId: 'step:forged-skip',
      conceptId: 'track.first',
      packId: first.id,
      contentVersion: first.version,
      blockIds: ['block:first'],
      basis: {
        type: 'track_adjustment',
        adjustmentId: trackAAdjustmentId,
      },
      createdAt: 100,
      recordedRevision: forged.revision,
    })

    const restored = createAIClassroom({
      catalog,
      storage: createMemoryClassroomStorage(forged),
    })
    await expect(restored.open()).rejects.toThrow(
      /exact current applicable Accelerate or Delay Track Adjustment/,
    )
  })
})
