import {
  MAX_RUNNER_OUTPUT_BYTES,
} from '@/lib/runner-contract'
import { z } from 'zod'
import {
  contentPackIdSchema,
  contentVersionSchema,
  exerciseTaskSchema,
  learningContractVersionSchema,
} from './content-packs'
import { misconceptionThemeSchema } from './misconception-theme'
import {
  classroomSnapshotUtf8Bytes,
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
  persistedDiagnosticPreviewUtf8Bytes,
} from './persistence-policy'

export const classroomIdSchema = contentPackIdSchema
const idSchema = classroomIdSchema
const timestampSchema = z.number().int().nonnegative()
const shortTextSchema = z.string().trim().min(1).max(500)
const EMPTY_SHA256
  = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export const persistedDiagnosticSchema = z.object({
  head: z.string().max(MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES),
  tail: z.string().max(MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES),
  sourceTruncated: z.boolean(),
  originalUtf8Bytes: z.number().int().nonnegative().max(MAX_RUNNER_OUTPUT_BYTES),
  omittedUtf8Bytes: z.number().int().nonnegative().max(MAX_RUNNER_OUTPUT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  previewSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict().superRefine((diagnostic, context) => {
  const previewBytes = persistedDiagnosticPreviewUtf8Bytes(diagnostic)
  if (previewBytes > MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES) {
    context.addIssue({
      code: 'custom',
      path: ['head'],
      message: `persisted diagnostic preview cannot exceed ${MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES} UTF-8 bytes`,
    })
  }
  if (
    diagnostic.originalUtf8Bytes
    !== previewBytes + diagnostic.omittedUtf8Bytes
  ) {
    context.addIssue({
      code: 'custom',
      path: ['omittedUtf8Bytes'],
      message: 'persisted diagnostic byte accounting is inconsistent',
    })
  }
  if (
    diagnostic.omittedUtf8Bytes === 0
    && (
      diagnostic.tail !== ''
      || (diagnostic.originalUtf8Bytes === 0
        && diagnostic.sha256 !== EMPTY_SHA256)
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['tail'],
      message: 'an untruncated persisted diagnostic must use only its head',
    })
  }
  if (
    diagnostic.omittedUtf8Bytes === 0
    && diagnostic.sha256 !== diagnostic.previewSha256
  ) {
    context.addIssue({
      code: 'custom',
      path: ['previewSha256'],
      message: 'an untruncated persisted diagnostic must have matching source and preview digests',
    })
  }
})
export type PersistedDiagnostic = z.infer<typeof persistedDiagnosticSchema>

export const MAX_LEARNING_TRACK_CONCEPTS = 64
export const MAX_PERSONALIZATION_FAILURE_EVIDENCE_IDS = 8

const trackAdjustmentBaseSchema = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  recordedRevision: z.number().int().positive(),
}).strict()

export const trackAdjustmentSchema = z.discriminatedUnion('type', [
  trackAdjustmentBaseSchema.extend({
    type: z.literal('accelerate'),
    decision: z.literal('accelerate_placement_success'),
    conceptId: idSchema,
    placementEvidenceId: idSchema,
  }),
  trackAdjustmentBaseSchema.extend({
    type: z.literal('focused_catch_up'),
    decision: z.literal('focused_catch_up_placement_failure'),
    conceptId: idSchema,
    failureEvidenceId: idSchema,
  }),
  trackAdjustmentBaseSchema.extend({
    type: z.literal('review'),
    decision: z.literal('review_prior_encounter'),
    conceptId: idSchema,
    encounteredStreamEntryId: idSchema,
  }),
  trackAdjustmentBaseSchema.extend({
    type: z.literal('delay'),
    decision: z.literal('delay_blocked_frontier'),
    conceptId: idSchema,
    nextConceptId: idSchema,
    blockedEvidenceIds: z.array(idSchema).length(3),
  }),
])
export type TrackAdjustment = z.infer<typeof trackAdjustmentSchema>

export const learningTrackSchema = z.object({
  id: idSchema,
  goal: shortTextSchema,
  conceptIds: z.array(idSchema).min(1).max(MAX_LEARNING_TRACK_CONCEPTS),
  /** Content Versions used when the curriculum order was validated. */
  contentVersions: z.record(idSchema, contentVersionSchema).refine(
    versions => Object.keys(versions).length <= MAX_LEARNING_TRACK_CONCEPTS,
    `Learning Track cannot pin more than ${MAX_LEARNING_TRACK_CONCEPTS} Content Versions`,
  ),
  createdAt: timestampSchema,
  recordedRevision: z.number().int().positive(),
  adjustments: z.array(trackAdjustmentSchema)
    .max(
      MAX_CLASSROOM_TRACK_ADJUSTMENTS,
      `Learning Track cannot exceed ${MAX_CLASSROOM_TRACK_ADJUSTMENTS} adjustments`,
    )
    .default([]),
}).strict()
export type LearningTrack = z.infer<typeof learningTrackSchema>

