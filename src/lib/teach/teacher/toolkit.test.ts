import type { ModelMessage, ToolSet } from 'ai'
import type {
  ClassroomSnapshot,
  RemediationDiagnosticClaimAuthority,
} from '../classroom/state'
import type { ContentPackCatalog } from '../classroom/content-catalog'
import type { LessonOrchestratorClassroom, TeacherToolkitDeps } from './toolkit'
import { describe, expect, it, vi } from 'vitest'
import { createContentPackCatalog } from '../classroom/content-catalog'
import {
  clarificationSuppressionKey,
  remediationSuppressionKey,
} from '../classroom/retention'
import { createEmptyClassroom } from '../classroom/state'
import { summarizeAttemptDiagnostic } from '../classroom/persistence-policy'
import { KnowledgeSourceError } from '../knowledge/source'
import {
  createRemediationToolkit,
  createTeacherMutationBudget,
  createTeacherToolCallBudget,
  createTeacherToolkit,
} from './toolkit'

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

function outputEvaluation(text: string, matched: boolean) {
  return {
    matched,
    stdoutSha256: diagnostic(text).sha256,
    stdoutSourceTruncated: false,
  }
}

function validatedPack() {
  return {
    id: 'pack.main',
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: 'cj.program.main',
      title: 'main',
      summary: 'Entry point',
      prerequisites: [],
    },
    blocks: [{
      id: 'block.main',
      type: 'prose' as const,
      markdown: 'Use `main`.',
      sourceReferences: [{
        sourceId: 'static-tour' as const,
        ref: '01-basics/01-program/01',
        title: 'main',
      }],
    }, {
      id: 'block.main.program',
      type: 'code_sample' as const,
      code: 'main() { println("hello") }',
      language: 'cangjie' as const,
      sampleType: 'program' as const,
      sourceReferences: [{
        sourceId: 'static-tour' as const,
        ref: '01-basics/01-program/01',
        title: 'main',
      }],
    }],
    learningSkills: [{
      id: 'skill.main',
      conceptId: 'cj.program.main',
      title: 'Run main',
      description: 'Run a main function',
      key: true,
    }],
    exerciseTemplates: [
      {
        id: 'template.main',
        version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningSkillId: 'skill.main',
        purpose: 'practice' as const,
        task: {
          type: 'code_output' as const,
          prompt: 'Print hello',
          starterCode: 'main() {}',
          expectedOutput: 'hello',
          matchMode: 'exact' as const,
          sourceRequirements: [{ type: 'top_level_main' as const }],
          hints: [],
        },
      },
      {
        id: 'template.main.review',
        version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningSkillId: 'skill.main',
        purpose: 'review' as const,
        task: {
          type: 'recall' as const,
          prompt: 'Name the entry function',
          referenceAnswer: 'main',
        },
      },
    ],
    review: {
      status: 'approved' as const,
      reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
    },
  }
}

function catalogWithManySummaries(
  count: number,
  hiddenValue = 'HIDDEN_CATALOG_FIELD',
): ContentPackCatalog {
  const base = createContentPackCatalog([validatedPack()])
  const current = base.list()[0]
  const summaries = [
    current,
    ...Array.from({ length: count - 1 }, (_, index) => ({
      conceptId: `cj.generated.${index}`,
      title: `Concept ${index} ${'t'.repeat(800)}`,
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      availability: 'read_only' as const,
      availabilityReason: 'editorial_review' as const,
      hiddenValue,
    })),
  ]
  return {
    ...base,
    list: () => summaries,
  }
}

function pendingRemediationSnapshot(): ClassroomSnapshot {
  const snapshot = createEmptyClassroom()
  snapshot.stream.push({
    id: 'exercise:assigned',
    type: 'exercise_instance',
    learningTrackId: null,
    tutoringStepId: 'step:assigned',
    conceptId: 'cj.program.main',
    learningSkillId: 'skill.main',
    packId: 'pack.main',
    contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    templateId: 'template.main',
    templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    purpose: 'practice',
    personalizationInputs: {
      unresolvedFailureEvidenceIds: [],
      remediationArtifactIds: [],
    },
    personalizationPolicyVersion: 2,
    effectiveDifficulty: 'standard',
    task: structuredClone(validatedPack().exerciseTemplates[0].task),
    createdAt: 1,
    recordedRevision: 1,
  })
  snapshot.attempts.push({
    id: 'attempt:assigned',
    exerciseInstanceId: 'exercise:assigned',
    assistanceEventIds: [],
    teacherExposureEpochId: null,
    submission: {
      type: 'code_output',
      code: 'main() { println("goodbye") }',
    },
    result: {
      passed: false,
      runnerOk: true,
      phase: 'run',
      stdout: diagnostic('goodbye\n'),
      stderr: diagnostic(''),
      compilerOutput: diagnostic('compiler warning'),
      outputEvaluation: outputEvaluation('goodbye\n', false),
      exitCode: 0,
    },
    assistance: 'none',
    createdAt: 2,
    recordedRevision: 2,
  })
  snapshot.reviewArtifacts.push({
    id: 'remediation:assigned',
    type: 'remediation',
    conceptId: 'cj.program.main',
    learningSkillId: 'skill.main',
    diagnosticStatus: 'pending',
    diagnosticAttempts: 0,
    diagnosticFailure: null,
    nextDiagnosticAttemptAt: null,
    diagnosticClaim: null,
    misconceptionTheme: null,
    markdown: null,
    attemptIds: ['attempt:assigned'],
    evidenceIds: ['evidence:assigned'],
    createdAt: 2,
    updatedAt: 2,
    createdRevision: 2,
    updatedRevision: 2,
  })
  return snapshot
}

function placementAdjustmentCandidateSnapshot(): ClassroomSnapshot {
  const snapshot = createEmptyClassroom()
  snapshot.revision = 3
  snapshot.activeTrackId = 'track:active'
  snapshot.tracks.push({
    id: 'track:active',
    goal: 'Learn the validated curriculum.',
    conceptIds: ['cj.program.main'],
    contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    adjustments: [],
    createdAt: 1,
    recordedRevision: 1,
  })
  snapshot.stream.push({
    id: 'exercise:placement',
    type: 'exercise_instance',
    learningTrackId: 'track:active',
    tutoringStepId: 'step:placement',
    conceptId: 'cj.program.main',
    learningSkillId: 'skill.main',
    packId: 'pack.main',
    contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    templateId: 'template:placement',
    templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    purpose: 'placement',
    personalizationInputs: {
      unresolvedFailureEvidenceIds: [],
      remediationArtifactIds: [],
    },
    personalizationPolicyVersion: 2,
    effectiveDifficulty: 'standard',
    task: structuredClone(validatedPack().exerciseTemplates[0].task),
    createdAt: 2,
    recordedRevision: 2,
  })
  snapshot.attempts.push({
    id: 'attempt:placement',
    exerciseInstanceId: 'exercise:placement',
    assistanceEventIds: [],
    teacherExposureEpochId: null,
    submission: {
      type: 'code_output',
      code: 'main() { println("hello") }',
    },
    result: {
      passed: true,
      runnerOk: true,
      phase: 'run',
      stdout: diagnostic('hello'),
      stderr: diagnostic(''),
      compilerOutput: diagnostic(''),
      outputEvaluation: outputEvaluation('hello', true),
      exitCode: 0,
    },
    assistance: 'none',
    createdAt: 3,
    recordedRevision: 3,
  })
  snapshot.evidence.push({
    id: 'evidence:placement',
    type: 'independent',
    outcome: 'success',
    conceptId: 'cj.program.main',
    learningSkillId: 'skill.main',
    contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    templateId: 'template:placement',
    templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    exerciseInstanceId: 'exercise:placement',
    attemptId: 'attempt:placement',
    createdAt: 3,
  })
  return snapshot
}

function successfulSkipCandidateSnapshot(): ClassroomSnapshot {
  const snapshot = placementAdjustmentCandidateSnapshot()
  const instance = snapshot.stream[0]
  if (instance.type !== 'exercise_instance')
    throw new Error('expected an Exercise Instance fixture')
  instance.purpose = 'practice'
  instance.templateId = 'template.main'
  snapshot.evidence[0].id = 'evidence:grounded'
  snapshot.evidence[0].templateId = 'template.main'
  return snapshot
}

function unresolvedFailureCandidateSnapshot(): ClassroomSnapshot {
  const snapshot = createEmptyClassroom()
  snapshot.revision = 5
  snapshot.activeTrackId = 'track:active'
  snapshot.tracks.push({
    id: 'track:active',
    goal: 'Learn the validated curriculum.',
    conceptIds: ['cj.program.main'],
    contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    adjustments: [],
    createdAt: 1,
    recordedRevision: 1,
  })
  snapshot.stream.push({
    id: 'exercise:candidate-source',
    type: 'exercise_instance',
    learningTrackId: 'track:active',
    tutoringStepId: 'step:candidate-source',
    conceptId: 'cj.program.main',
    learningSkillId: 'skill.main',
    packId: 'pack.main',
    contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    templateId: 'template.main',
    templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    purpose: 'practice',
    personalizationInputs: {
      unresolvedFailureEvidenceIds: [],
      remediationArtifactIds: [],
    },
    personalizationPolicyVersion: 2,
    effectiveDifficulty: 'standard',
    task: structuredClone(validatedPack().exerciseTemplates[0].task),
    createdAt: 2,
    recordedRevision: 2,
  })
  const observations = [
    { suffix: 'old-failure', revision: 3, passed: false },
    { suffix: 'success', revision: 4, passed: true },
    { suffix: 'current-failure', revision: 5, passed: false },
  ]
  for (const observation of observations) {
    const attemptId = `attempt:${observation.suffix}`
    snapshot.attempts.push({
      id: attemptId,
      exerciseInstanceId: 'exercise:candidate-source',
      assistanceEventIds: [],
      teacherExposureEpochId: null,
      submission: {
        type: 'code_output',
        code: `main() { println("${observation.suffix}") }`,
      },
      result: {
        passed: observation.passed,
        runnerOk: true,
        phase: 'run',
        stdout: diagnostic(observation.passed ? 'hello' : observation.suffix),
        stderr: diagnostic(''),
        compilerOutput: diagnostic(''),
        outputEvaluation: outputEvaluation(
          observation.passed ? 'hello' : observation.suffix,
          observation.passed,
        ),
        exitCode: 0,
      },
      assistance: 'none',
      createdAt: observation.revision,
      recordedRevision: observation.revision,
    })
    snapshot.evidence.push({
      id: `evidence:${observation.suffix}`,
      type: 'independent',
      outcome: observation.passed ? 'success' : 'failure',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      templateId: 'template.main',
      templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      exerciseInstanceId: 'exercise:candidate-source',
      attemptId,
      createdAt: observation.revision,
    })
  }
  return snapshot
}

function successfulContentReadMessages(
  conceptId = 'cj.program.main',
  contentVersion = 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
): ModelMessage[] {
  return [{
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: 'call:read-content',
      toolName: 'read_content_pack',
      output: {
        type: 'json',
        value: {
          ok: true,
          truncation: { truncated: false },
          pack: {
            concept: { id: conceptId },
            version: contentVersion,
            blocks: [{ id: 'block.main' }],
            learningSkills: [{ id: 'skill.main' }],
            exerciseTemplates: [
              { id: 'template.main' },
              { id: 'template.main.review' },
            ],
          },
        },
      },
    }],
  }]
}

