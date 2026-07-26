import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  compactClassroomSnapshot,
  MAX_CLASSROOM_ASSISTANCE_EVENTS,
  MAX_CLASSROOM_ATTEMPTS,
  MAX_CLASSROOM_EVIDENCE,
  MAX_CLASSROOM_REMOVED_REVIEW_ARTIFACTS,
  MAX_CLASSROOM_REVIEW_ARTIFACTS,
  MAX_CLASSROOM_SNAPSHOT_BYTES,
  MAX_CLASSROOM_STREAM_ENTRIES,
  MAX_CLASSROOM_TRACK_ADJUSTMENTS,
  MAX_CLASSROOM_TRACKS,
  MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES,
  MAX_RESOLVED_RETENTION_AUDIT_TAIL,
  summarizeAttemptDiagnostic,
} from './persistence-policy'
import {
  classroomSnapshotSchema,
  createEmptyClassroom,
} from './state'

describe('ai classroom persistence policy', () => {
  it('persists a bounded, content-addressed head/tail diagnostic preview', async () => {
    const source = `${'开'.repeat(400_000)}middle${'终'.repeat(200_000)}`

    const diagnostic = await summarizeAttemptDiagnostic(source)

    expect(new TextEncoder().encode(
      diagnostic.head + diagnostic.tail,
    ).byteLength).toBeLessThanOrEqual(MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES)
    expect(diagnostic.head.startsWith('开')).toBe(true)
    expect(diagnostic.tail.endsWith('终')).toBe(true)
    expect(diagnostic.originalUtf8Bytes).toBe(
      new TextEncoder().encode(source).byteLength,
    )
    expect(diagnostic.omittedUtf8Bytes).toBe(
      diagnostic.originalUtf8Bytes
      - new TextEncoder().encode(diagnostic.head + diagnostic.tail).byteLength,
    )
    expect(diagnostic.sha256).toBe(
      createHash('sha256').update(source).digest('hex'),
    )
    expect(diagnostic.previewSha256).toBe(
      createHash('sha256')
        .update(diagnostic.head + diagnostic.tail)
        .digest('hex'),
    )
    expect(diagnostic.sourceTruncated).toBe(false)
  })

  it('preserves upstream truncation independently from local preview omission', async () => {
    const diagnostic = await summarizeAttemptDiagnostic('retained prefix', true)

    expect(diagnostic).toMatchObject({
      head: 'retained prefix',
      tail: '',
      sourceTruncated: true,
      omittedUtf8Bytes: 0,
    })
  })

  it('rejects an imported snapshot with an unbounded causal stream', () => {
    expect(MAX_CLASSROOM_STREAM_ENTRIES).toBe(1_024)
    const entry = {
      id: 'stream:entry',
      type: 'bridge_note' as const,
      learningTrackId: null,
      tutoringStepId: 'step:entry',
      conceptId: 'cj.program.main',
      markdown: 'Bounded note.',
      createdAt: 1,
      recordedRevision: 1,
    }
    const snapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      stream: Array.from(
        { length: MAX_CLASSROOM_STREAM_ENTRIES + 1 },
        (_, index) => ({ ...entry, id: `stream:${index}` }),
      ),
    }

    const parsed = classroomSnapshotSchema.safeParse(snapshot)

    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(parsed.error.issues[0]?.message).toMatch(/stream/i)
  })

  it('rejects every unbounded aggregate collection at the import seam', () => {
    const contentVersion = `cv:sha256:${'a'.repeat(64)}`
    const learningContractVersion = `lc:sha256:${'b'.repeat(64)}`
    const track = {
      id: 'track:entry',
      goal: 'Bounded learning.',
      conceptIds: ['cj.program.main'],
      contentVersions: { 'cj.program.main': contentVersion },
      createdAt: 1,
      recordedRevision: 1,
      adjustments: [],
    }
    const attempt = {
      id: 'attempt:entry',
      exerciseInstanceId: 'exercise:entry',
      assistanceEventIds: [],
      teacherExposureEpochId: null,
      submission: { type: 'recall' as const, answer: 'main' },
      result: { passed: true },
      assistance: 'none' as const,
      createdAt: 1,
      recordedRevision: 1,
    }
    const evidence = {
      id: 'evidence:entry',
      type: 'independent' as const,
      outcome: 'success' as const,
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      contentVersion,
      learningContractVersion,
      createdAt: 1,
    }
    const clarification = {
      id: 'artifact:entry',
      type: 'clarification' as const,
      conceptId: 'cj.program.main',
      contentVersion,
      misconceptionTheme: 'entry point',
      markdown: 'Use `main` as the entry point.',
      retainedAsReadOnly: false,
      createdAt: 1,
      updatedAt: 1,
      createdRevision: 1,
      updatedRevision: 1,
    }
    const tombstone = {
      id: 'removed:entry',
      type: 'clarification' as const,
      conceptId: 'cj.program.main',
      contentVersion,
      misconceptionTheme: 'entry point',
      suppressionKey: 'suppression',
      suppressionActive: true,
      createdAt: 1,
      updatedAt: 1,
      createdRevision: 1,
      updatedRevision: 1,
      removedAt: 2,
      removedRevision: 2,
      retentionAllowedAt: null,
      retentionAllowedRevision: null,
    }
    const cases = [
      {
        name: 'Learning Tracks',
        snapshot: {
          ...createEmptyClassroom(),
          tracks: Array.from(
            { length: MAX_CLASSROOM_TRACKS + 1 },
            (_, index) => ({ ...track, id: `track:${index}` }),
          ),
        },
      },
      {
        name: 'Track Adjustments',
        snapshot: {
          ...createEmptyClassroom(),
          tracks: [{
            ...track,
            adjustments: Array.from(
              { length: MAX_CLASSROOM_TRACK_ADJUSTMENTS + 1 },
              (_, index) => ({
                id: `adjustment:${index}`,
                type: 'accelerate' as const,
                decision: 'accelerate_placement_success' as const,
                conceptId: 'cj.program.main',
                placementEvidenceId: `evidence:${index}`,
                createdAt: 1,
                recordedRevision: 1,
              }),
            ),
          }],
        },
      },
      {
        name: 'assistance events',
        snapshot: {
          ...createEmptyClassroom(),
          assistanceEvents: Array.from(
            { length: MAX_CLASSROOM_ASSISTANCE_EVENTS + 1 },
            (_, index) => ({
              id: `assistance:${index}`,
              type: 'hint' as const,
              exerciseInstanceId: 'exercise:entry',
              hintIndex: 0,
              createdAt: 1,
              recordedRevision: 1,
            }),
          ),
        },
      },
      {
        name: 'Attempts',
        snapshot: {
          ...createEmptyClassroom(),
          attempts: Array.from(
            { length: MAX_CLASSROOM_ATTEMPTS + 1 },
            (_, index) => ({ ...attempt, id: `attempt:${index}` }),
          ),
        },
      },
      {
        name: 'Learning Evidence',
        snapshot: {
          ...createEmptyClassroom(),
          evidence: Array.from(
            { length: MAX_CLASSROOM_EVIDENCE + 1 },
            (_, index) => ({ ...evidence, id: `evidence:${index}` }),
          ),
        },
      },
      {
        name: 'Review Artifacts',
        snapshot: {
          ...createEmptyClassroom(),
          reviewArtifacts: Array.from(
            { length: MAX_CLASSROOM_REVIEW_ARTIFACTS + 1 },
            (_, index) => ({ ...clarification, id: `artifact:${index}` }),
          ),
        },
      },
      {
        name: 'removed Review Artifacts',
        snapshot: {
          ...createEmptyClassroom(),
          removedReviewArtifacts: Array.from(
            { length: MAX_CLASSROOM_REMOVED_REVIEW_ARTIFACTS + 1 },
            (_, index) => ({ ...tombstone, id: `removed:${index}` }),
          ),
        },
      },
    ]

    for (const testCase of cases) {
      const parsed = classroomSnapshotSchema.safeParse(testCase.snapshot)
      expect(parsed.success, testCase.name).toBe(false)
    }
  })

  it('rejects a structurally bounded import that exceeds the whole-snapshot budget', () => {
    const code = 'x'.repeat(262_144)
    const snapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      attempts: Array.from({ length: 33 }, (_, index) => ({
        id: `attempt:${index}`,
        exerciseInstanceId: `exercise:${index}`,
        assistanceEventIds: [],
        teacherExposureEpochId: null,
        submission: { type: 'code_output' as const, code },
        result: { passed: false },
        assistance: 'none' as const,
        createdAt: 1,
        recordedRevision: 1,
      })),
    }
    expect(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength)
      .toBeGreaterThan(MAX_CLASSROOM_SNAPSHOT_BYTES)

    const parsed = classroomSnapshotSchema.safeParse(snapshot)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some(issue =>
        /snapshot.*storage budget/i.test(issue.message))).toBe(true)
    }
  })

  it('compacts only resolved retention audit history with no surviving provenance reference', () => {
    const auditTail = 64
    expect(MAX_RESOLVED_RETENTION_AUDIT_TAIL).toBe(auditTail)
    const contentVersion = `cv:sha256:${'a'.repeat(64)}`
    const resolved = Array.from(
      { length: auditTail + 2 },
      (_, index) => ({
        id: `artifact:${index}`,
        type: 'clarification' as const,
        conceptId: 'cj.program.main',
        contentVersion,
        misconceptionTheme: `theme ${index}`,
        suppressionKey: `suppression:${index}`,
        suppressionActive: false,
        createdAt: 1,
        updatedAt: 1,
        createdRevision: 1,
        updatedRevision: 1,
        removedAt: 2,
        removedRevision: 2,
        retentionAllowedAt: index + 3,
        retentionAllowedRevision: index + 3,
      }),
    )
    const active = {
      ...resolved[0]!,
      id: 'artifact:active',
      suppressionKey: 'suppression:active',
      suppressionActive: true,
      retentionAllowedAt: null,
      retentionAllowedRevision: null,
    }
    const markers = resolved.map((artifact, index) => ({
      id: `marker:${index}`,
      type: 'retention_marker' as const,
      learningTrackId: null,
      conceptId: artifact.conceptId,
      artifactId: artifact.id,
      artifactType: 'clarification' as const,
      request: null,
      createdAt: 1,
      recordedRevision: 1,
    }))
    const pinnedExercise = {
      id: 'exercise:pinned',
      type: 'exercise_instance' as const,
      learningTrackId: null,
      tutoringStepId: 'step:pinned',
      conceptId: 'cj.program.main',
      learningSkillId: 'skill.main',
      packId: 'pack.main',
      contentVersion,
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      templateId: 'template.main',
      templateVersion: contentVersion,
      purpose: 'practice' as const,
      personalizationInputs: {
        unresolvedFailureEvidenceIds: [],
        remediationArtifactIds: [resolved[0]!.id],
      },
      personalizationPolicyVersion: 2 as const,
      effectiveDifficulty: 'standard' as const,
      task: {
        type: 'recall' as const,
        prompt: 'Name the entry function.',
        referenceAnswer: 'main',
      },
      createdAt: 3,
      recordedRevision: 3,
    }
    const snapshot = {
      ...createEmptyClassroom(),
      revision: auditTail + 5,
      stream: [pinnedExercise, ...markers],
      removedReviewArtifacts: [...resolved, active],
    }

    const compacted = compactClassroomSnapshot(snapshot)

    expect(compacted.removedReviewArtifacts.some(item =>
      item.id === resolved[0]!.id)).toBe(true)
    expect(compacted.removedReviewArtifacts.some(item =>
      item.id === resolved[1]!.id)).toBe(false)
    expect(compacted.stream.some(item => item.id === 'marker:0')).toBe(true)
    expect(compacted.stream.some(item => item.id === 'marker:1')).toBe(false)
    expect(compacted.removedReviewArtifacts.some(item =>
      item.id === active.id)).toBe(true)
  })
})