export const personalizationInputsSchema = z.object({
  difficultyTarget: z.enum(['easy', 'hard']).optional(),
  unresolvedFailureEvidenceIds: z.array(idSchema)
    .max(MAX_PERSONALIZATION_FAILURE_EVIDENCE_IDS)
    .default([]),
  remediationArtifactIds: z.array(idSchema).max(8).default([]),
}).strict()
export type PersonalizationInputs = z.infer<typeof personalizationInputsSchema>

export const bridgeNoteMarkdownSchema = z.string().trim().min(1).max(600).refine(markdown => !markdown.includes('```') && !markdown.includes('~~~'), {
  message: 'a Bridge Note cannot contain a fenced code block',
}).refine(markdown =>
  !markdown.split('\n').some(line => line.trimStart().startsWith('#')), {
  message: 'a Bridge Note cannot contain headings',
}).refine(markdown =>
  markdown.split(/\n\s*\n/u).filter(Boolean).length <= 2, {
  message: 'a Bridge Note cannot contain more than two paragraphs',
})

export const skipMarkerBasisSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('track_adjustment'),
    adjustmentId: idSchema,
  }).strict(),
  z.object({
    type: z.literal('successful_evidence'),
    evidenceIds: z.array(idSchema).min(1).max(64),
  }).strict(),
])
export type SkipMarkerBasis = z.infer<typeof skipMarkerBasisSchema>

interface MarkdownStructure {
  codeBlockCount: number
  hasTutorialHeading: boolean
  hasUnclosedCodeBlock: boolean
}

function analyzeMarkdownStructure(markdown: string): MarkdownStructure {
  let activeFence: '```' | '~~~' | null = null
  let codeBlockCount = 0
  let hasTutorialHeading = false
  for (const line of markdown.split('\n')) {
    const trimmed = line.trimStart()
    if (activeFence) {
      if (trimmed.startsWith(activeFence))
        activeFence = null
      continue
    }
    const fence = trimmed.startsWith('```')
      ? '```'
      : trimmed.startsWith('~~~')
        ? '~~~'
        : null
    if (fence) {
      activeFence = fence
      codeBlockCount++
      continue
    }
    if (trimmed.startsWith('# ') || trimmed.startsWith('## '))
      hasTutorialHeading = true
  }
  return {
    codeBlockCount,
    hasTutorialHeading,
    hasUnclosedCodeBlock: activeFence !== null,
  }
}

export const clarificationMarkdownSchema = z.string().trim().min(1).max(2_000).refine(markdown => !analyzeMarkdownStructure(markdown).hasTutorialHeading, {
  message: 'a Clarification cannot contain level-one or level-two tutorial headings',
}).refine((markdown) => {
  const structure = analyzeMarkdownStructure(markdown)
  return !structure.hasUnclosedCodeBlock && structure.codeBlockCount <= 1
}, {
  message: 'a Clarification requires complete fences and at most one code example',
})

export const remediationMarkdownSchema = z.string().trim().min(1).max(4_000).refine(markdown => !analyzeMarkdownStructure(markdown).hasTutorialHeading, {
  message: 'a Remediation cannot contain level-one or level-two tutorial headings',
}).refine((markdown) => {
  const structure = analyzeMarkdownStructure(markdown)
  return !structure.hasUnclosedCodeBlock && structure.codeBlockCount <= 2
}, {
  message: 'a Remediation requires complete fences and at most two code examples',
})

export const retentionRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('retain_clarification'),
    learningTrackId: idSchema.nullable(),
    artifactId: idSchema,
    conceptId: idSchema,
    contentVersion: contentVersionSchema,
    misconceptionTheme: misconceptionThemeSchema,
    markdown: clarificationMarkdownSchema,
  }).strict(),
  z.object({
    type: z.literal('retain_remediation'),
    artifactId: idSchema,
    failedAttemptId: idSchema,
    misconceptionTheme: misconceptionThemeSchema,
    markdown: remediationMarkdownSchema,
  }).strict(),
])
export type RetentionRequest = z.infer<typeof retentionRequestSchema>