function successfulRemediationReadMessages(
  failedAttemptId = 'attempt:assigned',
): ModelMessage[] {
  return [{
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: 'call:read-remediation',
      toolName: 'read_assigned_remediation_context',
      output: {
        type: 'json',
        value: {
          ok: true,
          remediation: {
            failedAttemptId,
            diagnosticContext: {
              truncation: { truncated: false },
            },
          },
        },
      },
    }],
  }]
}

function priorToolResultMessages(
  toolName: string,
  value: unknown,
): ModelMessage[] {
  return [{
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: `call:${toolName}`,
      toolName,
      output: {
        type: 'json',
        value: value as never,
      },
    }],
  }]
}

function setup(
  scope: TeacherToolkitDeps['getChatScope'] = () => ({
    mode: 'live',
    learningTrackId: 'track:active',
  }),
  options: {
    catalog?: ContentPackCatalog
    createTeacherInteractionId?: () => string
    editor?: TeacherToolkitDeps['editor']
    knowledge?: TeacherToolkitDeps['knowledge']
    commit?: LessonOrchestratorClassroom['commit']
    mutationBudget?: TeacherToolkitDeps['mutationBudget']
    playground?: TeacherToolkitDeps['playground']
    snapshot?: ClassroomSnapshot
    toolCallBudget?: TeacherToolkitDeps['toolCallBudget']
  } = {},
) {
  const snapshot: ClassroomSnapshot = options.snapshot ?? createEmptyClassroom()
  if (!options.snapshot) {
    snapshot.activeTrackId = 'track:active'
    snapshot.tracks.push({
      id: 'track:active',
      goal: 'Learn the validated curriculum.',
      conceptIds: ['cj.program.main'],
      contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      adjustments: [],
      createdAt: 1,
      recordedRevision: 1,
    })
  }
  const execute = vi.fn(async (
    _command: Parameters<LessonOrchestratorClassroom['commit']>[0],
  ) => snapshot)
  const classroom: LessonOrchestratorClassroom = {
    read: () => snapshot,
    commit: options.commit ?? (command => execute(command)),
  }
  const search = vi.fn(async () => [{
    sourceId: 'docs',
    ref: 'ref',
    title: 'Result',
    snippet: 'Grounded',
  }])
  const createTeacherInteractionId
    = options.createTeacherInteractionId ?? vi.fn(() => 'teacher:test')
  const deps: TeacherToolkitDeps = {
    classroom,
    catalog: options.catalog ?? createContentPackCatalog([validatedPack()]),
    knowledge: options.knowledge ?? { id: 'docs', search },
    editor: options.editor ?? { getCode: () => 'main() {}' },
    mutationBudget: options.mutationBudget ?? createTeacherMutationBudget(6),
    toolCallBudget: options.toolCallBudget ?? {
      allocateMutationId: (_options, purpose) => `teacher-tool:test-${purpose}`,
      consume: () => null,
      createMutationCommitGuard: () => ({
        assertActive: () => undefined,
      }),
      hasReadContentVersion: () => true,
      recordReadContentVersion: () => true,
    },
    playground: options.playground ?? {
      listTabs: () => [],
    },
    getChatScope: scope,
    createTeacherInteractionId,
    lang: 'en',
  }
  const toolkit = createTeacherToolkit(deps)
  return {
    execute,
    createTeacherInteractionId,
    search,
    snapshot,
    toolkit,
  }
}

async function call<T = unknown>(
  toolkit: ToolSet,
  name: string,
  input: unknown,
  signal?: AbortSignal,
  messages: ModelMessage[] = successfulContentReadMessages(),
  toolCallId = 'call-1',
): Promise<T> {
  const execute = toolkit[name]?.execute
  if (!execute)
    throw new Error(`${name} is not executable`)
  return execute(input, {
    toolCallId,
    messages,
    abortSignal: signal,
  }) as Promise<T>
}

function createClassroomExecuteMock(snapshot: ClassroomSnapshot) {
  return vi.fn(async (
    _command: Parameters<LessonOrchestratorClassroom['commit']>[0],
  ) => snapshot)
}