const streamEntryBaseSchema = z.object({
  id: idSchema,
  learningTrackId: idSchema.nullable(),
  conceptId: idSchema,
  createdAt: timestampSchema,
  recordedRevision: z.number().int().positive(),
}).strict()

export const contentReferenceGroupSchema = streamEntryBaseSchema.extend({
  type: z.literal('content_reference_group'),
  tutoringStepId: idSchema,
  learningSkillId: idSchema,
  packId: idSchema,
  contentVersion: contentVersionSchema,
  blockIds: z.array(idSchema).min(1).max(64),
})

export const exerciseInstanceSchema = streamEntryBaseSchema.extend({
  type: z.literal('exercise_instance'),
  tutoringStepId: idSchema,
  learningSkillId: idSchema,
  packId: idSchema,
  contentVersion: contentVersionSchema,
  learningContractVersion: learningContractVersionSchema,
  templateId: idSchema,
  templateVersion: contentVersionSchema,
  purpose: z.enum(['practice', 'placement', 'review']),
  personalizationInputs: personalizationInputsSchema,
  personalizationPolicyVersion: z.literal(2),
  effectiveDifficulty: z.enum(['standard', 'easy', 'hard']),
  task: exerciseTaskSchema,
})
export type ExerciseInstance = z.infer<typeof exerciseInstanceSchema>

export const classroomStreamEntrySchema = z.discriminatedUnion('type', [
  contentReferenceGroupSchema,
  exerciseInstanceSchema,
  streamEntryBaseSchema.extend({
    type: z.literal('bridge_note'),
    tutoringStepId: idSchema,
    markdown: bridgeNoteMarkdownSchema,
  }),
  streamEntryBaseSchema.extend({
    type: z.literal('skip_marker'),
    tutoringStepId: idSchema,
    packId: idSchema,
    contentVersion: contentVersionSchema,
    blockIds: z.array(idSchema).min(1).max(64),
    basis: skipMarkerBasisSchema,
  }),
  streamEntryBaseSchema.extend({
    type: z.literal('retention_marker'),
    artifactId: idSchema,
    artifactType: z.enum(['clarification', 'remediation']),
    request: retentionRequestSchema.nullable().default(null),
  }),
])
export type ClassroomStreamEntry = z.infer<typeof classroomStreamEntrySchema>

export const attemptSubmissionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('code_output'),
    code: z.string().max(262_144),
  }).strict(),
  z.object({
    type: z.literal('recall'),
    answer: z.string().max(5_000),
  }).strict(),
  z.object({
    type: z.literal('quiz'),
    answerIndices: z.array(
      z.array(z.number().int().nonnegative()).max(5)
        .refine(indices => new Set(indices).size === indices.length, {
          message: 'quiz answers cannot repeat an option',
        }),
    ).max(8),
  }).strict(),
])
export type AttemptSubmission = z.infer<typeof attemptSubmissionSchema>

const exerciseAssistanceEventBaseSchema = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  recordedRevision: z.number().int().positive(),
}).strict()

export const exerciseAssistanceEventSchema = exerciseAssistanceEventBaseSchema
  .extend({
    type: z.literal('hint'),
    exerciseInstanceId: idSchema,
    hintIndex: z.number().int().nonnegative(),
  })
export type ExerciseAssistanceEvent = z.infer<typeof exerciseAssistanceEventSchema>

export const teacherExposureEpochSchema = z.object({
  id: idSchema,
  interactionId: idSchema,
  createdAt: timestampSchema,
  recordedRevision: z.number().int().positive(),
}).strict()
export type TeacherExposureEpoch = z.infer<typeof teacherExposureEpochSchema>

export const exerciseAttemptSchema = z.object({
  id: idSchema,
  exerciseInstanceId: idSchema,
  assistanceEventIds: z.array(idSchema).max(MAX_CLASSROOM_ASSISTANCE_EVENTS),
  teacherExposureEpochId: idSchema.nullable(),
  submission: attemptSubmissionSchema,
  result: z.object({
    passed: z.boolean(),
    runnerOk: z.boolean().optional(),
    phase: z.enum(['compile', 'run']).optional(),
    feedback: z.string().max(10_000).optional(),
    stdout: persistedDiagnosticSchema.optional(),
    stderr: persistedDiagnosticSchema.optional(),
    compilerOutput: persistedDiagnosticSchema.optional(),
    outputEvaluation: z.object({
      matched: z.boolean(),
      stdoutSha256: z.string().regex(/^[a-f0-9]{64}$/u),
      stdoutSourceTruncated: z.boolean(),
    }).strict().optional(),
    exitCode: z.number().int().nullable().optional(),
  }).strict(),
  assistance: z.enum(['none', 'hint', 'teacher_exposure']),
  createdAt: timestampSchema,
  recordedRevision: z.number().int().positive(),
}).strict()
export type ExerciseAttempt = z.infer<typeof exerciseAttemptSchema>

export const learningEvidenceSchema = z.object({
  id: idSchema,
  type: z.enum(['aided', 'practice', 'independent']),
  outcome: z.enum(['success', 'failure']),
  conceptId: idSchema,
  learningSkillId: idSchema,
  contentVersion: contentVersionSchema,
  learningContractVersion: learningContractVersionSchema,
  templateId: idSchema.optional(),
  templateVersion: contentVersionSchema.optional(),
  exerciseInstanceId: idSchema.optional(),
  attemptId: idSchema.optional(),
  createdAt: timestampSchema,
}).strict()
export type LearningEvidence = z.infer<typeof learningEvidenceSchema>

export const remediationDiagnosticFailureSchema = z.enum([
  'generation_failed',
  'retention_not_completed',
  'context_too_large',
])
export const MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS = 3
/**
 * Marks when a persisted claim may be presented as potentially abandoned.
 * This is not a lease: time cannot revoke ownership or prove that an arbitrary
 * provider request has settled.
 */
export const REMEDIATION_DIAGNOSTIC_STALE_AFTER_MS = 45_000
export type RemediationDiagnosticFailure = z.infer<
  typeof remediationDiagnosticFailureSchema
>

export const remediationDiagnosticJobSchema = z.object({
  artifactId: idSchema,
  failedAttemptId: idSchema,
  diagnosticAttempt: z.number().int().min(1).max(
    MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS,
  ),
}).strict()
export type RemediationDiagnosticJob = z.infer<
  typeof remediationDiagnosticJobSchema
>

export const remediationDiagnosticClaimAuthoritySchema = z.object({
  job: remediationDiagnosticJobSchema,
  ownerNonce: idSchema,
}).strict()
export type RemediationDiagnosticClaimAuthority = z.infer<
  typeof remediationDiagnosticClaimAuthoritySchema
>

export const remediationDiagnosticClaimSchema
  = remediationDiagnosticClaimAuthoritySchema.extend({
    claimedAt: timestampSchema,
    expiresAt: timestampSchema,
  }).strict().superRefine((claim, context) => {
    if (
      claim.expiresAt - claim.claimedAt
      !== REMEDIATION_DIAGNOSTIC_STALE_AFTER_MS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'a Remediation diagnostic claim must use the fixed stale-warning threshold',
      })
    }
  })
export type RemediationDiagnosticClaim = z.infer<
  typeof remediationDiagnosticClaimSchema
>

/**
 * Whether Review may offer hazardous manual recovery. This never means that
 * the owner or its provider request has stopped.
 */
export function isRemediationDiagnosticClaimPotentiallyAbandoned(
  claim: RemediationDiagnosticClaim,
  observedAt: number,
): boolean {
  return observedAt >= claim.expiresAt
}