describe('lesson Orchestrator toolkit', () => {
  it('does not expose authoring, progress, attempt, track-start, or editor-write shortcuts', () => {
    const { toolkit } = setup()
    expect(Object.keys(toolkit).sort()).toEqual([
      'append_bridge_note',
      'append_content_reference_group',
      'append_skip_marker',
      'create_exercise_instance',
      'list_content_packs',
      'list_playground_tabs',
      'read_classroom_state',
      'read_content_pack',
      'read_editor_code',
      'record_track_adjustment',
      'retain_clarification',
      'search_docs',
    ])
    expect(toolkit).not.toHaveProperty('create_lesson')
    expect(toolkit).not.toHaveProperty('set_progress')
    expect(toolkit).not.toHaveProperty('set_learning_notes')
    expect(toolkit).not.toHaveProperty('start_learning_track')
    expect(toolkit).not.toHaveProperty('record_exercise_attempt')
    expect(toolkit).not.toHaveProperty('set_editor_code')
    expect(toolkit).not.toHaveProperty('run_code')
    expect(toolkit).not.toHaveProperty('record_code_suggestion_assistance')
    expect(toolkit).not.toHaveProperty('retain_remediation')
  })

  it('binds finite tool-call and documentation budgets to one exact turn signal', () => {
    const budget = createTeacherToolCallBudget()
    const firstController = new AbortController()
    const first = budget.open(firstController.signal, {
      total: 3,
      documentationSearches: 1,
    })
    const options = {
      toolCallId: 'call:first',
      messages: [],
      abortSignal: firstController.signal,
    }

    expect(budget.consume(options, 'general')).toBeNull()
    expect(budget.hasReadContentVersion(
      options,
      'cj.program.main',
      'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )).toBe(false)
    expect(budget.recordReadContentVersion(
      options,
      'cj.program.main',
      'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )).toBe(true)
    expect(budget.hasReadContentVersion(
      options,
      'cj.program.main',
      'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )).toBe(true)
    expect(budget.consume(options, 'documentation-search')).toBeNull()
    const commitGuard = budget.createMutationCommitGuard(options)
    expect(commitGuard).not.toBeNull()
    expect(() => commitGuard?.assertActive()).not.toThrow()
    expect(budget.consume(options, 'documentation-search')).toBe(
      'Teacher documentation-search budget exhausted for this turn.',
    )
    expect(first.remaining()).toEqual({
      total: 1,
      documentationSearches: 0,
    })

    first.close()
    expect(() => commitGuard?.assertActive()).toThrow(/no longer active/)
    const secondController = new AbortController()
    const second = budget.open(secondController.signal, {
      total: 1,
      documentationSearches: 0,
    })
    expect(budget.consume(options, 'general')).toBe(
      'Teacher tool call is outside an active turn.',
    )
    expect(budget.hasReadContentVersion(
      options,
      'cj.program.main',
      'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )).toBe(false)
    expect(budget.consume({
      ...options,
      abortSignal: secondController.signal,
    }, 'general')).toBeNull()
    expect(budget.hasReadContentVersion({
      ...options,
      abortSignal: secondController.signal,
    }, 'cj.program.main', 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false)
    expect(second.remaining().total).toBe(0)
    second.close()

    expect(() => budget.open(new AbortController().signal, {
      total: 1,
      documentationSearches: 2,
    })).toThrow(RangeError)
  })

  it('revokes an in-flight mutation before its durable commit boundary', async () => {
    let releaseCommit!: () => void
    let markCommitStarted!: () => void
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve
    })
    let committedCount = 0
    const budget = createTeacherToolCallBudget()
    const controller = new AbortController()
    const lease = budget.open(controller.signal, {
      total: 4,
      documentationSearches: 0,
    })
    const { snapshot, toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      {
        toolCallBudget: budget,
        commit: async (_command, commitGuard) => {
          markCommitStarted()
          await commitGate
          commitGuard.assertActive()
          committedCount += 1
          return snapshot
        },
      },
    )
    await call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }, controller.signal)

    const mutation = call(toolkit, 'append_bridge_note', {
      conceptId: 'cj.program.main',
      markdown: 'A short orientation.',
    }, controller.signal)
    await commitStarted
    controller.abort()
    releaseCommit()

    await expect(mutation).resolves.toEqual({
      ok: false,
      error: 'User aborted',
      aborted: true,
    })
    expect(committedCount).toBe(0)
    lease.close()
  })

  it('uses opaque stable mutation ids without trusting provider call ids', async () => {
    const budget = createTeacherToolCallBudget()
    const firstController = new AbortController()
    const firstLease = budget.open(firstController.signal, {
      total: 8,
      documentationSearches: 0,
    })
    const { execute, toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { toolCallBudget: budget },
    )
    const contentInput = {
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.main'],
    }

    await call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }, firstController.signal)
    await call(
      toolkit,
      'append_content_reference_group',
      contentInput,
      firstController.signal,
    )
    await call(
      toolkit,
      'append_content_reference_group',
      contentInput,
      firstController.signal,
    )
    await call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    }, firstController.signal)
    const oversizedProviderId = 'provider-controlled-'.repeat(20_000)
    await call(toolkit, 'append_bridge_note', {
      conceptId: 'cj.program.main',
      markdown: 'A short orientation.',
    }, firstController.signal, successfulContentReadMessages(), oversizedProviderId)

    const firstCommands = execute.mock.calls.map(
      ([command]) => command as { tutoringStepId?: string },
    )
    const replayedId = firstCommands[0]?.tutoringStepId
    const replayId = firstCommands[1]?.tutoringStepId
    const otherMutationId = firstCommands[2]?.tutoringStepId
    const oversizedProviderMutationId = firstCommands[3]?.tutoringStepId
    const internalIdPattern
      = /^teacher-tool:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    expect(replayedId).toBe(replayId)
    expect(replayedId).not.toBe(otherMutationId)
    expect(replayedId).toMatch(internalIdPattern)
    expect(oversizedProviderMutationId).toMatch(internalIdPattern)
    expect(oversizedProviderMutationId).not.toContain('provider-controlled')
    expect(oversizedProviderMutationId?.length).toBeLessThanOrEqual(200)

    firstLease.close()
    await expect(call(
      toolkit,
      'append_content_reference_group',
      contentInput,
      firstController.signal,
    )).resolves.toEqual({
      ok: false,
      error: 'Teacher tool call is outside an active turn.',
    })
    expect(execute).toHaveBeenCalledTimes(4)

    const secondController = new AbortController()
    const secondLease = budget.open(secondController.signal, {
      total: 3,
      documentationSearches: 0,
    })
    await call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }, secondController.signal)
    await call(
      toolkit,
      'append_content_reference_group',
      contentInput,
      secondController.signal,
    )
    const crossTurnId = (
      execute.mock.calls[4]?.[0] as { tutoringStepId?: string } | undefined
    )?.tutoringStepId
    expect(crossTurnId).toMatch(internalIdPattern)
    expect(crossTurnId).not.toBe(replayedId)

    secondController.abort()
    await expect(call(
      toolkit,
      'append_content_reference_group',
      contentInput,
      secondController.signal,
    )).resolves.toEqual({
      ok: false,
      error: 'Teacher tool call is outside an active turn.',
    })
    expect(execute).toHaveBeenCalledTimes(5)
    secondLease.close()
  })

  it('requires an exact same-turn Content Pack read for every content-dependent mutation', async () => {
    const toolCallBudget = createTeacherToolCallBudget()
    const firstController = new AbortController()
    const firstLease = toolCallBudget.open(firstController.signal, {
      total: 16,
      documentationSearches: 0,
    })
    const { execute, toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      {
        snapshot: successfulSkipCandidateSnapshot(),
        toolCallBudget,
      },
    )
    const mutations = [
      ['append_content_reference_group', {
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        blockIds: ['block.main'],
      }],
      ['append_bridge_note', {
        conceptId: 'cj.program.main',
        markdown: 'A short orientation.',
      }],
      ['append_skip_marker', {
        conceptId: 'cj.program.main',
        blockIds: ['block.main'],
        basis: {
          type: 'successful_evidence',
          evidenceIds: ['evidence:grounded'],
        },
      }],
      ['create_exercise_instance', {
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        templateId: 'template.main',
        personalizationInputs: {},
      }],
      ['retain_clarification', {
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        misconceptionTheme: 'entry point',
        markdown: 'The entry point is `main`.',
      }],
    ] as const
    const unread = {
      ok: false,
      error: 'Read and receive exact Course Content Pack cj.program.main@'
        + 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa '
        + 'in this Teacher turn before mutating classroom content.',
    }

    for (const [name, input] of mutations) {
      await expect(call(
        toolkit,
        name,
        input,
        firstController.signal,
        [],
      )).resolves.toEqual(unread)
    }
    expect(execute).not.toHaveBeenCalled()

    await expect(call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }, firstController.signal)).resolves.toMatchObject({ ok: true })

    for (const [name, input] of mutations) {
      await expect(call(
        toolkit,
        name,
        input,
        firstController.signal,
        successfulContentReadMessages(),
      )).resolves.toEqual({ ok: true })
    }
    expect(execute).toHaveBeenCalledTimes(mutations.length)
    firstLease.close()

    const secondController = new AbortController()
    const secondLease = toolCallBudget.open(secondController.signal, {
      total: 1,
      documentationSearches: 0,
    })
    await expect(call(
      toolkit,
      'create_exercise_instance',
      mutations[3][1],
      secondController.signal,
      successfulContentReadMessages(),
    )).resolves.toEqual(unread)
    expect(execute).toHaveBeenCalledTimes(mutations.length)
    secondLease.close()
  })

  it.each(['read-first', 'mutation-first'] as const)(
    'does not treat a same-step %s parallel Content Pack call as model-observed',
    async (order) => {
      const toolCallBudget = createTeacherToolCallBudget()
      const controller = new AbortController()
      const lease = toolCallBudget.open(controller.signal, {
        total: 2,
        documentationSearches: 0,
      })
      const { execute, toolkit } = setup(
        () => ({ mode: 'live', learningTrackId: 'track:active' }),
        { toolCallBudget },
      )
      const read = () => call(toolkit, 'read_content_pack', {
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }, controller.signal, [])
      const mutate = () => call(toolkit, 'append_content_reference_group', {
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        blockIds: ['block.main'],
      }, controller.signal, [])
      const results = order === 'read-first'
        ? await Promise.all([read(), mutate()])
        : await Promise.all([mutate(), read()])
      const mutationResult = order === 'read-first' ? results[1] : results[0]

      expect(mutationResult).toEqual({
        ok: false,
        error: 'Read and receive exact Course Content Pack '
          + 'cj.program.main@cv:sha256:'
          + `${'a'.repeat(64)} in this Teacher turn before mutating `
          + 'classroom content.',
      })
      expect(execute).not.toHaveBeenCalled()
      lease.close()
    },
  )

  it('shares an atomic caller-reset mutation budget across toolkit instances', async () => {
    const mutationBudget = createTeacherMutationBudget(1)
    const first = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { mutationBudget },
    )
    const second = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { mutationBudget },
    )
    const input = {
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.main'],
    }

    const [allowed, denied] = await Promise.all([
      call(first.toolkit, 'append_content_reference_group', input),
      call(second.toolkit, 'append_content_reference_group', input),
    ])
    expect(allowed).toEqual({ ok: true })
    expect(denied).toEqual({
      ok: false,
      error: 'Teacher mutation budget exhausted for this turn.',
    })
    expect(first.execute).toHaveBeenCalledTimes(1)
    expect(second.execute).not.toHaveBeenCalled()
    expect(mutationBudget.remaining()).toBe(0)

    mutationBudget.reset(1)
    await expect(call(second.toolkit, 'append_content_reference_group', input))
      .resolves
      .toEqual({ ok: true })
    expect(second.execute).toHaveBeenCalledTimes(1)
    expect(mutationBudget.remaining()).toBe(0)
    expect(() => mutationBudget.reset(-1)).toThrow(RangeError)
    expect(() => mutationBudget.reset(1.5)).toThrow(RangeError)
  })

  it.each([
    ['append_content_reference_group', {
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.main'],
    }],
    ['append_bridge_note', {
      conceptId: 'cj.program.main',
      markdown: 'A short orientation.',
    }],
    ['append_skip_marker', {
      conceptId: 'cj.program.main',
      blockIds: ['block.main'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:grounded'],
      },
    }],
    ['create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    }],
    ['record_track_adjustment', {
      type: 'review',
      conceptId: 'cj.program.main',
      encounteredStreamEntryId: 'exercise:placement',
    }],
    ['retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point',
      markdown: 'The entry point is `main`.',
    }],
  ])('fails closed before %s reaches the aggregate when the turn budget is empty', async (
    toolName,
    input,
  ) => {
    const mutationBudget = createTeacherMutationBudget(0)
    const { createTeacherInteractionId, execute, toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      {
        mutationBudget,
        snapshot: successfulSkipCandidateSnapshot(),
      },
    )

    await expect(call(toolkit, toolName, input)).resolves.toEqual({
      ok: false,
      error: 'Teacher mutation budget exhausted for this turn.',
    })
    expect(execute).not.toHaveBeenCalled()
    expect(createTeacherInteractionId).not.toHaveBeenCalled()
  })

  it('binds only free model Stream content to an aggregate-issued exposure id', async () => {
    const { createTeacherInteractionId, execute, toolkit } = setup(undefined, {
      snapshot: successfulSkipCandidateSnapshot(),
    })

    await call(toolkit, 'append_bridge_note', {
      conceptId: 'cj.program.main',
      markdown: 'A short orientation.',
    })
    await call(toolkit, 'append_skip_marker', {
      conceptId: 'cj.program.main',
      blockIds: ['block.main'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:grounded'],
      },
    })

    expect(createTeacherInteractionId).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenNthCalledWith(1, {
      type: 'append_bridge_note',
      teacherInteractionId: 'teacher:test',
      learningTrackId: 'track:active',
      tutoringStepId: 'teacher-tool:test-append_bridge_note',
      conceptId: 'cj.program.main',
      markdown: 'A short orientation.',
    })
    expect(execute).toHaveBeenNthCalledWith(2, {
      type: 'append_skip_marker',
      learningTrackId: 'track:active',
      tutoringStepId: 'teacher-tool:test-append_skip_marker',
      conceptId: 'cj.program.main',
      blockIds: ['block.main'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:grounded'],
      },
    })
    expect(toolkit).not.toHaveProperty('open_playground_tab')
  })

  it('projects and enforces exact full-state Skip Marker basis candidates', async () => {
    const grounded = setup(undefined, {
      snapshot: successfulSkipCandidateSnapshot(),
    })
    const state = await call<{
      trackPolicy: {
        skipMarkerBasisCandidates: unknown[]
      }
    }>(grounded.toolkit, 'read_classroom_state', {})
    expect(state.trackPolicy.skipMarkerBasisCandidates).toEqual([{
      conceptId: 'cj.program.main',
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:grounded'],
      },
    }])

    const ungrounded = setup()
    await expect(call(ungrounded.toolkit, 'append_skip_marker', {
      conceptId: 'cj.program.main',
      blockIds: ['block.main'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:stale'],
      },
    })).resolves.toEqual({
      ok: false,
      error: expect.stringContaining('Re-read classroom state'),
    })
    expect(ungrounded.execute).not.toHaveBeenCalled()
  })

  it('can select references and templates but cannot supply authored content or task text', async () => {
    const { execute, toolkit } = setup()
    await call(toolkit, 'append_content_reference_group', {
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.main'],
    })
    await call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    })
    expect(execute).toHaveBeenNthCalledWith(1, {
      type: 'append_content_reference_group',
      learningTrackId: 'track:active',
      tutoringStepId: 'teacher-tool:test-append_content_reference_group',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.main'],
    })
    expect(execute).toHaveBeenNthCalledWith(2, {
      type: 'create_exercise_instance',
      learningTrackId: 'track:active',
      tutoringStepId: 'teacher-tool:test-create_exercise_instance',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    })
  })

  it('passes only structured evidence-backed Track Adjustments to the aggregate', async () => {
    const { execute, toolkit } = setup(undefined, {
      snapshot: placementAdjustmentCandidateSnapshot(),
    })
    await call(toolkit, 'record_track_adjustment', {
      type: 'accelerate',
      conceptId: 'cj.program.main',
      placementEvidenceId: 'evidence:placement',
    })
    expect(execute).toHaveBeenCalledWith({
      type: 'adjust_learning_track',
      learningTrackId: 'track:active',
      adjustment: {
        type: 'accelerate',
        conceptId: 'cj.program.main',
        placementEvidenceId: 'evidence:placement',
      },
    })
  })

  it('rejects a Track Adjustment that is not an exact current full-state candidate', async () => {
    const { execute, toolkit } = setup()
    await expect(call(toolkit, 'record_track_adjustment', {
      type: 'accelerate',
      conceptId: 'cj.program.main',
      placementEvidenceId: 'evidence:stale',
    })).resolves.toEqual({
      ok: false,
      error: expect.stringContaining('Re-read classroom state'),
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('reports evidence-derived state rather than accepting a progress value', async () => {
    const { toolkit } = setup()
    const result = await call<{
      ok: true
      concepts: Array<{ conceptId: string, progress: string | null }>
    }>(toolkit, 'read_classroom_state', {})
    expect(result.concepts).toEqual([
      expect.objectContaining({
        conceptId: 'cj.program.main',
        progress: 'unseen',
      }),
    ])
  })

  it('reports only whether the workspace-global teacher exposure epoch is active', async () => {
    const snapshot = createEmptyClassroom()
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { snapshot },
    )

    await expect(call(toolkit, 'read_classroom_state', {})).resolves.toMatchObject({
      ok: true,
      teacherExposureActive: false,
    })

    snapshot.teacherExposureEpoch = {
      id: 'teacher-exposure:internal',
      interactionId: 'teacher-interaction:internal',
      createdAt: 1,
      recordedRevision: 1,
    }
    const exposed = await call<Record<string, unknown>>(
      toolkit,
      'read_classroom_state',
      {},
    )
    expect(exposed).toMatchObject({
      ok: true,
      teacherExposureActive: true,
    })
    expect(exposed).not.toHaveProperty('teacherExposureEpoch')
    expect(JSON.stringify(exposed)).not.toContain('teacher-exposure:internal')
    expect(JSON.stringify(exposed)).not.toContain('teacher-interaction:internal')
  })

  it('lists a deterministic bounded projection of a large Content Pack catalog', async () => {
    const secret = 'CATALOG_PRIVATE_EXTRA_FIELD'
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: null }),
      { catalog: catalogWithManySummaries(100, secret) },
    )

    const result = await call<{
      ok: true
      packs: Array<{
        conceptId: string
        title: string
        version: string
        availability: string
        availabilityReason: string | null
        truncated: boolean
        truncatedFields: string[]
      }>
      bounds: {
        matchedCount: number
        returnedCount: number
        limit: number
        truncated: boolean
        strategy: string
      }
      page: {
        offset: number
        nextOffset: number | null
        totalCount: number
      }
    }>(toolkit, 'list_content_packs', {})
    expect(result.packs).toHaveLength(64)
    expect(result.bounds).toEqual({
      matchedCount: 100,
      returnedCount: 64,
      limit: 64,
      truncated: true,
      strategy: 'page',
    })
    expect(result.page).toEqual({
      offset: 0,
      nextOffset: 64,
      totalCount: 100,
    })
    expect(result.packs[1].title).toHaveLength(512)
    expect(result.packs[1]).toMatchObject({
      truncated: true,
      truncatedFields: ['title'],
    })
    expect(Object.keys(result.packs[1]).sort()).toEqual([
      'availability',
      'availabilityReason',
      'conceptId',
      'title',
      'truncated',
      'truncatedFields',
      'version',
    ])
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain('hiddenValue')

    const nextPage = await call<{
      packs: Array<{ conceptId: string }>
      page: { offset: number, nextOffset: number | null, totalCount: number }
    }>(toolkit, 'list_content_packs', { offset: 64 })
    expect(nextPage.packs).toHaveLength(36)
    expect(nextPage.page).toEqual({
      offset: 64,
      nextOffset: null,
      totalCount: 100,
    })
  })

  it('reads an exact Content Version instead of silently substituting current content', async () => {
    const historical = validatedPack()
    const current = structuredClone(historical)
    current.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    }))
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      {
        catalog: createContentPackCatalog(
          [historical, current],
          { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
        ),
      },
    )

    const exact = await call<{
      ok: boolean
      pack: unknown
    }>(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(exact).toMatchObject({
      ok: true,
      pack: { version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      truncation: { truncated: false },
    })
    const serialized = JSON.stringify(exact.pack)
    expect(serialized).not.toContain('expectedOutput')
    expect(serialized).not.toContain('sourceRequirements')
    expect(serialized).not.toContain('referenceAnswer')
    expect(serialized).not.toContain('answerIndices')
    expect(serialized).not.toContain('"hints"')
    expect(serialized).not.toContain('reviewedBy')
    expect(exact.pack).not.toHaveProperty('review')
    await expect(call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
    })).resolves.toEqual({
      ok: false,
      error: 'No Course Content Pack for cj.program.main@undefined.',
    })
  })

  it('projects only current unresolved failure candidates and rejects resolved ids', async () => {
    const { execute, toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { snapshot: unresolvedFailureCandidateSnapshot() },
    )

    await expect(call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })).resolves.toMatchObject({
      ok: true,
      personalizationCandidates: {
        unresolvedFailureEvidence: [{
          learningSkillId: 'skill.main',
          evidenceIds: ['evidence:current-failure'],
        }],
      },
    })

    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:old-failure'],
      },
    })).resolves.toEqual({
      ok: false,
      error: expect.stringContaining(
        'must copy current exact candidates from read_content_pack',
      ),
    })
    expect(execute).not.toHaveBeenCalled()

    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:current-failure'],
      },
    })).resolves.toEqual({ ok: true })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      type: 'create_exercise_instance',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: ['evidence:current-failure'],
      },
    }))
  })

  it('returns a complete bounded Content Pack and never exposes evaluator or review secrets', async () => {
    const secret = 'f'.repeat(64)
    const complete = structuredClone(validatedPack())
    complete.concept.summary = 's'.repeat(10_000)
    complete.review.reviewedBy
      = `external-review-attestation:private-test-key:${secret}`
    complete.exerciseTemplates[0].task.expectedOutput = secret
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { catalog: createContentPackCatalog([complete]) },
    )

    const result = await call<{
      ok: true
      pack: {
        blocks: unknown[]
        concept: { summary: string }
        exerciseTemplates: Array<{
          authoredHintCount: number
          supportsEasy: boolean
          supportsHard: boolean
        }>
      }
      truncation: {
        truncated: boolean
        characterLimit: number
        returnedCharacters: number
        truncatedFields: string[]
      }
    }>(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    const serialized = JSON.stringify(result.pack)
    expect(result.truncation).toMatchObject({
      truncated: false,
      characterLimit: 80_000,
    })
    expect(result.truncation.returnedCharacters).toBeLessThanOrEqual(80_000)
    expect(result.truncation.truncatedFields).toEqual([])
    expect(result.pack.blocks.length).toBeLessThanOrEqual(48)
    expect(result.pack.blocks.length).toBeGreaterThan(0)
    expect(result.pack.concept.summary).toHaveLength(10_000)
    expect(result.pack.exerciseTemplates[0]).toMatchObject({
      authoredHintCount: 0,
      supportsEasy: false,
      supportsHard: true,
    })
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('expectedOutput')
    expect(serialized).not.toContain('sourceRequirements')
    expect(serialized).not.toContain('referenceAnswer')
    expect(serialized).not.toContain('answerIndices')
    expect(serialized).not.toContain('"hints"')
    expect(result.pack).not.toHaveProperty('review')
  })

  it('does not authorize any Content Pack mutation from a truncated projection', async () => {
    const pack = structuredClone(validatedPack())
    const sourceBlock = pack.blocks.find(block => block.type === 'prose')
    if (!sourceBlock || sourceBlock.type !== 'prose')
      throw new Error('validatedPack fixture requires a prose block')
    pack.blocks = Array.from({ length: 48 }, (_, index) => ({
      ...sourceBlock,
      id: `block.${index}`,
      markdown: `block ${index} `.padEnd(9_000, 'x'),
    }))
    const validCatalog = createContentPackCatalog([validatedPack()])
    const nonConformingCatalog: ContentPackCatalog = {
      ...validCatalog,
      getVersion: () => pack,
    }
    const toolCallBudget = createTeacherToolCallBudget()
    const controller = new AbortController()
    const lease = toolCallBudget.open(controller.signal, {
      total: 4,
      documentationSearches: 0,
    })
    const { execute, toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      {
        catalog: nonConformingCatalog,
        toolCallBudget,
      },
    )
    const read = await call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }, controller.signal, [])
    expect(read).toMatchObject({
      ok: true,
      truncation: { truncated: true },
    })
    const messages = priorToolResultMessages('read_content_pack', read)

    await expect(call(toolkit, 'append_content_reference_group', {
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.0'],
    }, controller.signal, messages)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Read and receive exact Course Content Pack'),
    })
    await expect(call(toolkit, 'append_skip_marker', {
      conceptId: 'cj.program.main',
      blockIds: ['block.47'],
      basis: {
        type: 'successful_evidence',
        evidenceIds: ['evidence:grounded'],
      },
    }, controller.signal, messages)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Read and receive exact Course Content Pack'),
    })
    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    }, controller.signal, messages)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Read and receive exact Course Content Pack'),
    })
    expect(execute).not.toHaveBeenCalled()
    lease.close()
  })

  it('derives active-Track progress from its pin and separately discloses current content', async () => {
    const historical = validatedPack()
    const current = structuredClone(historical)
    current.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    }))
    const snapshot = createEmptyClassroom()
    snapshot.revision = 1
    snapshot.activeTrackId = 'track:historical'
    snapshot.tracks.push({
      id: 'track:historical',
      goal: 'Continue the pinned curriculum.',
      conceptIds: ['cj.program.main'],
      contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      adjustments: [],
      createdAt: 1,
      recordedRevision: 1,
    })
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:historical' }),
      {
        catalog: createContentPackCatalog(
          [historical, current],
          { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
        ),
        snapshot,
      },
    )

    const result = await call<{
      concepts: Array<{
        version: string
        currentVersion: string
        currentAvailability: string
        trackContentVersion: string | null
        progress: string | null
      }>
    }>(toolkit, 'read_classroom_state', {})
    expect(result.concepts).toEqual([expect.objectContaining({
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      currentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      currentAvailability: 'validated',
      trackContentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      progress: 'unseen',
    })])
  })

  it('preserves a full historical Track version through state, exact read, and mutation', async () => {
    const historicalVersion = `cv:sha256:${'9'.repeat(64)}`
    const historicalContract = `lc:sha256:${'7'.repeat(64)}`
    const currentVersion = `cv:sha256:${'8'.repeat(64)}`
    const currentContract = `lc:sha256:${'6'.repeat(64)}`
    const historical = validatedPack()
    historical.version = historicalVersion
    historical.learningContractVersion = historicalContract
    historical.exerciseTemplates = historical.exerciseTemplates.map(template => ({
      ...template,
      version: historicalVersion,
    }))
    const current = structuredClone(historical)
    current.version = currentVersion
    current.learningContractVersion = currentContract
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: currentVersion,
    }))
    const snapshot = createEmptyClassroom()
    snapshot.revision = 1
    snapshot.activeTrackId = 'track:historical-long-version'
    snapshot.tracks.push({
      id: 'track:historical-long-version',
      goal: 'Continue the exact historical curriculum.',
      conceptIds: ['cj.program.main'],
      contentVersions: { 'cj.program.main': historicalVersion },
      adjustments: [],
      createdAt: 1,
      recordedRevision: 1,
    })
    const budget = createTeacherToolCallBudget()
    const controller = new AbortController()
    const lease = budget.open(controller.signal, {
      total: 3,
      documentationSearches: 0,
    })
    const { execute, toolkit } = setup(
      () => ({
        mode: 'live',
        learningTrackId: 'track:historical-long-version',
      }),
      {
        catalog: createContentPackCatalog(
          [historical, current],
          { 'cj.program.main': currentVersion },
        ),
        snapshot,
        toolCallBudget: budget,
      },
    )

    const state = await call<{
      concepts: Array<{
        version: string
        currentVersion: string
        trackContentVersion: string | null
        truncated: boolean
        truncatedFields: string[]
      }>
    }>(toolkit, 'read_classroom_state', {}, controller.signal)
    expect(state.concepts).toEqual([expect.objectContaining({
      version: historicalVersion,
      currentVersion,
      trackContentVersion: historicalVersion,
      truncated: false,
      truncatedFields: [],
    })])

    const read = await call(toolkit, 'read_content_pack', {
      conceptId: 'cj.program.main',
      contentVersion: state.concepts[0].trackContentVersion,
    }, controller.signal)
    await call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: historicalVersion,
      templateId: 'template.main',
      personalizationInputs: {},
    }, controller.signal, priorToolResultMessages('read_content_pack', read))

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      type: 'create_exercise_instance',
      learningTrackId: 'track:historical-long-version',
      conceptId: 'cj.program.main',
      contentVersion: historicalVersion,
      templateId: 'template.main',
    }))
    lease.close()
  })

  it('reports pending diagnostics and active semantic suppressions', async () => {
    const { snapshot, toolkit } = setup()
    snapshot.stream.push({
      id: 'exercise:failed',
      type: 'exercise_instance',
      learningTrackId: 'track:active',
      tutoringStepId: 'step:failed',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      packId: 'pack.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      templateId: 'template.main',
      templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      purpose: 'practice',
      personalizationInputs: {
        unresolvedFailureEvidenceIds: [],
        remediationArtifactIds: [],
      },
      personalizationPolicyVersion: 2,
      effectiveDifficulty: 'standard',
      task: {
        type: 'code_output',
        prompt: 'Print hello',
        starterCode: 'main() {}',
        expectedOutput: 'hello',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
      createdAt: 1,
      recordedRevision: 1,
    })
    snapshot.attempts.push({
      id: 'attempt:failed',
      exerciseInstanceId: 'exercise:failed',
      assistanceEventIds: [],
      teacherExposureEpochId: null,
      submission: {
        type: 'code_output',
        code: 'main() { println("goodbye") }',
      },
      result: {
        passed: false,
        runnerOk: true,
        phase: 'run',
        stdout: diagnostic('goodbye\n'),
        stderr: diagnostic(''),
        compilerOutput: diagnostic(''),
        outputEvaluation: outputEvaluation('goodbye\n', false),
        exitCode: 0,
      },
      assistance: 'none',
      createdAt: 2,
      recordedRevision: 2,
    })
    snapshot.evidence.push({
      id: 'evidence:failed',
      type: 'independent',
      outcome: 'failure',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      templateId: 'template.main',
      templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      exerciseInstanceId: 'exercise:failed',
      attemptId: 'attempt:failed',
      createdAt: 2,
    })
    snapshot.reviewArtifacts.push({
      id: 'remediation:pending',
      type: 'remediation',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      diagnosticStatus: 'pending',
      diagnosticAttempts: 0,
      diagnosticFailure: null,
      nextDiagnosticAttemptAt: null,
      diagnosticClaim: null,
      misconceptionTheme: null,
      markdown: null,
      attemptIds: ['attempt:failed'],
      evidenceIds: ['evidence:failed'],
      createdAt: 10,
      updatedAt: 10,
      createdRevision: 2,
      updatedRevision: 2,
    })
    snapshot.reviewArtifacts.push({
      id: 'clarification:continuity',
      type: 'clarification',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point analogy',
      markdown: 'The learner found a doorway analogy useful.',
      retainedAsReadOnly: false,
      createdAt: 3,
      updatedAt: 3,
      createdRevision: 3,
      updatedRevision: 3,
    })
    snapshot.removedReviewArtifacts.push({
      id: 'clarification:removed',
      type: 'clarification',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point',
      suppressionKey: 'clarification:cj.program.main:entry point',
      suppressionActive: true,
      createdAt: 1,
      updatedAt: 2,
      createdRevision: 1,
      updatedRevision: 2,
      removedAt: 3,
      removedRevision: 3,
      retentionAllowedAt: null,
      retentionAllowedRevision: null,
    })

    const result = await call<{
      retainedArtifacts: unknown[]
      pendingRemediations: unknown[]
      activeRetentionSuppressions: unknown[]
    }>(toolkit, 'read_classroom_state', {})
    expect(result.retainedArtifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'remediation:pending',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        markdown: null,
      }),
      expect.objectContaining({
        id: 'clarification:continuity',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        markdown: 'The learner found a doorway analogy useful.',
        retainedAsReadOnly: false,
      }),
    ]))
    expect(result.pendingRemediations).toEqual([expect.objectContaining({
      id: 'remediation:pending',
      learningSkillId: 'skill.main',
      failedAttemptIds: ['attempt:failed'],
    })])
    const pendingSerialized = JSON.stringify(result.pendingRemediations)
    expect(pendingSerialized).not.toContain('diagnosticContext')
    expect(pendingSerialized).not.toContain('expectedOutput')
    expect(pendingSerialized).not.toContain('sourceRequirements')
    expect(pendingSerialized).not.toContain('goodbye')
    expect(result.activeRetentionSuppressions).toEqual([expect.objectContaining({
      id: 'clarification:removed',
      misconceptionTheme: 'entry point',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })])
  })

  it('projects suppression identities at exact content and learning-contract versions', async () => {
    const snapshot = createEmptyClassroom()
    snapshot.revision = 12
    const addFailedLineage = (
      suffix: string,
      contentVersion: string,
      learningContractVersion: string,
      instanceRevision: number,
    ) => {
      const instanceId = `exercise:${suffix}`
      const attemptId = `attempt:${suffix}`
      const evidenceId = `evidence:${suffix}`
      const attemptRevision = instanceRevision + 1
      snapshot.stream.push({
        id: instanceId,
        type: 'exercise_instance',
        learningTrackId: null,
        tutoringStepId: `step:${suffix}`,
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        packId: 'pack.main',
        contentVersion,
        learningContractVersion,
        templateId: 'template.main',
        templateVersion: contentVersion,
        purpose: 'practice',
        personalizationInputs: {
          unresolvedFailureEvidenceIds: [],
          remediationArtifactIds: [],
        },
        personalizationPolicyVersion: 2,
        effectiveDifficulty: 'standard',
        task: structuredClone(validatedPack().exerciseTemplates[0].task),
        createdAt: instanceRevision,
        recordedRevision: instanceRevision,
      })
      snapshot.attempts.push({
        id: attemptId,
        exerciseInstanceId: instanceId,
        assistanceEventIds: [],
        teacherExposureEpochId: null,
        submission: {
          type: 'code_output',
          code: 'main() { println("wrong") }',
        },
        result: {
          passed: false,
          runnerOk: true,
          phase: 'run',
          stdout: diagnostic('wrong'),
          stderr: diagnostic(''),
          compilerOutput: diagnostic(''),
          outputEvaluation: outputEvaluation('wrong', false),
          exitCode: 0,
        },
        assistance: 'none',
        createdAt: attemptRevision,
        recordedRevision: attemptRevision,
      })
      snapshot.evidence.push({
        id: evidenceId,
        type: 'independent',
        outcome: 'failure',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        contentVersion,
        learningContractVersion,
        templateId: 'template.main',
        templateVersion: contentVersion,
        exerciseInstanceId: instanceId,
        attemptId,
        createdAt: attemptRevision,
      })
      return { attemptId, attemptRevision, evidenceId }
    }
    const first = addFailedLineage('contract-v1', 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'lc:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 1)
    const second = addFailedLineage('contract-v2', 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333', 'lc:sha256:4444444444444444444444444444444444444444444444444444444444444444', 3)

    snapshot.removedReviewArtifacts.push(
      {
        id: 'clarification:v1',
        type: 'clarification',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        misconceptionTheme: 'same theme',
        suppressionKey: clarificationSuppressionKey(
          'cj.program.main',
          'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          'same theme',
        ),
        suppressionActive: true,
        createdAt: 1,
        updatedAt: 1,
        createdRevision: 1,
        updatedRevision: 1,
        removedAt: 6,
        removedRevision: 6,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      },
      {
        id: 'clarification:v2',
        type: 'clarification',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
        misconceptionTheme: 'same theme',
        suppressionKey: clarificationSuppressionKey(
          'cj.program.main',
          'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
          'same theme',
        ),
        suppressionActive: true,
        createdAt: 2,
        updatedAt: 2,
        createdRevision: 2,
        updatedRevision: 2,
        removedAt: 7,
        removedRevision: 7,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      },
      {
        id: 'remediation:v1',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        misconceptionTheme: 'same theme',
        suppressionKey: remediationSuppressionKey(
          'cj.program.main',
          'skill.main',
          [first.attemptId],
        ),
        suppressionActive: true,
        attemptIds: [first.attemptId],
        evidenceIds: [first.evidenceId],
        createdAt: first.attemptRevision,
        updatedAt: first.attemptRevision,
        createdRevision: first.attemptRevision,
        updatedRevision: first.attemptRevision,
        removedAt: 8,
        removedRevision: 8,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      },
      {
        id: 'remediation:v2',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        misconceptionTheme: 'same theme',
        suppressionKey: remediationSuppressionKey(
          'cj.program.main',
          'skill.main',
          [second.attemptId],
        ),
        suppressionActive: true,
        attemptIds: [second.attemptId],
        evidenceIds: [second.evidenceId],
        createdAt: second.attemptRevision,
        updatedAt: second.attemptRevision,
        createdRevision: second.attemptRevision,
        updatedRevision: second.attemptRevision,
        removedAt: 9,
        removedRevision: 9,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      },
    )
    const versionOnePack = validatedPack()
    versionOnePack.learningContractVersion = 'lc:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const versionTwoPack = structuredClone(validatedPack())
    versionTwoPack.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    versionTwoPack.learningContractVersion = 'lc:sha256:4444444444444444444444444444444444444444444444444444444444444444'
    const versionedCatalog = createContentPackCatalog(
      [versionOnePack, versionTwoPack],
      { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
    )

    const { toolkit: versionOneToolkit } = setup(
      () => ({
        mode: 'review',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningTrackId: null,
      }),
      { snapshot, catalog: versionedCatalog },
    )
    const versionOneResult = await call<{
      activeRetentionSuppressions: unknown[]
    }>(versionOneToolkit, 'read_classroom_state', {})
    expect(versionOneResult.activeRetentionSuppressions).toEqual([
      expect.objectContaining({
        id: 'clarification:v1',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      expect.objectContaining({
        id: 'remediation:v1',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      }),
    ])

    const { toolkit: versionTwoToolkit } = setup(
      () => ({
        mode: 'review',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
        learningTrackId: null,
      }),
      { snapshot, catalog: versionedCatalog },
    )
    const versionTwoResult = await call<{
      activeRetentionSuppressions: unknown[]
    }>(versionTwoToolkit, 'read_classroom_state', {})
    expect(versionTwoResult.activeRetentionSuppressions).toEqual([
      expect.objectContaining({
        id: 'clarification:v2',
        contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      }),
      expect.objectContaining({
        id: 'remediation:v2',
        learningContractVersion: `lc:sha256:${'4'.repeat(64)}`,
      }),
    ])
  })

  it('projects cross-Track assessment eligibility instead of making a cloned form look fresh', async () => {
    const snapshot = createEmptyClassroom()
    snapshot.revision = 5
    snapshot.activeTrackId = 'track:new'
    snapshot.tracks.push({
      id: 'track:new',
      goal: 'Continue the repeated assessment safely.',
      conceptIds: ['cj.program.main'],
      contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      adjustments: [],
      createdAt: 1,
      recordedRevision: 1,
    })
    const task = structuredClone(validatedPack().exerciseTemplates[0].task)
    snapshot.stream.push(
      {
        id: 'exercise:old-track',
        type: 'exercise_instance',
        learningTrackId: 'track:old',
        tutoringStepId: 'step:old',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        packId: 'pack.main',
        contentVersion: 'cv:sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        learningContractVersion: `lc:sha256:${'e'.repeat(64)}`,
        templateId: 'template.main',
        templateVersion: 'cv:sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        purpose: 'practice',
        personalizationInputs: {
          unresolvedFailureEvidenceIds: [],
          remediationArtifactIds: [],
        },
        personalizationPolicyVersion: 2,
        effectiveDifficulty: 'standard',
        task,
        createdAt: 2,
        recordedRevision: 2,
      },
      {
        id: 'exercise:new-track-clone',
        type: 'exercise_instance',
        learningTrackId: 'track:new',
        tutoringStepId: 'step:new',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        packId: 'pack.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        templateId: 'template.main',
        templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        purpose: 'practice',
        personalizationInputs: {
          unresolvedFailureEvidenceIds: [],
          remediationArtifactIds: [],
        },
        personalizationPolicyVersion: 2,
        effectiveDifficulty: 'standard',
        task: structuredClone(task),
        createdAt: 5,
        recordedRevision: 5,
      },
    )
    snapshot.assistanceEvents.push({
      id: 'assistance:old-hint',
      type: 'hint',
      exerciseInstanceId: 'exercise:old-track',
      hintIndex: 0,
      createdAt: 3,
      recordedRevision: 3,
    })
    snapshot.attempts.push({
      id: 'attempt:old',
      exerciseInstanceId: 'exercise:old-track',
      assistanceEventIds: ['assistance:old-hint'],
      teacherExposureEpochId: null,
      submission: {
        type: 'code_output',
        code: 'main() { println("hello") }',
      },
      result: {
        passed: true,
        runnerOk: true,
        phase: 'run',
        stdout: diagnostic('hello'),
        stderr: diagnostic(''),
        compilerOutput: diagnostic(''),
        outputEvaluation: outputEvaluation('hello', true),
        exitCode: 0,
      },
      assistance: 'hint',
      createdAt: 4,
      recordedRevision: 4,
    })
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:new' }),
      { snapshot },
    )

    const result = await call<{
      activeExercises: Array<{
        id: string
        instanceAttemptCount: number
        instanceAssistanceTypes: string[]
        assessmentEligibility: {
          applicableAssistanceEventIds: string[]
          assessmentPreviouslyAttempted: boolean
          expectedNextAssistance: string
          expectedNextEvidenceType: string
        }
      }>
    }>(toolkit, 'read_classroom_state', {})

    expect(result.activeExercises).toEqual([expect.objectContaining({
      id: 'exercise:new-track-clone',
      instanceAttemptCount: 0,
      instanceAssistanceTypes: [],
      assessmentEligibility: {
        applicableAssistanceEventIds: ['assistance:old-hint'],
        applicableAssistanceEventCount: 1,
        applicableAssistanceEventIdsTruncated: false,
        applicableAssistanceTypes: ['hint'],
        teacherExposureActive: false,
        assessmentPreviouslyAttempted: true,
        expectedNextAssistance: 'hint',
        expectedNextEvidenceType: 'aided',
      },
    })])
  })

  it('bounds every growing classroom collection by current scope and recency', async () => {
    const snapshot = createEmptyClassroom()
    snapshot.revision = 1_000
    snapshot.activeTrackId = 'track:large'
    const repeatedConceptIds: string[] = []
    for (let index = 0; index < 100; index += 1)
      repeatedConceptIds.push('cj.program.main')
    snapshot.tracks.push({
      id: 'track:large',
      goal: 'Bound a large classroom.',
      conceptIds: repeatedConceptIds,
      contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      adjustments: Array.from({ length: 30 }, (_, index) => ({
        id: `adjustment:${index}`,
        type: 'review' as const,
        decision: 'review_prior_encounter' as const,
        conceptId: 'cj.program.main',
        encounteredStreamEntryId: `exercise:${index}`,
        createdAt: index + 1,
        recordedRevision: index + 1,
      })),
      createdAt: 1,
      recordedRevision: 1,
    })
    for (let index = 0; index < 40; index += 1) {
      snapshot.stream.push({
        id: `exercise:${index}`,
        type: 'exercise_instance',
        learningTrackId: 'track:large',
        tutoringStepId: `step:${index}`,
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        packId: 'pack.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        templateId: 'template.main',
        templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        purpose: 'practice',
        personalizationInputs: {
          unresolvedFailureEvidenceIds: [],
          remediationArtifactIds: [],
        },
        personalizationPolicyVersion: 2,
        effectiveDifficulty: 'standard',
        task: {
          type: 'code_output',
          prompt: `${index}:`.padEnd(10_000, 'p'),
          starterCode: 'main() {}',
          expectedOutput: 'hello',
          matchMode: 'exact',
          sourceRequirements: [{ type: 'top_level_main' }],
          hints: [],
        },
        createdAt: index + 10,
        recordedRevision: index + 10,
      })
      snapshot.attempts.push({
        id: `attempt:${index}`,
        exerciseInstanceId: `exercise:${index}`,
        assistanceEventIds: [],
        teacherExposureEpochId: null,
        submission: {
          type: 'code_output',
          code: 'main() {}',
        },
        result: {
          passed: false,
          runnerOk: true,
          phase: 'run',
          stdout: diagnostic(''),
          stderr: diagnostic(''),
          compilerOutput: diagnostic(''),
          outputEvaluation: outputEvaluation('', false),
          exitCode: 0,
        },
        assistance: 'none',
        createdAt: index + 100,
        recordedRevision: index + 100,
      })
    }
    for (let index = 0; index < 50; index += 1) {
      snapshot.evidence.push({
        id: `evidence:${index}`,
        type: 'independent',
        outcome: 'failure',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        templateId: 'template.main',
        templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        exerciseInstanceId: `exercise:${index % 40}`,
        attemptId: `attempt:${index % 40}`,
        createdAt: (index % 40) + 100,
      })
    }
    for (let index = 0; index < 40; index += 1) {
      snapshot.reviewArtifacts.push({
        id: `clarification:${index}`,
        type: 'clarification',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        misconceptionTheme: `theme ${index}`,
        markdown: `Clarification ${index}.`,
        retainedAsReadOnly: false,
        createdAt: index + 1,
        updatedAt: index + 1,
        createdRevision: index + 1,
        updatedRevision: index + 1,
      })
    }
    const failedAttemptIds = Array.from(
      { length: 30 },
      (_, index) => `attempt:${index + 10}`,
    )
    const failureEvidenceIds = Array.from(
      { length: 30 },
      (_, index) => `evidence:${index + 10}`,
    )
    for (let index = 0; index < 25; index += 1) {
      snapshot.reviewArtifacts.push({
        id: `remediation:${index}`,
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: failedAttemptIds,
        evidenceIds: failureEvidenceIds,
        createdAt: index + 100,
        updatedAt: index + 100,
        createdRevision: index + 200,
        updatedRevision: index + 200,
      })
    }
    for (let index = 0; index < 50; index += 1) {
      snapshot.removedReviewArtifacts.push({
        id: `removed:${index}`,
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill.main',
        misconceptionTheme: `removed theme ${index}`,
        suppressionKey: `remediation:cj.program.main:${index}`,
        suppressionActive: true,
        attemptIds: failedAttemptIds,
        evidenceIds: failureEvidenceIds,
        createdAt: index + 1,
        updatedAt: index + 1,
        createdRevision: index + 200,
        updatedRevision: index + 200,
        removedAt: index + 1,
        removedRevision: index + 300,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      })
    }
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:large' }),
      {
        catalog: catalogWithManySummaries(100),
        snapshot,
      },
    )

    const result = await call<{
      activeTrack: {
        conceptIds: string[]
        adjustments: unknown[]
      }
      activeTrackBounds: Record<string, {
        matchedCount: number
        returnedCount: number
        truncated: boolean
      }>
      trackPolicy: { encounteredConceptIds: string[] }
      trackPolicyBounds: {
        encounteredConceptIds: {
          matchedCount: number
          returnedCount: number
          truncated: boolean
        }
      }
      concepts: unknown[]
      recentAttempts: Array<{ id: string }>
      recentEvidence: Array<{ id: string }>
      activeExercises: Array<{
        id: string
        prompt: string
        promptTruncated: boolean
      }>
      retainedArtifacts: unknown[]
      pendingRemediations: Array<{
        id: string
        failedAttemptIds: string[]
        failedAttemptCount: number
        failedAttemptIdsTruncated: boolean
        evidenceIds: string[]
        evidenceCount: number
        evidenceIdsTruncated: boolean
      }>
      activeRetentionSuppressions: unknown[]
      collectionBounds: Record<string, {
        matchedCount: number
        returnedCount: number
        limit: number
        truncated: boolean
        strategy: string
      }>
    }>(toolkit, 'read_classroom_state', {})

    expect(result.activeTrack.conceptIds).toHaveLength(64)
    expect(result.activeTrack.adjustments).toHaveLength(20)
    expect(result.activeTrackBounds.conceptIds).toMatchObject({
      matchedCount: 100,
      returnedCount: 64,
      truncated: true,
    })
    expect(result.activeTrackBounds.adjustments).toMatchObject({
      matchedCount: 30,
      returnedCount: 20,
      truncated: true,
    })
    expect(result.trackPolicy.encounteredConceptIds).toHaveLength(64)
    expect(result.trackPolicyBounds.encounteredConceptIds).toEqual({
      matchedCount: 100,
      returnedCount: 64,
      limit: 64,
      truncated: true,
      strategy: 'recent',
    })
    expect(result.concepts).toHaveLength(64)
    expect(result.recentAttempts).toHaveLength(12)
    expect(result.recentAttempts[0].id).toBe('attempt:28')
    expect(result.recentEvidence).toHaveLength(20)
    expect(result.recentEvidence[0].id).toBe('evidence:30')
    expect(result.activeExercises).toHaveLength(12)
    expect(result.activeExercises[0]).toMatchObject({
      id: 'exercise:28',
      promptTruncated: true,
    })
    expect(result.activeExercises[0].prompt.length).toBeLessThan(4_100)
    expect(result.retainedArtifacts).toHaveLength(32)
    expect(result.pendingRemediations).toHaveLength(8)
    expect(result.pendingRemediations[0]).toMatchObject({
      id: 'remediation:17',
      failedAttemptCount: 30,
      failedAttemptIdsTruncated: true,
      evidenceCount: 30,
      evidenceIdsTruncated: true,
    })
    expect(result.pendingRemediations[0].failedAttemptIds).toHaveLength(16)
    expect(result.pendingRemediations[0].evidenceIds).toHaveLength(16)
    expect(result.activeRetentionSuppressions).toHaveLength(32)
    expect(result.collectionBounds).toMatchObject({
      concepts: {
        matchedCount: 100,
        returnedCount: 64,
        limit: 64,
        truncated: true,
        strategy: 'scope-priority',
      },
      recentAttempts: {
        matchedCount: 40,
        returnedCount: 12,
        truncated: true,
      },
      recentEvidence: {
        matchedCount: 50,
        returnedCount: 20,
        truncated: true,
      },
      activeExercises: {
        matchedCount: 40,
        returnedCount: 12,
        truncated: true,
      },
      retainedArtifacts: {
        matchedCount: 65,
        returnedCount: 32,
        truncated: true,
      },
      pendingRemediations: {
        matchedCount: 25,
        returnedCount: 8,
        truncated: true,
      },
      activeRetentionSuppressions: {
        matchedCount: 50,
        returnedCount: 32,
        truncated: true,
      },
    })
    expect(JSON.stringify(result).length).toBeLessThan(250_000)
  })

  it('propagates the turn abort to authoritative documentation search', async () => {
    const { search, toolkit } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(call(toolkit, 'search_docs', { query: 'Option', limit: 5 }, controller.signal))
      .resolves
      .toEqual({ ok: false, error: 'User aborted', aborted: true })
    expect(search).not.toHaveBeenCalled()
  })

  it.each([
    ['unavailable', 'currently unavailable'],
    ['invalid_response', 'invalid response'],
  ] as const)('does not disguise a %s documentation failure as zero hits', async (
    failure,
    expectedMessage,
  ) => {
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      {
        knowledge: {
          id: 'failed-docs',
          search: vi.fn(async () => {
            throw new KnowledgeSourceError(failure, 'provider details')
          }),
        },
      },
    )

    await expect(call(toolkit, 'search_docs', {
      query: 'Option',
      limit: 5,
    })).resolves.toEqual({
      ok: false,
      error: expect.stringContaining(expectedMessage),
    })
  })

  it('projects untrusted documentation hits into a bounded allowlist', async () => {
    const secret = 'MCP_EXTRA_FIELD_SECRET'
    const rawHits = [
      {
        sourceId: 'docs',
        ref: 'ref'.repeat(400),
        title: 'Title'.repeat(400),
        snippet: 'grounded '.repeat(2_000),
        url: 'https://docs.example.test/reference',
        answerKey: secret,
        arbitrary: { nested: secret },
      },
      {
        sourceId: 'docs',
        ref: 'unsafe-url',
        title: 'Unsafe URL',
        snippet: 'This hit must be rejected.',
        url: 'javascript:alert(1)',
        answerKey: secret,
        arbitrary: { nested: secret },
      },
      ...Array.from({ length: 40 }, (_, index) => ({
        sourceId: 'docs',
        ref: `ref-${index}`,
        title: `Result ${index}`,
        snippet: `bounded ${index} `.repeat(1_000),
        url: `https://docs.example.test/${index}`,
        answerKey: secret,
        arbitrary: { nested: secret },
      })),
    ]
    const search = vi.fn(async () => rawHits)
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { knowledge: { id: 'untrusted-mcp', search } },
    )

    const result = await call<{
      ok: true
      hits: Array<{
        sourceId: string
        ref: string
        title: string
        snippet: string
        url?: string
        truncated: boolean
        truncatedFields: string[]
      }>
      originalHitCount: number
      examinedHitCount: number
      rejectedHitCount: number
      truncated: boolean
      characterLimit: number
      returnedCharacters: number
    }>(toolkit, 'search_docs', { query: 'Option', limit: 8 })

    expect(search).toHaveBeenCalledWith('Option', {
      limit: 8,
      signal: undefined,
    })
    expect(result.originalHitCount).toBe(42)
    expect(result.examinedHitCount).toBeLessThanOrEqual(32)
    expect(result.rejectedHitCount).toBe(1)
    expect(result.hits.length).toBeLessThanOrEqual(8)
    expect(result.truncated).toBe(true)
    expect(result.characterLimit).toBe(32_000)
    expect(result.returnedCharacters).toBeLessThanOrEqual(32_000)
    expect(result.hits[0]).toMatchObject({
      truncated: true,
      truncatedFields: expect.arrayContaining(['ref', 'title', 'snippet']),
    })
    expect(result.hits[0].ref.length).toBeLessThanOrEqual(512)
    expect(result.hits[0].title.length).toBeLessThanOrEqual(512)
    expect(result.hits[0].snippet.length).toBeLessThanOrEqual(6_000)
    expect(Object.keys(result.hits[0]).sort()).toEqual([
      'ref',
      'snippet',
      'sourceId',
      'title',
      'truncated',
      'truncatedFields',
      'url',
    ])
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('answerKey')
    expect(serialized).not.toContain('arbitrary')
    expect(serialized).not.toContain('javascript:')
  })

  it('caps editor context and reports the exact original length', async () => {
    const code = `${'x'.repeat(32_000)}${'SECRET_TAIL'.repeat(1_000)}`
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { editor: { getCode: () => code } },
    )

    const result = await call<{
      ok: true
      code: string
      truncated: boolean
      originalLength: number
      characterLimit: number
    }>(toolkit, 'read_editor_code', {})
    expect(result).toMatchObject({
      ok: true,
      truncated: true,
      originalLength: code.length,
      characterLimit: 32_000,
    })
    expect(result.code).toHaveLength(32_000)
    expect(result.code).toBe(code.slice(0, 32_000))
    expect(result.code).not.toContain('SECRET_TAIL')
  })

  it('projects Playground tabs as bounded metadata without code or full content', async () => {
    const secret = 'PLAYGROUND_CODE_SECRET'
    const tabs = Array.from({ length: 80 }, (_, index) => ({
      id: `tab-${index}-${'i'.repeat(400)}`,
      title: `Title ${index} ${'t'.repeat(800)}`,
      code: secret,
      fullContent: { markdown: secret },
    }))
    const { toolkit } = setup(
      () => ({ mode: 'live', learningTrackId: 'track:active' }),
      { playground: { listTabs: () => tabs } },
    )

    const result = await call<{
      ok: true
      tabs: Array<{
        id: string
        title: string
        truncated: boolean
        truncatedFields: string[]
      }>
      originalTabCount: number
      examinedTabCount: number
      truncated: boolean
      characterLimit: number
      returnedCharacters: number
    }>(toolkit, 'list_playground_tabs', {})
    expect(result.originalTabCount).toBe(80)
    expect(result.examinedTabCount).toBeLessThanOrEqual(64)
    expect(result.tabs.length).toBeLessThanOrEqual(32)
    expect(result.truncated).toBe(true)
    expect(result.characterLimit).toBe(16_000)
    expect(result.returnedCharacters).toBeLessThanOrEqual(16_000)
    expect(result.tabs[0].id.length).toBeLessThanOrEqual(256)
    expect(result.tabs[0].title.length).toBeLessThanOrEqual(512)
    expect(result.tabs[0]).toMatchObject({
      truncated: true,
      truncatedFields: ['id', 'title'],
    })
    expect(Object.keys(result.tabs[0]).sort()).toEqual([
      'id',
      'title',
      'truncated',
      'truncatedFields',
    ])
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain('fullContent')
  })

  it('enforces Review Chat scope in the capability boundary, not only the prompt', async () => {
    const { execute, toolkit } = setup(() => ({
      mode: 'review',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningTrackId: 'track:review',
    }))
    await expect(call(toolkit, 'append_content_reference_group', {
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      blockIds: ['block.main'],
    })).resolves.toMatchObject({ ok: false })
    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    })).resolves.toMatchObject({ ok: false })
    await expect(call(toolkit, 'record_track_adjustment', {
      type: 'review',
      conceptId: 'cj.program.main',
      encounteredStreamEntryId: 'stream:1',
    })).resolves.toMatchObject({ ok: false })
    expect(execute).not.toHaveBeenCalled()
  })

  it('selects the Review Check from the explicitly read historical Content Version', async () => {
    const historical = validatedPack()
    const current = structuredClone(historical)
    current.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    }))
    const { execute, toolkit } = setup(
      () => ({
        mode: 'review',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningTrackId: 'track:review',
      }),
      {
        catalog: createContentPackCatalog(
          [historical, current],
          { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
        ),
      },
    )

    await expect(call(toolkit, 'read_classroom_state', {})).resolves.toMatchObject({
      displayedReviewContentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chatScope: {
        mode: 'review',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      concepts: [expect.objectContaining({
        conceptId: 'cj.program.main',
        version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        currentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      })],
    })
    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main.review',
      personalizationInputs: {},
    })).resolves.toEqual({ ok: true })
    expect(execute).toHaveBeenCalledWith({
      type: 'create_review_check',
      learningTrackId: 'track:review',
      tutoringStepId: 'teacher-tool:test-create_exercise_instance',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main.review',
      personalizationInputs: {},
    })

    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main',
      personalizationInputs: {},
    })).resolves.toMatchObject({ ok: false })
    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      templateId: 'template.main.review',
      personalizationInputs: {},
    })).resolves.toMatchObject({ ok: false })
    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:0000000000000000000000000000000000000000000000000000000000000000',
      templateId: 'template.main.review',
      personalizationInputs: {},
    })).resolves.toMatchObject({ ok: false })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('cannot create a Review Check from Live Chat', async () => {
    const { execute, toolkit } = setup(() => ({
      mode: 'live',
      learningTrackId: 'track:active',
    }))

    await expect(call(toolkit, 'create_exercise_instance', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      templateId: 'template.main.review',
      personalizationInputs: {},
    })).resolves.toEqual({
      ok: false,
      error: 'Live Chat cannot create a Review Check; open Review View.',
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('pins Live Clarifications for a Track Concept but permits exact out-of-Track help', async () => {
    const historical = validatedPack()
    const current = structuredClone(historical)
    current.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    }))
    const catalog = createContentPackCatalog(
      [historical, current],
      { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
    )
    const snapshot = createEmptyClassroom()
    snapshot.activeTrackId = 'track:pinned'
    snapshot.tracks.push({
      id: 'track:pinned',
      goal: 'Use the pinned curriculum.',
      conceptIds: ['cj.program.main'],
      contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      adjustments: [],
      createdAt: 1,
      recordedRevision: 1,
    })
    const live = setup(
      () => ({ mode: 'live', learningTrackId: 'track:pinned' }),
      { catalog, snapshot },
    )

    await expect(call(live.toolkit, 'retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      misconceptionTheme: 'entry point',
      markdown: 'The entry point is `main`.',
    })).resolves.toMatchObject({ ok: false })
    await expect(call(live.toolkit, 'retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point',
      markdown: 'The entry point is `main`.',
    })).resolves.toEqual({ ok: true })
    expect(live.execute).toHaveBeenCalledWith(expect.objectContaining({
      type: 'retain_clarification',
      learningTrackId: 'track:pinned',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }))

    const readOnly = {
      ...validatedPack(),
      review: { status: 'pending' as const },
    }
    const outOfTrack = setup(
      () => ({ mode: 'live', learningTrackId: null }),
      { catalog: createContentPackCatalog([readOnly]) },
    )
    await expect(call(outOfTrack.toolkit, 'retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'historical entry point',
      markdown: 'This explanation is tied to the exact version read.',
    })).resolves.toEqual({ ok: true })
    expect(outOfTrack.execute).toHaveBeenCalledWith(expect.objectContaining({
      type: 'retain_clarification',
      learningTrackId: null,
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }))
  })

  it('lets Review Clarifications bind an exact existing version in their Concept scope', async () => {
    const historical = validatedPack()
    const current = structuredClone(historical)
    current.version = 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333'
    current.exerciseTemplates = current.exerciseTemplates.map(template => ({
      ...template,
      version: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    }))
    const { execute, toolkit } = setup(
      () => ({
        mode: 'review',
        conceptId: 'cj.program.main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningTrackId: 'track:review',
      }),
      {
        catalog: createContentPackCatalog(
          [historical, current],
          { 'cj.program.main': 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333' },
        ),
      },
    )

    await expect(call(toolkit, 'retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      misconceptionTheme: 'entry point',
      markdown: 'The entry point is `main`.',
    })).resolves.toEqual({ ok: true })
    await expect(call(toolkit, 'retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:3333333333333333333333333333333333333333333333333333333333333333',
      misconceptionTheme: 'different displayed version',
      markdown: 'This must not leak into the displayed historical scope.',
    })).resolves.toMatchObject({ ok: false })
    await expect(call(toolkit, 'retain_clarification', {
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:0000000000000000000000000000000000000000000000000000000000000000',
      misconceptionTheme: 'unknown version',
      markdown: 'This must not be retained.',
    })).resolves.toMatchObject({ ok: false })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})