export const reviewArtifactSchema = z.discriminatedUnion('type', [
  z.object({
    id: idSchema,
    type: z.literal('clarification'),
    conceptId: idSchema,
    contentVersion: contentVersionSchema,
    misconceptionTheme: misconceptionThemeSchema,
    markdown: clarificationMarkdownSchema,
    /**
     * Immutable creation provenance. Current external review availability may
     * later be granted or revoked without rewriting retained history.
     */
    retainedAsReadOnly: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    createdRevision: z.number().int().positive(),
    updatedRevision: z.number().int().positive(),
  }).strict(),
  z.object({
    id: idSchema,
    type: z.literal('remediation'),
    conceptId: idSchema,
    learningSkillId: idSchema,
    diagnosticStatus: z.enum(['pending', 'ready', 'failed']),
    diagnosticAttempts: z.number().int().nonnegative().max(
      MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS,
    ).default(0),
    diagnosticFailure: remediationDiagnosticFailureSchema.nullable().default(null),
    nextDiagnosticAttemptAt: timestampSchema.nullable().default(null),
    diagnosticClaim: remediationDiagnosticClaimSchema.nullable().default(null),
    misconceptionTheme: misconceptionThemeSchema.nullable(),
    markdown: remediationMarkdownSchema.nullable(),
    attemptIds: z.array(idSchema).length(1),
    evidenceIds: z.array(idSchema).length(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    createdRevision: z.number().int().positive(),
    updatedRevision: z.number().int().positive(),
  }).strict(),
])
export type ReviewArtifact = z.infer<typeof reviewArtifactSchema>

const removedReviewArtifactBaseSchema = z.object({
  id: idSchema,
  conceptId: idSchema,
  misconceptionTheme: misconceptionThemeSchema.nullable(),
  suppressionKey: z.string().trim().min(1).max(1_500),
  suppressionActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdRevision: z.number().int().positive(),
  updatedRevision: z.number().int().positive(),
  removedAt: timestampSchema,
  removedRevision: z.number().int().positive(),
  retentionAllowedAt: timestampSchema.nullable(),
  retentionAllowedRevision: z.number().int().positive().nullable(),
}).strict()

export const removedReviewArtifactSchema = z.discriminatedUnion('type', [
  removedReviewArtifactBaseSchema.extend({
    type: z.literal('clarification'),
    misconceptionTheme: misconceptionThemeSchema,
    contentVersion: contentVersionSchema,
  }),
  removedReviewArtifactBaseSchema.extend({
    type: z.literal('remediation'),
    learningSkillId: idSchema,
    attemptIds: z.array(idSchema).length(1),
    evidenceIds: z.array(idSchema).length(1),
  }),
])
export type RemovedReviewArtifact = z.infer<typeof removedReviewArtifactSchema>

export const CLASSROOM_SNAPSHOT_VERSION = 8
export const classroomSnapshotSchema = z.object({
  version: z.literal(CLASSROOM_SNAPSHOT_VERSION),
  revision: z.number().int().nonnegative(),
  activeTrackId: idSchema.nullable(),
  tracks: z.array(learningTrackSchema).max(
    MAX_CLASSROOM_TRACKS,
    `AI Classroom cannot exceed ${MAX_CLASSROOM_TRACKS} Learning Tracks`,
  ),
  stream: z.array(classroomStreamEntrySchema).max(
    MAX_CLASSROOM_STREAM_ENTRIES,
    `Classroom Stream cannot exceed ${MAX_CLASSROOM_STREAM_ENTRIES} entries`,
  ),
  assistanceEvents: z.array(exerciseAssistanceEventSchema).max(
    MAX_CLASSROOM_ASSISTANCE_EVENTS,
    `AI Classroom cannot exceed ${MAX_CLASSROOM_ASSISTANCE_EVENTS} assistance events`,
  ),
  teacherExposureEpoch: teacherExposureEpochSchema.nullable(),
  attempts: z.array(exerciseAttemptSchema).max(
    MAX_CLASSROOM_ATTEMPTS,
    `AI Classroom cannot exceed ${MAX_CLASSROOM_ATTEMPTS} Attempts`,
  ),
  evidence: z.array(learningEvidenceSchema).max(
    MAX_CLASSROOM_EVIDENCE,
    `AI Classroom cannot exceed ${MAX_CLASSROOM_EVIDENCE} Learning Evidence records`,
  ),
  reviewArtifacts: z.array(reviewArtifactSchema).max(
    MAX_CLASSROOM_REVIEW_ARTIFACTS,
    `AI Classroom cannot exceed ${MAX_CLASSROOM_REVIEW_ARTIFACTS} Review Artifacts`,
  ),
  removedReviewArtifacts: z.array(removedReviewArtifactSchema).max(
    MAX_CLASSROOM_REMOVED_REVIEW_ARTIFACTS,
    `AI Classroom cannot exceed ${MAX_CLASSROOM_REMOVED_REVIEW_ARTIFACTS} removed Review Artifacts`,
  ),
}).strict().superRefine((snapshot, context) => {
  const serializedBytes = classroomSnapshotUtf8Bytes(snapshot)
  if (serializedBytes > MAX_CLASSROOM_SNAPSHOT_BYTES) {
    context.addIssue({
      code: 'custom',
      message: `AI Classroom snapshot exceeds its ${MAX_CLASSROOM_SNAPSHOT_BYTES}-byte storage budget`,
    })
  }
})
export type ClassroomSnapshot = z.infer<typeof classroomSnapshotSchema>

export function createEmptyClassroom(): ClassroomSnapshot {
  return {
    version: CLASSROOM_SNAPSHOT_VERSION,
    revision: 0,
    activeTrackId: null,
    tracks: [],
    stream: [],
    assistanceEvents: [],
    teacherExposureEpoch: null,
    attempts: [],
    evidence: [],
    reviewArtifacts: [],
    removedReviewArtifacts: [],
  }
}