describe('background Remediation toolkit', () => {
  it('exposes only the assigned context and enforces read-once-before-write on the exact turn', async () => {
    const snapshot = pendingRemediationSnapshot()
    for (let index = 0; index < 9; index += 1) {
      snapshot.reviewArtifacts.push({
        id: `remediation:unrelated:${index}`,
        type: 'remediation',
        conceptId: `secret.unrelated.${index}`,
        learningSkillId: `secret.skill.${index}`,
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: [`attempt:unrelated:${index}`],
        evidenceIds: [`evidence:unrelated:${index}`],
        createdAt: 10 + index,
        updatedAt: 10 + index,
        createdRevision: 10 + index,
        updatedRevision: 10 + index,
      })
    }
    const execute = createClassroomExecuteMock(snapshot)
    const toolCallBudget = createTeacherToolCallBudget()
    const firstController = new AbortController()
    const firstLease = toolCallBudget.open(firstController.signal, {
      total: 4,
      documentationSearches: 0,
    })
    let assignedFailedAttemptId: string | null = 'attempt:assigned'
    let assignedRemediationClaim: RemediationDiagnosticClaimAuthority | null = {
      job: {
        artifactId: 'remediation:assigned',
        failedAttemptId: 'attempt:assigned',
        diagnosticAttempt: 1,
      },
      ownerNonce: 'owner:assigned',
    }
    const toolkit = createRemediationToolkit({
      classroom: {
        read: () => snapshot,
        commit: command => execute(command),
      },
      mutationBudget: createTeacherMutationBudget(1),
      toolCallBudget,
      getAssignedFailedAttemptId: () => assignedFailedAttemptId,
      getAssignedRemediationClaim: () => assignedRemediationClaim,
    })
    expect(Object.keys(toolkit).sort()).toEqual([
      'read_assigned_remediation_context',
      'retain_remediation',
    ])

    await expect(call(toolkit, 'retain_remediation', {
      misconceptionTheme: 'wrong output',
      markdown: 'Print the required value.',
    }, firstController.signal, [])).resolves.toEqual({
      ok: false,
      error: 'Read and receive the assigned Remediation context in this turn before retaining a diagnostic.',
    })
    expect(execute).not.toHaveBeenCalled()

    const read = await call<Record<string, unknown>>(
      toolkit,
      'read_assigned_remediation_context',
      {},
      firstController.signal,
      [],
    )
    expect(read).toMatchObject({
      ok: true,
      remediation: {
        artifactId: 'remediation:assigned',
        conceptId: 'cj.program.main',
        failedAttemptId: 'attempt:assigned',
        diagnosticContext: {
          exerciseInstanceId: 'exercise:assigned',
          result: {
            passed: false,
            stdout: 'goodbye\n',
            compilerOutput: 'compiler warning',
          },
        },
      },
    })
    expect(JSON.stringify(read)).not.toContain('secret.unrelated')
    await expect(call(
      toolkit,
      'read_assigned_remediation_context',
      {},
      firstController.signal,
      [],
    )).resolves.toEqual({
      ok: false,
      error: 'The assigned Remediation context was already read in this turn.',
    })

    await expect(call(toolkit, 'retain_remediation', {
      misconceptionTheme: 'wrong output',
      markdown: 'Print the required value.',
    }, firstController.signal, successfulRemediationReadMessages()))
      .resolves
      .toEqual({ ok: true })
    expect(execute).toHaveBeenCalledWith({
      type: 'retain_remediation',
      artifactId: expect.stringMatching(/^teacher-tool:/),
      failedAttemptId: 'attempt:assigned',
      misconceptionTheme: 'wrong output',
      markdown: 'Print the required value.',
      diagnosticClaim: assignedRemediationClaim,
    })
    firstLease.close()

    const secondController = new AbortController()
    const secondLease = toolCallBudget.open(secondController.signal, {
      total: 3,
      documentationSearches: 0,
    })
    await expect(call(toolkit, 'retain_remediation', {
      misconceptionTheme: 'wrong output',
      markdown: 'A stale read cannot authorize this turn.',
    }, secondController.signal, successfulRemediationReadMessages()))
      .resolves
      .toMatchObject({
        ok: false,
        error: expect.stringContaining(
          'Read and receive the assigned Remediation context',
        ),
      })
    await call(
      toolkit,
      'read_assigned_remediation_context',
      {},
      secondController.signal,
      [],
    )
    assignedRemediationClaim = null
    assignedFailedAttemptId = 'attempt:changed'
    await expect(call(toolkit, 'retain_remediation', {
      misconceptionTheme: 'wrong target',
      markdown: 'The assigned target changed.',
    }, secondController.signal, successfulRemediationReadMessages()))
      .resolves
      .toMatchObject({
        ok: false,
      })
    expect(execute).toHaveBeenCalledTimes(1)
    secondLease.close()
  })

  it('fails closed instead of retaining a diagnosis from a truncated Attempt context', async () => {
    const snapshot = pendingRemediationSnapshot()
    const attempt = snapshot.attempts[0]!
    if (attempt.submission.type !== 'code_output')
      throw new Error('expected code-output fixture')
    attempt.submission.code = 'x'.repeat(12_001)
    const execute = createClassroomExecuteMock(snapshot)
    const toolCallBudget = createTeacherToolCallBudget()
    const controller = new AbortController()
    const lease = toolCallBudget.open(controller.signal, {
      total: 2,
      documentationSearches: 0,
    })
    const toolkit = createRemediationToolkit({
      classroom: {
        read: () => snapshot,
        commit: command => execute(command),
      },
      mutationBudget: createTeacherMutationBudget(1),
      toolCallBudget,
      getAssignedFailedAttemptId: () => 'attempt:assigned',
    })

    await expect(call(
      toolkit,
      'read_assigned_remediation_context',
      {},
      controller.signal,
      [],
    )).resolves.toEqual({
      ok: false,
      error: expect.stringContaining(
        'exceeds the complete grounded diagnostic context limit',
      ),
    })
    await expect(call(toolkit, 'retain_remediation', {
      misconceptionTheme: 'guessed diagnosis',
      markdown: 'This must not be retained.',
    }, controller.signal, successfulRemediationReadMessages())).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Read and receive'),
    })
    expect(execute).not.toHaveBeenCalled()
    lease.close()
  })

  it('fails closed when a multibyte persisted diagnostic already omitted source bytes', async () => {
    const snapshot = pendingRemediationSnapshot()
    snapshot.attempts[0]!.result.stderr = await summarizeAttemptDiagnostic(
      '错误'.repeat(150_000),
    )
    expect(snapshot.attempts[0]!.result.stderr.omittedUtf8Bytes).toBeGreaterThan(0)
    const execute = createClassroomExecuteMock(snapshot)
    const toolCallBudget = createTeacherToolCallBudget()
    const controller = new AbortController()
    const lease = toolCallBudget.open(controller.signal, {
      total: 1,
      documentationSearches: 0,
    })
    const toolkit = createRemediationToolkit({
      classroom: {
        read: () => snapshot,
        commit: command => execute(command),
      },
      mutationBudget: createTeacherMutationBudget(1),
      toolCallBudget,
      getAssignedFailedAttemptId: () => 'attempt:assigned',
    })

    await expect(call(
      toolkit,
      'read_assigned_remediation_context',
      {},
      controller.signal,
      [],
    )).resolves.toEqual({
      ok: false,
      error: expect.stringContaining(
        'exceeds the complete grounded diagnostic context limit',
      ),
    })
    expect(execute).not.toHaveBeenCalled()
    lease.close()
  })

  it('fails closed when the runner truncated a diagnostic before local persistence', async () => {
    const snapshot = pendingRemediationSnapshot()
    snapshot.attempts[0]!.result.stdout = await summarizeAttemptDiagnostic(
      'expected prefix',
      true,
    )
    snapshot.attempts[0]!.result.outputEvaluation!.stdoutSourceTruncated = true
    expect(snapshot.attempts[0]!.result.stdout).toMatchObject({
      sourceTruncated: true,
      omittedUtf8Bytes: 0,
    })
    const execute = createClassroomExecuteMock(snapshot)
    const toolCallBudget = createTeacherToolCallBudget()
    const controller = new AbortController()
    const lease = toolCallBudget.open(controller.signal, {
      total: 1,
      documentationSearches: 0,
    })
    const toolkit = createRemediationToolkit({
      classroom: {
        read: () => snapshot,
        commit: command => execute(command),
      },
      mutationBudget: createTeacherMutationBudget(1),
      toolCallBudget,
      getAssignedFailedAttemptId: () => 'attempt:assigned',
    })

    await expect(call(
      toolkit,
      'read_assigned_remediation_context',
      {},
      controller.signal,
      [],
    )).resolves.toEqual({
      ok: false,
      error: expect.stringContaining(
        'exceeds the complete grounded diagnostic context limit',
      ),
    })
    expect(execute).not.toHaveBeenCalled()
    lease.close()
  })

  it.each(['read-first', 'retention-first'] as const)(
    'does not treat a same-step %s parallel assigned-context call as model-observed',
    async (order) => {
      const snapshot = pendingRemediationSnapshot()
      const execute = createClassroomExecuteMock(snapshot)
      const toolCallBudget = createTeacherToolCallBudget()
      const controller = new AbortController()
      const lease = toolCallBudget.open(controller.signal, {
        total: 2,
        documentationSearches: 0,
      })
      const toolkit = createRemediationToolkit({
        classroom: {
          read: () => snapshot,
          commit: command => execute(command),
        },
        mutationBudget: createTeacherMutationBudget(1),
        toolCallBudget,
        getAssignedFailedAttemptId: () => 'attempt:assigned',
      })
      const read = () => call(
        toolkit,
        'read_assigned_remediation_context',
        {},
        controller.signal,
        [],
      )
      const retain = () => call(toolkit, 'retain_remediation', {
        misconceptionTheme: 'wrong output',
        markdown: 'Print the required value.',
      }, controller.signal, [])
      const results = order === 'read-first'
        ? await Promise.all([read(), retain()])
        : await Promise.all([retain(), read()])
      const retentionResult = order === 'read-first' ? results[1] : results[0]

      expect(retentionResult).toEqual({
        ok: false,
        error: 'Read and receive the assigned Remediation context in this '
          + 'turn before retaining a diagnostic.',
      })
      expect(execute).not.toHaveBeenCalled()
      lease.close()
    },
  )
})
