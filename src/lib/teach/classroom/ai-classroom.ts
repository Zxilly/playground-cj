import type { ContentPackCatalog } from './content-catalog'
import type { CourseContentPack } from './content-packs'
import { contentVersionSchema } from './content-packs'
import type {
  ClassroomSnapshot,
  ExerciseAttempt,
  ExerciseInstance,
  LearningTrack,
  RetentionRequest,
  TrackAdjustment,
} from './state'
import type { ClassroomCommitGuard, ClassroomStorage } from './storage'
import {
  isWithinRunnerOutputLimit,
  MAX_RUNNER_OUTPUT_BYTES,
} from '@/lib/runner-contract'
import { z } from 'zod'
import {
  assertClassroomIntegrity,
  deriveAttemptAssistance,
  evaluateDeterministicSubmission,
} from './integrity'
import {
  clarificationReviewGroupKey,
  clarificationSuppressionKey,
  remediationReviewGroupKey,
  remediationSuppressionKey,
} from './retention'
import { createRemediationProvenanceIndex } from './remediation-provenance'
import {
  bridgeNoteMarkdownSchema,
  clarificationMarkdownSchema,
  classroomIdSchema,
  classroomSnapshotSchema,
  createEmptyClassroom,
  isRemediationDiagnosticClaimPotentiallyAbandoned,
  MAX_LEARNING_TRACK_CONCEPTS,
  MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS,
  personalizationInputsSchema,
  REMEDIATION_DIAGNOSTIC_STALE_AFTER_MS,
  remediationDiagnosticClaimAuthoritySchema,
  remediationDiagnosticFailureSchema,
  remediationDiagnosticJobSchema,
  remediationMarkdownSchema,
  skipMarkerBasisSchema,
} from './state'
import { ClassroomRevisionConflictError } from './storage'
import { assertTrackConceptAccess } from './track-policy'
import { assertSkipMarkerBasis } from './skip-marker-policy'
import { personalizeExerciseTemplate } from './exercise-personalization'
import {
  createAssessmentHistoryIndex,
} from './assessment-policy'
import { misconceptionThemeSchema } from './misconception-theme'
import {
  deriveUnresolvedFailureEvidenceIds,
} from './personalization-candidates'
import { canonicalJson } from './canonical-json'
import {
  assertClassroomDiagnosticIntegrity,
  compactClassroomSnapshot,
  summarizeAttemptDiagnostic,
} from './persistence-policy'
import { evaluateOutput } from '../feedback/evaluate'

const runnerOutputSchema = z.string()
  .max(MAX_RUNNER_OUTPUT_BYTES)
  .refine(isWithinRunnerOutputLimit, {
    message: `runner output cannot exceed ${MAX_RUNNER_OUTPUT_BYTES} UTF-8 bytes`,
  })

const runResultSchema = z.object({
  ok: z.boolean(),
  phase: z.enum(['compile', 'run']).nullable(),
  stdout: runnerOutputSchema,
  stdoutTruncated: z.boolean(),
  stderr: runnerOutputSchema,
  stderrTruncated: z.boolean(),
  compilerOutput: runnerOutputSchema,
  compilerOutputTruncated: z.boolean(),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative().optional(),
  failureKind: z.literal('runner_unavailable').optional(),
  failureMessage: z.string().trim().min(1).max(10_000).optional(),
}).strict().superRefine((result, context) => {
  if (
    result.phase === 'run'
    && result.exitCode !== null
    && result.ok !== (result.exitCode === 0)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['ok'],
      message: 'run success must agree with the binary exit code',
    })
  }
  if (
    result.failureKind === 'runner_unavailable'
    && (
      result.ok
      || result.phase !== null
      || result.exitCode !== null
      || result.stdout !== ''
      || result.stdoutTruncated
      || result.stderr !== ''
      || result.stderrTruncated
      || result.compilerOutput !== ''
      || result.compilerOutputTruncated
      || !result.failureMessage
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['failureKind'],
      message: 'runner_unavailable requires empty compiler/runtime channels and a transport failure message',
    })
  }
  if (
    result.failureKind === undefined
    && result.failureMessage !== undefined
  ) {
    context.addIssue({
      code: 'custom',
      path: ['failureMessage'],
      message: 'only runner_unavailable may report a transport failure message',
    })
  }
  if (result.failureKind === undefined && result.phase === null) {
    context.addIssue({
      code: 'custom',
      path: ['phase'],
      message: 'a reachable runner must report its final phase',
    })
  }
  if (
    result.failureKind === undefined
    && result.phase === 'compile'
    && (
      result.ok
      || result.exitCode !== null
      || result.stdout !== ''
      || result.stdoutTruncated
      || result.stderr !== ''
      || result.stderrTruncated
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['phase'],
      message: 'a compile-phase failure cannot report a binary exit code',
    })
  }
  if (
    result.failureKind === undefined
    && result.phase === 'run'
    && result.exitCode === null
  ) {
    context.addIssue({
      code: 'custom',
      path: ['exitCode'],
      message: 'a run-phase result must report a binary exit code',
    })
  }
})

const recordAttemptBaseSchema = z.object({
  type: z.literal('record_exercise_attempt'),
  attemptId: classroomIdSchema,
  exerciseInstanceId: classroomIdSchema,
})

export const classroomCommandSchema = z.union([
  z.object({
    type: z.literal('start_learning_track'),
    trackId: classroomIdSchema,
    goal: z.string().trim().min(1).max(500),
    conceptIds: z.array(classroomIdSchema)
      .min(1)
      .max(MAX_LEARNING_TRACK_CONCEPTS),
    explicitLearnerGoal: z.literal(true),
  }).strict(),
  z.object({
    type: z.literal('activate_learning_track'),
    trackId: classroomIdSchema,
    explicitLearnerChoice: z.literal(true),
  }).strict(),
  z.object({
    type: z.literal('adjust_learning_track'),
    learningTrackId: classroomIdSchema,
    adjustment: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('accelerate'),
        conceptId: classroomIdSchema,
        placementEvidenceId: classroomIdSchema,
      }).strict(),
      z.object({
        type: z.literal('focused_catch_up'),
        conceptId: classroomIdSchema,
        failureEvidenceId: classroomIdSchema,
      }).strict(),
      z.object({
        type: z.literal('review'),
        conceptId: classroomIdSchema,
        encounteredStreamEntryId: classroomIdSchema,
      }).strict(),
      z.object({
        type: z.literal('delay'),
        conceptId: classroomIdSchema,
        nextConceptId: classroomIdSchema,
        blockedEvidenceIds: z.array(classroomIdSchema).length(3),
      }).strict(),
    ]),
  }).strict(),
  z.object({
    type: z.literal('append_content_reference_group'),
    learningTrackId: classroomIdSchema,
    tutoringStepId: classroomIdSchema,
    conceptId: classroomIdSchema,
    learningSkillId: classroomIdSchema,
    blockIds: z.array(classroomIdSchema).min(1),
  }).strict(),
  z.object({
    type: z.literal('append_bridge_note'),
    learningTrackId: classroomIdSchema,
    tutoringStepId: classroomIdSchema,
    conceptId: classroomIdSchema,
    markdown: bridgeNoteMarkdownSchema,
    teacherInteractionId: classroomIdSchema,
  }).strict(),
  z.object({
    type: z.literal('append_skip_marker'),
    learningTrackId: classroomIdSchema,
    tutoringStepId: classroomIdSchema,
    conceptId: classroomIdSchema,
    blockIds: z.array(classroomIdSchema).min(1),
    basis: skipMarkerBasisSchema,
  }).strict(),
  z.object({
    type: z.literal('create_exercise_instance'),
    learningTrackId: classroomIdSchema,
    tutoringStepId: classroomIdSchema,
    conceptId: classroomIdSchema,
    contentVersion: contentVersionSchema,
    templateId: classroomIdSchema,
    personalizationInputs: personalizationInputsSchema.partial().strict(),
  }).strict(),
  z.object({
    type: z.literal('create_review_check'),
    learningTrackId: classroomIdSchema,
    tutoringStepId: classroomIdSchema,
    conceptId: classroomIdSchema,
    contentVersion: contentVersionSchema,
    templateId: classroomIdSchema,
    personalizationInputs: z.object({}).strict(),
  }).strict(),
  z.object({
    type: z.literal('record_exercise_assistance'),
    exerciseInstanceId: classroomIdSchema,
    assistance: z.object({
      type: z.literal('hint'),
      hintIndex: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('record_teacher_exposure'),
    interactionId: classroomIdSchema,
  }).strict(),
  recordAttemptBaseSchema.extend({
    submission: z.object({
      type: z.literal('code_output'),
      code: z.string().max(262_144),
    }).strict(),
    observation: z.object({
      type: z.literal('run_result'),
      result: runResultSchema,
    }).strict(),
  }).strict(),
  recordAttemptBaseSchema.extend({
    submission: z.object({
      type: z.literal('recall'),
      answer: z.string().max(5_000),
    }).strict(),
  }).strict(),
  recordAttemptBaseSchema.extend({
    submission: z.object({
      type: z.literal('quiz'),
      answerIndices: z.array(
        z.array(z.number().int().nonnegative()).max(5)
          .refine(indices => new Set(indices).size === indices.length, {
            message: 'quiz answers cannot repeat an option',
          }),
      ).max(8),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('retain_clarification'),
    learningTrackId: classroomIdSchema.nullable(),
    artifactId: classroomIdSchema,
    conceptId: classroomIdSchema,
    contentVersion: contentVersionSchema,
    misconceptionTheme: misconceptionThemeSchema,
    markdown: clarificationMarkdownSchema,
  }).strict(),
  z.object({
    type: z.literal('retain_remediation'),
    artifactId: classroomIdSchema,
    failedAttemptId: classroomIdSchema,
    misconceptionTheme: misconceptionThemeSchema,
    markdown: remediationMarkdownSchema,
    diagnosticClaim: remediationDiagnosticClaimAuthoritySchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('claim_remediation_diagnostic'),
    job: remediationDiagnosticJobSchema,
    ownerNonce: classroomIdSchema,
    observedAt: z.number()
      .int()
      .nonnegative()
      .max(
        Number.MAX_SAFE_INTEGER
        - REMEDIATION_DIAGNOSTIC_STALE_AFTER_MS,
      ),
  }).strict(),
  z.object({
    type: z.literal(
      'recover_potentially_abandoned_remediation_diagnostic_claim',
    ),
    artifactId: classroomIdSchema,
    observedAt: z.number()
      .int()
      .nonnegative()
      .max(
        Number.MAX_SAFE_INTEGER
        - REMEDIATION_DIAGNOSTIC_STALE_AFTER_MS,
      ),
    acknowledgePotentialDuplicateProviderCall: z.literal(true),
  }).strict(),
  z.object({
    type: z.literal('release_remediation_diagnostic_claim'),
    job: remediationDiagnosticJobSchema,
    ownerNonce: classroomIdSchema,
  }).strict(),
  z.object({
    type: z.literal('record_remediation_diagnostic_failure'),
    failedAttemptId: classroomIdSchema,
    diagnosticAttempt: z.number().int().min(1).max(MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS),
    failure: remediationDiagnosticFailureSchema,
    diagnosticClaim: remediationDiagnosticClaimAuthoritySchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('retry_remediation_diagnostic'),
    artifactId: classroomIdSchema,
    explicitLearnerRetry: z.literal(true),
  }).strict(),
  z.object({
    type: z.literal('remove_review_artifact'),
    artifactId: classroomIdSchema,
  }).strict(),
  z.object({
    type: z.literal('allow_review_artifact_retention'),
    artifactId: classroomIdSchema,
  }).strict(),
])
export type ClassroomCommand = z.infer<typeof classroomCommandSchema>

export interface AIClassroom {
  open: () => Promise<ClassroomSnapshot>
  snapshot: () => ClassroomSnapshot
  subscribe: (listener: () => void) => () => void
  execute: (
    command: ClassroomCommand,
    options?: AIClassroomExecutionOptions,
  ) => Promise<ClassroomSnapshot>
  /**
   * Stops accepting work immediately, then drains opening, writes, and
   * cross-tab refreshes. It does not close the injected storage.
   */
  dispose: () => Promise<void>
}

export interface AIClassroomExecutionOptions {
  /**
   * Optional revocable authority for externally-owned work. The aggregate and
   * storage adapter both recheck it before every durable CAS attempt.
   */
  commitGuard?: ClassroomCommitGuard
}

export interface AIClassroomDependencies {
  catalog: ContentPackCatalog
  storage: ClassroomStorage
  now?: () => number
  /** Defaults to cryptographically strong `crypto.randomUUID()`. */
  createId?: () => string
  /** Receives asynchronous cross-tab refresh errors. */
  onStorageError?: (error: unknown) => void
}

interface CommandDependencies {
  catalog: ContentPackCatalog
  now: () => number
  createId: () => string
}

function defaultCreateId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function')
    throw new Error('crypto.randomUUID() is required to create AI Classroom identifiers')
  return globalThis.crypto.randomUUID()
}

function retentionRequestFor(
  command: Extract<ClassroomCommand, {
    type: 'retain_clarification' | 'retain_remediation'
  }>,
): RetentionRequest {
  if (command.type === 'retain_remediation') {
    return {
      type: command.type,
      artifactId: command.artifactId,
      failedAttemptId: command.failedAttemptId,
      misconceptionTheme: command.misconceptionTheme,
      markdown: command.markdown,
    }
  }
  return { ...command }
}

function isClassroomIdInUse(
  snapshot: ClassroomSnapshot,
  id: string,
): boolean {
  return snapshot.tracks.some(track =>
    track.id === id
    || track.adjustments.some(adjustment => adjustment.id === id))
  || snapshot.stream.some(entry => entry.id === id)
  || snapshot.assistanceEvents.some(event => event.id === id)
  || snapshot.teacherExposureEpoch?.id === id
  || snapshot.attempts.some(attempt => attempt.id === id)
  || snapshot.evidence.some(evidence => evidence.id === id)
  || snapshot.reviewArtifacts.some(artifact => artifact.id === id)
  || snapshot.removedReviewArtifacts.some(artifact => artifact.id === id)
}

function isCommittedRetentionRequest(
  snapshot: ClassroomSnapshot,
  request: RetentionRequest,
): boolean {
  const receipt = snapshot.stream.find(
    (entry): entry is Extract<
      ClassroomSnapshot['stream'][number],
      { type: 'retention_marker' }
    > =>
      entry.type === 'retention_marker'
      && entry.request?.artifactId === request.artifactId,
  )
  if (receipt) {
    if (canonicalJson(receipt.request) === canonicalJson(request))
      return true
    throw new Error(
      `Retention request ${request.artifactId} was already committed with different content`,
    )
  }

  if (isClassroomIdInUse(snapshot, request.artifactId)) {
    throw new Error(
      `Retention request id ${request.artifactId} is already in use`,
    )
  }
  return false
}

function requireActiveTrack(
  snapshot: ClassroomSnapshot,
  learningTrackId: string,
): LearningTrack {
  if (snapshot.activeTrackId !== learningTrackId) {
    throw new Error(
      `Learning Track ${learningTrackId} is no longer active; refusing to redirect the command`,
    )
  }
  const track = snapshot.tracks.find(candidate => candidate.id === learningTrackId)
  if (!track)
    throw new Error(`Learning Track ${learningTrackId} does not exist`)
  return track
}

function requireActiveConcept(
  snapshot: ClassroomSnapshot,
  learningTrackId: string,
  conceptId: string,
  catalog: ContentPackCatalog,
  use: 'mainline' | 'placement' = 'mainline',
): CourseContentPack {
  const track = requireActiveTrack(snapshot, learningTrackId)
  if (!track.conceptIds.includes(conceptId))
    throw new Error(`${conceptId} is outside the active Learning Track`)
  const contentVersion = track.contentVersions[conceptId]
  if (!contentVersion)
    throw new Error(`Active Learning Track has no Content Version for ${conceptId}`)
  const pack = catalog.requireValidatedVersion(conceptId, contentVersion)
  assertTrackConceptAccess(snapshot, track, conceptId, use, catalog)
  return pack
}

function orderedBlockIds(pack: CourseContentPack, blockIds: string[]): string[] {
  if (new Set(blockIds).size !== blockIds.length)
    throw new Error('Core Content Block selection cannot contain duplicates')
  const packOrder = new Map(pack.blocks.map((block, index) => [block.id, index]))
  const indices = blockIds.map((blockId) => {
    const index = packOrder.get(blockId)
    if (index === undefined)
      throw new Error(`${blockId} is not a Core Content Block in ${pack.id}`)
    return index
  })
  if (indices.some((index, position) => position > 0 && index <= indices[position - 1]))
    throw new Error('Core Content Block selection must preserve Course Content Pack order')
  return [...blockIds]
}

function startLearningTrack(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'start_learning_track' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  if (new Set(command.conceptIds).size !== command.conceptIds.length)
    throw new Error('A Learning Track cannot contain duplicate Concepts')

  const existing = snapshot.tracks.find(track => track.id === command.trackId)
  if (existing) {
    const exactReplay = existing.goal === command.goal
      && existing.conceptIds.length === command.conceptIds.length
      && existing.conceptIds.every(
        (conceptId, index) => conceptId === command.conceptIds[index],
      )
    if (exactReplay)
      return snapshot
    throw new Error(
      `Learning Track ${command.trackId} was already committed with different content`,
    )
  }
  if (isClassroomIdInUse(snapshot, command.trackId)) {
    throw new Error(`Learning Track id ${command.trackId} is already in use`)
  }

  const available = new Set<string>()
  const contentVersions: Record<string, string> = {}
  for (const conceptId of command.conceptIds) {
    const pack = deps.catalog.requireValidated(conceptId)
    const unmet = pack.concept.prerequisites.filter(prerequisite => !available.has(prerequisite))
    if (unmet.length > 0) {
      throw new Error(
        `Learning Track places ${conceptId} before prerequisite ${unmet.join(', ')}`,
      )
    }
    available.add(conceptId)
    contentVersions[conceptId] = pack.version
  }

  const track: LearningTrack = {
    id: command.trackId,
    goal: command.goal,
    conceptIds: [...command.conceptIds],
    contentVersions,
    createdAt: deps.now(),
    recordedRevision: snapshot.revision + 1,
    adjustments: [],
  }
  return {
    ...snapshot,
    activeTrackId: track.id,
    tracks: [...snapshot.tracks, track],
  }
}

function activateLearningTrack(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'activate_learning_track' }>,
  deps: Pick<CommandDependencies, 'catalog'>,
): ClassroomSnapshot {
  const track = snapshot.tracks.find(candidate => candidate.id === command.trackId)
  if (!track)
    throw new Error(`Learning Track ${command.trackId} does not exist`)
  if (snapshot.activeTrackId === track.id)
    return snapshot
  for (const conceptId of track.conceptIds) {
    const contentVersion = track.contentVersions[conceptId]
    if (!contentVersion) {
      throw new Error(
        `Learning Track ${track.id} has no Content Version for ${conceptId}`,
      )
    }
    deps.catalog.requireValidatedVersion(conceptId, contentVersion)
  }
  return {
    ...snapshot,
    activeTrackId: track.id,
  }
}

function adjustLearningTrack(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'adjust_learning_track' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const track = requireActiveTrack(snapshot, command.learningTrackId)
  if (!track.conceptIds.includes(command.adjustment.conceptId)) {
    throw new Error(
      `${command.adjustment.conceptId} is outside the active Learning Track`,
    )
  }
  const replay = track.adjustments.find((item) => {
    if (
      item.type !== command.adjustment.type
      || item.conceptId !== command.adjustment.conceptId
    ) {
      return false
    }
    if (item.type === 'accelerate' && command.adjustment.type === 'accelerate')
      return item.placementEvidenceId === command.adjustment.placementEvidenceId
    if (
      item.type === 'focused_catch_up'
      && command.adjustment.type === 'focused_catch_up'
    ) {
      return item.failureEvidenceId === command.adjustment.failureEvidenceId
    }
    if (item.type === 'review' && command.adjustment.type === 'review') {
      return item.encounteredStreamEntryId
        === command.adjustment.encounteredStreamEntryId
    }
    return item.type === 'delay'
      && command.adjustment.type === 'delay'
      && JSON.stringify(item.blockedEvidenceIds)
      === JSON.stringify(command.adjustment.blockedEvidenceIds)
  })
  if (replay) {
    const samePayload = replay.type !== 'delay'
      || (
        command.adjustment.type === 'delay'
        && replay.nextConceptId === command.adjustment.nextConceptId
      )
    if (samePayload)
      return snapshot
    throw new Error('Track Adjustment retry changed its evidence-backed payload')
  }
  const contentVersion = track.contentVersions[command.adjustment.conceptId]
  if (!contentVersion) {
    throw new Error(
      `Learning Track ${track.id} has no Content Version for ${command.adjustment.conceptId}`,
    )
  }
  deps.catalog.requireValidatedVersion(
    command.adjustment.conceptId,
    contentVersion,
  )
  const common = {
    id: deps.createId(),
    createdAt: deps.now(),
    recordedRevision: snapshot.revision + 1,
  }
  const adjustment: TrackAdjustment = command.adjustment.type === 'accelerate'
    ? {
        ...common,
        ...command.adjustment,
        decision: 'accelerate_placement_success',
      }
    : command.adjustment.type === 'focused_catch_up'
      ? {
          ...common,
          ...command.adjustment,
          decision: 'focused_catch_up_placement_failure',
        }
      : command.adjustment.type === 'review'
        ? {
            ...common,
            ...command.adjustment,
            decision: 'review_prior_encounter',
          }
        : {
            ...common,
            ...command.adjustment,
            decision: 'delay_blocked_frontier',
          }
  return {
    ...snapshot,
    tracks: snapshot.tracks.map(item => item.id === track.id
      ? { ...item, adjustments: [...item.adjustments, adjustment] }
      : item),
  }
}

function appendContentReferenceGroup(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'append_content_reference_group' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const existing = snapshot.stream.find((entry): entry is Extract<
    ClassroomSnapshot['stream'][number],
    { type: 'content_reference_group' }
  > =>
    entry.type === 'content_reference_group'
    && entry.learningTrackId === command.learningTrackId
    && entry.tutoringStepId === command.tutoringStepId)
  if (existing) {
    if (
      existing.conceptId === command.conceptId
      && existing.learningSkillId === command.learningSkillId
      && JSON.stringify(existing.blockIds) === JSON.stringify(command.blockIds)
    ) {
      return snapshot
    }
    throw new Error(
      `Tutoring Step ${command.tutoringStepId} already has a different Core Content reference group`,
    )
  }
  const pack = requireActiveConcept(
    snapshot,
    command.learningTrackId,
    command.conceptId,
    deps.catalog,
  )
  if (!pack.learningSkills.some(skill => skill.id === command.learningSkillId))
    throw new Error(`${command.learningSkillId} is not a Learning Skill for ${command.conceptId}`)

  return {
    ...snapshot,
    stream: [...snapshot.stream, {
      id: deps.createId(),
      type: 'content_reference_group',
      learningTrackId: command.learningTrackId,
      tutoringStepId: command.tutoringStepId,
      conceptId: command.conceptId,
      learningSkillId: command.learningSkillId,
      packId: pack.id,
      contentVersion: pack.version,
      blockIds: orderedBlockIds(pack, command.blockIds),
      createdAt: deps.now(),
      recordedRevision: snapshot.revision + 1,
    }],
  }
}

function appendBridgeNote(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'append_bridge_note' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const existing = snapshot.stream.find((entry): entry is Extract<
    ClassroomSnapshot['stream'][number],
    { type: 'bridge_note' }
  > =>
    entry.type === 'bridge_note'
    && entry.learningTrackId === command.learningTrackId
    && entry.tutoringStepId === command.tutoringStepId)
  if (existing) {
    if (
      existing.conceptId === command.conceptId
      && existing.markdown === command.markdown
    ) {
      return snapshot
    }
    throw new Error(
      `Tutoring Step ${command.tutoringStepId} already has a different Bridge Note`,
    )
  }
  requireActiveConcept(
    snapshot,
    command.learningTrackId,
    command.conceptId,
    deps.catalog,
  )
  const appended: ClassroomSnapshot = {
    ...snapshot,
    stream: [...snapshot.stream, {
      id: deps.createId(),
      type: 'bridge_note',
      learningTrackId: command.learningTrackId,
      tutoringStepId: command.tutoringStepId,
      conceptId: command.conceptId,
      markdown: command.markdown,
      createdAt: deps.now(),
      recordedRevision: snapshot.revision + 1,
    }],
  }
  const exposed = recordTeacherExposure(snapshot, {
    type: 'record_teacher_exposure',
    interactionId: command.teacherInteractionId,
  }, deps)
  return {
    ...appended,
    teacherExposureEpoch: exposed.teacherExposureEpoch,
  }
}

function appendSkipMarker(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'append_skip_marker' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const existing = snapshot.stream.find((entry): entry is Extract<
    ClassroomSnapshot['stream'][number],
    { type: 'skip_marker' }
  > =>
    entry.type === 'skip_marker'
    && entry.learningTrackId === command.learningTrackId
    && entry.tutoringStepId === command.tutoringStepId)
  if (existing) {
    if (
      existing.conceptId === command.conceptId
      && JSON.stringify(existing.basis) === JSON.stringify(command.basis)
      && JSON.stringify(existing.blockIds) === JSON.stringify(command.blockIds)
    ) {
      return snapshot
    }
    throw new Error(
      `Tutoring Step ${command.tutoringStepId} already has a different Skip Marker`,
    )
  }
  const track = requireActiveTrack(snapshot, command.learningTrackId)
  if (!track.conceptIds.includes(command.conceptId))
    throw new Error(`${command.conceptId} is outside the active Learning Track`)
  const contentVersion = track.contentVersions[command.conceptId]
  if (!contentVersion) {
    throw new Error(
      `Active Learning Track has no Content Version for ${command.conceptId}`,
    )
  }
  const pack = deps.catalog.requireValidatedVersion(
    command.conceptId,
    contentVersion,
  )
  assertSkipMarkerBasis(
    snapshot,
    track,
    command.conceptId,
    command.basis,
    deps.catalog,
  )
  return {
    ...snapshot,
    stream: [...snapshot.stream, {
      id: deps.createId(),
      type: 'skip_marker',
      learningTrackId: command.learningTrackId,
      tutoringStepId: command.tutoringStepId,
      conceptId: command.conceptId,
      packId: pack.id,
      contentVersion: pack.version,
      blockIds: orderedBlockIds(pack, command.blockIds),
      basis: command.basis,
      createdAt: deps.now(),
      recordedRevision: snapshot.revision + 1,
    }],
  }
}

function createExerciseInstance(
  snapshot: ClassroomSnapshot,
  command: Extract<
    ClassroomCommand,
    { type: 'create_exercise_instance' | 'create_review_check' }
  >,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const personalizationInputs = personalizationInputsSchema.parse(command.personalizationInputs)
  const existing = snapshot.stream.find((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance'
    && entry.learningTrackId === command.learningTrackId
    && entry.tutoringStepId === command.tutoringStepId)
  if (existing) {
    if (
      existing.conceptId === command.conceptId
      && existing.contentVersion === command.contentVersion
      && existing.templateId === command.templateId
      && JSON.stringify(existing.personalizationInputs) === JSON.stringify(personalizationInputs)
    ) {
      if (
        (command.type === 'create_review_check')
        !== (existing.purpose === 'review')
      ) {
        throw new Error(
          'Exercise Instance command surface contradicts the retained template purpose',
        )
      }
      return snapshot
    }
    throw new Error(
      `Tutoring Step ${command.tutoringStepId} already has a different Exercise Instance`,
    )
  }
  const track = requireActiveTrack(snapshot, command.learningTrackId)
  if (!track.conceptIds.includes(command.conceptId))
    throw new Error(`${command.conceptId} is outside the active Learning Track`)
  const trackContentVersion = track.contentVersions[command.conceptId]
  if (!trackContentVersion)
    throw new Error(`Active Learning Track has no Content Version for ${command.conceptId}`)
  const pack = deps.catalog.requireValidatedVersion(command.conceptId, command.contentVersion)
  const template = deps.catalog.requireTemplate(
    command.conceptId,
    command.templateId,
    command.contentVersion,
  )
  if (
    command.type === 'create_review_check'
    && template.purpose !== 'review'
  ) {
    throw new Error('Review Check command requires a review Exercise Template')
  }
  if (
    command.type === 'create_exercise_instance'
    && template.purpose === 'review'
  ) {
    throw new Error(
      'Review Exercise Templates require the dedicated Review Check command',
    )
  }
  if (template.purpose !== 'review' && command.contentVersion !== trackContentVersion) {
    throw new Error(
      `${template.purpose === 'placement' ? 'Placement' : 'Practice'} Exercise Instance `
      + `must use the active Learning Track Content Version ${trackContentVersion}`,
    )
  }
  assertTrackConceptAccess(
    snapshot,
    track,
    command.conceptId,
    template.purpose === 'placement' ? 'placement' : 'mainline',
    deps.catalog,
  )
  const referenceGroups = [
    [
      'unresolved failure Learning Evidence',
      personalizationInputs.unresolvedFailureEvidenceIds,
    ],
    ['Remediation', personalizationInputs.remediationArtifactIds],
  ] as const
  for (const [label, ids] of referenceGroups) {
    if (new Set(ids).size !== ids.length)
      throw new Error(`${label} Personalization Inputs cannot contain duplicate references`)
  }
  const unresolvedFailureEvidenceIds = new Set(
    deriveUnresolvedFailureEvidenceIds(snapshot, {
      conceptId: command.conceptId,
      learningSkillId: template.learningSkillId,
      learningContractVersion: pack.learningContractVersion,
    }),
  )
  for (const evidenceId of personalizationInputs.unresolvedFailureEvidenceIds) {
    if (!unresolvedFailureEvidenceIds.has(evidenceId)) {
      throw new Error(
        `Personalization Input ${evidenceId} is not current unresolved failure Learning Evidence`,
      )
    }
  }
  const remediationProvenance = createRemediationProvenanceIndex(snapshot)
  for (const artifactId of personalizationInputs.remediationArtifactIds) {
    const artifact = snapshot.reviewArtifacts.find(item => item.id === artifactId)
    const provenance = artifact?.type === 'remediation'
      ? remediationProvenance.resolve(artifact)
      : null
    if (
      !artifact
      || artifact.type !== 'remediation'
      || artifact.conceptId !== command.conceptId
      || artifact.learningSkillId !== template.learningSkillId
      || artifact.diagnosticStatus !== 'ready'
      || provenance?.conceptId !== command.conceptId
      || provenance.learningSkillId !== template.learningSkillId
      || provenance.learningContractVersion !== pack.learningContractVersion
    ) {
      throw new Error(`Personalization Input ${artifactId} is not an applicable Remediation`)
    }
  }
  const personalized = personalizeExerciseTemplate(template, personalizationInputs)
  return {
    ...snapshot,
    stream: [...snapshot.stream, {
      id: deps.createId(),
      type: 'exercise_instance',
      learningTrackId: command.learningTrackId,
      tutoringStepId: command.tutoringStepId,
      conceptId: command.conceptId,
      learningSkillId: template.learningSkillId,
      packId: pack.id,
      contentVersion: pack.version,
      learningContractVersion: pack.learningContractVersion,
      templateId: template.id,
      templateVersion: template.version,
      purpose: template.purpose,
      personalizationInputs,
      personalizationPolicyVersion: personalized.policyVersion,
      effectiveDifficulty: personalized.effectiveDifficulty,
      task: personalized.task,
      createdAt: deps.now(),
      recordedRevision: snapshot.revision + 1,
    }],
  }
}

function recordExerciseAssistance(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'record_exercise_assistance' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const instance = snapshot.stream.find((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance' && entry.id === command.exerciseInstanceId)
  if (!instance)
    throw new Error(`No Exercise Instance ${command.exerciseInstanceId}`)
  const assistance = command.assistance
  if (instance.task.type !== 'code_output') {
    throw new Error(
      'hint assistance applies only to a code-output Exercise Instance',
    )
  }
  const hintIndex = assistance.hintIndex
  if (hintIndex >= instance.task.hints.length)
    throw new Error(`Exercise Instance ${instance.id} has no hint at that index`)
  const existingHints = snapshot.assistanceEvents.filter(event =>
    event.exerciseInstanceId === instance.id)
  if (existingHints.some(event => event.hintIndex === hintIndex))
    return snapshot
  deps.catalog.requireValidatedVersion(
    instance.conceptId,
    instance.contentVersion,
  )
  if (hintIndex !== existingHints.length)
    throw new Error('Exercise hints must be revealed in Course Content Pack order')
  return {
    ...snapshot,
    assistanceEvents: [...snapshot.assistanceEvents, {
      id: deps.createId(),
      type: 'hint',
      exerciseInstanceId: instance.id,
      hintIndex,
      createdAt: deps.now(),
      recordedRevision: snapshot.revision + 1,
    }],
  }
}

function recordTeacherExposure(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'record_teacher_exposure' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  // The first learner-visible free-model output opens one workspace-global
  // exposure epoch. It intentionally survives Track/scope changes and applies
  // to future Exercise Instances; this schema has no unsafe implicit reset.
  if (snapshot.teacherExposureEpoch) {
    return snapshot
  }
  return {
    ...snapshot,
    teacherExposureEpoch: {
      id: deps.createId(),
      interactionId: command.interactionId,
      createdAt: deps.now(),
      recordedRevision: snapshot.revision + 1,
    },
  }
}

async function evaluateSubmission(
  instance: ExerciseInstance,
  command: Extract<ClassroomCommand, { type: 'record_exercise_attempt' }>,
): Promise<ExerciseAttempt['result']> {
  if (instance.task.type !== command.submission.type)
    throw new Error('Exercise Attempt submission does not match its Exercise Template')

  if (instance.task.type === 'code_output' && command.submission.type === 'code_output') {
    if (!('observation' in command))
      throw new Error('A code-output Exercise Attempt requires an observable run result')
    const run = command.observation.result
    if (run.failureKind === 'runner_unavailable')
      throw new Error('Runner unavailable; this attempt cannot produce Learning Evidence')
    if (run.phase === null)
      throw new Error('A reachable runner must identify its final phase')
    const passed = evaluateDeterministicSubmission(
      instance.task,
      command.submission,
      {
        runnerOk: run.ok,
        stdout: run.stdout,
        stdoutTruncated: run.stdoutTruncated,
      },
    )
    const outputMatched = !run.stdoutTruncated && evaluateOutput(
      run.stdout,
      instance.task.expectedOutput,
      instance.task.matchMode,
    )
    const [stdout, stderr, compilerOutput] = await Promise.all([
      summarizeAttemptDiagnostic(run.stdout, run.stdoutTruncated),
      summarizeAttemptDiagnostic(run.stderr, run.stderrTruncated),
      summarizeAttemptDiagnostic(
        run.compilerOutput,
        run.compilerOutputTruncated,
      ),
    ])
    return {
      passed,
      runnerOk: run.ok,
      phase: run.phase,
      stdout,
      stderr,
      compilerOutput,
      outputEvaluation: {
        matched: outputMatched,
        stdoutSha256: stdout.sha256,
        stdoutSourceTruncated: stdout.sourceTruncated,
      },
      exitCode: run.exitCode,
    }
  }

  if (instance.task.type === 'recall' && command.submission.type === 'recall') {
    return {
      passed: evaluateDeterministicSubmission(instance.task, command.submission),
    }
  }

  if (instance.task.type === 'quiz' && command.submission.type === 'quiz') {
    return {
      passed: evaluateDeterministicSubmission(instance.task, command.submission),
    }
  }

  throw new Error('Exercise Attempt submission does not match its Exercise Template')
}

async function recordExerciseAttempt(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'record_exercise_attempt' }>,
  deps: CommandDependencies,
): Promise<ClassroomSnapshot> {
  const instance = snapshot.stream.find((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance' && entry.id === command.exerciseInstanceId)
  if (!instance)
    throw new Error(`No Exercise Instance ${command.exerciseInstanceId}`)

  const evaluatedResult = await evaluateSubmission(instance, command)
  const existingAttempt = snapshot.attempts.find(attempt => attempt.id === command.attemptId)
  if (existingAttempt) {
    if (
      existingAttempt.exerciseInstanceId === command.exerciseInstanceId
      && JSON.stringify(existingAttempt.submission) === JSON.stringify(command.submission)
      && JSON.stringify(existingAttempt.result) === JSON.stringify(evaluatedResult)
    ) {
      return snapshot
    }
    throw new Error(`Exercise Attempt id ${command.attemptId} is already in use`)
  }
  deps.catalog.requireValidatedVersion(
    instance.conceptId,
    instance.contentVersion,
  )

  const createdAt = deps.now()
  const recordedRevision = snapshot.revision + 1
  const assessmentHistory = createAssessmentHistoryIndex(snapshot)
  const assistanceEvents = assessmentHistory.applicableAssistance(
    instance,
    recordedRevision,
  )
  const teacherExposureEpochId
    = snapshot.teacherExposureEpoch
      && snapshot.teacherExposureEpoch.recordedRevision < recordedRevision
      ? snapshot.teacherExposureEpoch.id
      : null
  const assistance = deriveAttemptAssistance(
    assistanceEvents,
    teacherExposureEpochId !== null,
  )
  const attempt: ExerciseAttempt = {
    id: command.attemptId,
    exerciseInstanceId: instance.id,
    assistanceEventIds: assistanceEvents.map(event => event.id),
    teacherExposureEpochId,
    submission: command.submission,
    result: evaluatedResult,
    assistance,
    createdAt,
    recordedRevision,
  }
  const evidenceType = assessmentHistory.expectedEvidenceType(instance, attempt)
  const evidenceId = deps.createId()
  const evidence = {
    id: evidenceId,
    type: evidenceType,
    outcome: attempt.result.passed ? 'success' as const : 'failure' as const,
    conceptId: instance.conceptId,
    learningSkillId: instance.learningSkillId,
    contentVersion: instance.contentVersion,
    learningContractVersion: instance.learningContractVersion,
    templateId: instance.templateId,
    templateVersion: instance.templateVersion,
    exerciseInstanceId: instance.id,
    attemptId: attempt.id,
    createdAt,
  }
  if (attempt.result.passed) {
    return {
      ...snapshot,
      attempts: [...snapshot.attempts, attempt],
      evidence: [...snapshot.evidence, evidence],
    }
  }

  const remediationId = deps.createId()
  const retentionMarkerId = deps.createId()
  return {
    ...snapshot,
    attempts: [...snapshot.attempts, attempt],
    evidence: [...snapshot.evidence, evidence],
    reviewArtifacts: [...snapshot.reviewArtifacts, {
      id: remediationId,
      type: 'remediation',
      conceptId: instance.conceptId,
      learningSkillId: instance.learningSkillId,
      diagnosticStatus: 'pending',
      diagnosticAttempts: 0,
      diagnosticFailure: null,
      nextDiagnosticAttemptAt: null,
      diagnosticClaim: null,
      misconceptionTheme: null,
      markdown: null,
      attemptIds: [attempt.id],
      evidenceIds: [evidenceId],
      createdAt,
      updatedAt: createdAt,
      createdRevision: recordedRevision,
      updatedRevision: recordedRevision,
    }],
    stream: [...snapshot.stream, {
      id: retentionMarkerId,
      type: 'retention_marker',
      learningTrackId: instance.learningTrackId,
      conceptId: instance.conceptId,
      artifactId: remediationId,
      artifactType: 'remediation',
      request: null,
      createdAt,
      recordedRevision,
    }],
  }
}

function retainClarification(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'retain_clarification' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  if (command.learningTrackId !== null) {
    const track = requireActiveTrack(snapshot, command.learningTrackId)
    if (!track.conceptIds.includes(command.conceptId))
      throw new Error(`${command.conceptId} is outside Learning Track ${track.id}`)
    const pinnedVersion = track.contentVersions[command.conceptId]
    if (command.contentVersion !== pinnedVersion) {
      throw new Error(
        `Live Track Concept ${command.conceptId} must use Content Version ${pinnedVersion}`,
      )
    }
  }
  const pack = deps.catalog.getVersion(command.conceptId, command.contentVersion)
  const availability = deps.catalog.availability(command.conceptId, command.contentVersion)
  if (!pack || !availability)
    throw new Error('Out-of-Pack Help cannot create a retained Review Artifact')
  if (snapshot.removedReviewArtifacts.some(artifact => artifact.id === command.artifactId))
    throw new Error(`Removed Review Artifact id ${command.artifactId} cannot be reused`)
  const suppressionKey = clarificationSuppressionKey(
    command.conceptId,
    command.contentVersion,
    command.misconceptionTheme,
  )
  if (snapshot.removedReviewArtifacts.some(artifact =>
    artifact.type === 'clarification'
    && artifact.suppressionActive
    && artifact.suppressionKey === suppressionKey)) {
    throw new Error('Clarification retention is suppressed for this misconception topic')
  }
  const request = retentionRequestFor(command)
  if (isCommittedRetentionRequest(snapshot, request))
    return snapshot

  const existing = snapshot.reviewArtifacts.find(
    (artifact): artifact is Extract<
      ClassroomSnapshot['reviewArtifacts'][number],
      { type: 'clarification' }
    > => artifact.type === 'clarification'
      && clarificationReviewGroupKey(
        artifact.conceptId,
        artifact.contentVersion,
        artifact.misconceptionTheme,
      ) === clarificationReviewGroupKey(
        command.conceptId,
        command.contentVersion,
        command.misconceptionTheme,
      ),
  )
  const artifactId = existing?.id ?? command.artifactId
  const updatedAt = deps.now()
  const updatedRevision = snapshot.revision + 1
  const artifact = {
    id: artifactId,
    type: 'clarification' as const,
    conceptId: command.conceptId,
    contentVersion: command.contentVersion,
    misconceptionTheme: command.misconceptionTheme,
    markdown: command.markdown,
    // Updating a version-exact group must preserve how it entered history,
    // even if external review availability changed in the meantime.
    retainedAsReadOnly:
      existing?.retainedAsReadOnly ?? availability === 'read_only',
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
    createdRevision: existing?.createdRevision ?? updatedRevision,
    updatedRevision,
  }
  return {
    ...snapshot,
    reviewArtifacts: existing
      ? snapshot.reviewArtifacts.map(item => item.id === existing.id ? artifact : item)
      : [...snapshot.reviewArtifacts, artifact],
    stream: [...snapshot.stream, {
      // A merged request does not create the requested Artifact identity, so
      // use that stable token as its receipt instead of consuming a new id.
      id: existing ? command.artifactId : deps.createId(),
      type: 'retention_marker',
      learningTrackId: command.learningTrackId,
      conceptId: command.conceptId,
      artifactId,
      artifactType: 'clarification',
      request,
      createdAt: updatedAt,
      recordedRevision: snapshot.revision + 1,
    }],
  }
}

function retainRemediation(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'retain_remediation' }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const failedAttempt = snapshot.attempts.find(attempt =>
    attempt.id === command.failedAttemptId && !attempt.result.passed)
  if (!failedAttempt)
    throw new Error(`Remediation requires a failed Exercise Attempt ${command.failedAttemptId}`)
  const instance = snapshot.stream.find((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance' && entry.id === failedAttempt.exerciseInstanceId)
  if (!instance)
    throw new Error(`Failed Exercise Attempt ${failedAttempt.id} has no Exercise Instance`)
  const failureEvidence = snapshot.evidence.filter(item =>
    item.attemptId === failedAttempt.id
    && item.exerciseInstanceId === instance.id
    && item.outcome === 'failure')
  if (failureEvidence.length === 0)
    throw new Error(`Failed Exercise Attempt ${failedAttempt.id} has no failure Learning Evidence`)
  const suppressionKey = remediationSuppressionKey(
    instance.conceptId,
    instance.learningSkillId,
    [failedAttempt.id],
  )
  if (snapshot.removedReviewArtifacts.some(artifact =>
    artifact.type === 'remediation'
    && artifact.suppressionActive
    && artifact.suppressionKey === suppressionKey)) {
    throw new Error('Remediation retention is suppressed for this failed-attempt topic')
  }
  if (snapshot.removedReviewArtifacts.some(artifact => artifact.id === command.artifactId))
    throw new Error(`Removed Review Artifact id ${command.artifactId} cannot be reused`)
  const request = retentionRequestFor(command)
  if (isCommittedRetentionRequest(snapshot, request))
    return snapshot
  deps.catalog.requireValidatedVersion(
    instance.conceptId,
    instance.contentVersion,
  )

  const automaticShell = snapshot.reviewArtifacts.find((artifact): artifact is Extract<
    ClassroomSnapshot['reviewArtifacts'][number],
    { type: 'remediation' }
  > =>
    artifact.type === 'remediation'
    && artifact.attemptIds.includes(failedAttempt.id))
  if (automaticShell) {
    if (command.diagnosticClaim) {
      const activeClaim = automaticShell.diagnosticClaim
      if (
        !activeClaim
        || activeClaim.ownerNonce !== command.diagnosticClaim.ownerNonce
        || !isSameRemediationDiagnosticJob(
          activeClaim.job,
          command.diagnosticClaim.job,
        )
      ) {
        return snapshot
      }
    }
    else if (automaticShell.diagnosticClaim) {
      throw new Error(
        'A claimed Remediation diagnostic requires its exact claim authority',
      )
    }
    if (automaticShell.diagnosticStatus === 'ready') {
      if (
        automaticShell.misconceptionTheme !== command.misconceptionTheme
        || automaticShell.markdown !== command.markdown
      ) {
        throw new Error(
          `Remediation for ${failedAttempt.id} is already complete with different content`,
        )
      }
    }
    const updatedAt = deps.now()
    return {
      ...snapshot,
      reviewArtifacts: snapshot.reviewArtifacts.map(artifact =>
        artifact.id === automaticShell.id
          ? {
              ...automaticShell,
              ...(automaticShell.diagnosticStatus === 'ready'
                ? {}
                : {
                    diagnosticStatus: 'ready' as const,
                    diagnosticFailure: null,
                    nextDiagnosticAttemptAt: null,
                    diagnosticClaim: null,
                    misconceptionTheme: command.misconceptionTheme,
                    markdown: command.markdown,
                  }),
              evidenceIds: [...new Set([
                ...automaticShell.evidenceIds,
                ...failureEvidence.map(item => item.id),
              ])],
              updatedAt,
              updatedRevision: snapshot.revision + 1,
            }
          : artifact),
      stream: [...snapshot.stream, {
        // The automatic shell already owns its Artifact id. The command's
        // token is therefore free to identify this durable request receipt.
        id: command.artifactId,
        type: 'retention_marker',
        learningTrackId: instance.learningTrackId,
        conceptId: instance.conceptId,
        artifactId: automaticShell.id,
        artifactType: 'remediation',
        request,
        createdAt: updatedAt,
        recordedRevision: snapshot.revision + 1,
      }],
    }
  }

  const updatedAt = deps.now()
  const artifact = {
    id: command.artifactId,
    type: 'remediation' as const,
    conceptId: instance.conceptId,
    learningSkillId: instance.learningSkillId,
    diagnosticStatus: 'ready' as const,
    diagnosticAttempts: 0,
    diagnosticFailure: null,
    nextDiagnosticAttemptAt: null,
    diagnosticClaim: null,
    misconceptionTheme: command.misconceptionTheme,
    markdown: command.markdown,
    attemptIds: [failedAttempt.id],
    evidenceIds: failureEvidence.map(item => item.id),
    createdAt: updatedAt,
    updatedAt,
    createdRevision: snapshot.revision + 1,
    updatedRevision: snapshot.revision + 1,
  }
  return {
    ...snapshot,
    reviewArtifacts: [...snapshot.reviewArtifacts, artifact],
    stream: [...snapshot.stream, {
      id: deps.createId(),
      type: 'retention_marker',
      learningTrackId: instance.learningTrackId,
      conceptId: instance.conceptId,
      artifactId: artifact.id,
      artifactType: 'remediation',
      request,
      createdAt: updatedAt,
      recordedRevision: snapshot.revision + 1,
    }],
  }
}

const REMEDIATION_DIAGNOSTIC_RETRY_BASE_MS = 5_000

function isSameRemediationDiagnosticJob(
  left: {
    artifactId: string
    failedAttemptId: string
    diagnosticAttempt: number
  },
  right: {
    artifactId: string
    failedAttemptId: string
    diagnosticAttempt: number
  },
): boolean {
  return left.artifactId === right.artifactId
    && left.failedAttemptId === right.failedAttemptId
    && left.diagnosticAttempt === right.diagnosticAttempt
}

function claimRemediationDiagnostic(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, {
    type: 'claim_remediation_diagnostic'
  }>,
  deps: Pick<CommandDependencies, 'catalog' | 'now'>,
): ClassroomSnapshot {
  const artifact = snapshot.reviewArtifacts.find((candidate): candidate is Extract<
    ClassroomSnapshot['reviewArtifacts'][number],
    { type: 'remediation' }
  > =>
    candidate.type === 'remediation'
    && candidate.id === command.job.artifactId
    && candidate.attemptIds[0] === command.job.failedAttemptId)
  if (!artifact || artifact.diagnosticStatus !== 'pending')
    return snapshot
  if (command.job.diagnosticAttempt !== artifact.diagnosticAttempts + 1)
    return snapshot
  const failedAttempt = snapshot.attempts.find(
    attempt => attempt.id === command.job.failedAttemptId,
  )
  const instance = failedAttempt
    ? snapshot.stream.find((entry): entry is ExerciseInstance =>
        entry.type === 'exercise_instance'
        && entry.id === failedAttempt.exerciseInstanceId)
    : undefined
  if (
    !instance
    || deps.catalog.availability(
      instance.conceptId,
      instance.contentVersion,
    ) !== 'validated'
  ) {
    return snapshot
  }

  // `observedAt` is the coordinator's monotonic causal time. The aggregate
  // floors it against durable state via `deps.now()` so timestamps never move
  // backwards. `expiresAt` is only a stale-warning threshold: elapsed time can
  // never prove that an arbitrary provider request has settled, so an existing
  // claim remains exclusive until its owner releases it or the learner
  // explicitly accepts manual recovery.
  const claimedAt = Math.max(deps.now(), command.observedAt)
  if (
    artifact.nextDiagnosticAttemptAt !== null
    && artifact.nextDiagnosticAttemptAt > claimedAt
  ) {
    return snapshot
  }
  const existing = artifact.diagnosticClaim
  if (existing)
    return snapshot

  return {
    ...snapshot,
    reviewArtifacts: snapshot.reviewArtifacts.map(candidate =>
      candidate.id === artifact.id
        ? {
            ...artifact,
            diagnosticClaim: {
              job: command.job,
              ownerNonce: command.ownerNonce,
              claimedAt,
              expiresAt:
                claimedAt + REMEDIATION_DIAGNOSTIC_STALE_AFTER_MS,
            },
            updatedAt: claimedAt,
            updatedRevision: snapshot.revision + 1,
          }
        : candidate),
  }
}

function recoverPotentiallyAbandonedRemediationDiagnosticClaim(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, {
    type: 'recover_potentially_abandoned_remediation_diagnostic_claim'
  }>,
  deps: Pick<CommandDependencies, 'now'>,
): ClassroomSnapshot {
  const artifact = snapshot.reviewArtifacts.find((candidate): candidate is Extract<
    ClassroomSnapshot['reviewArtifacts'][number],
    { type: 'remediation' }
  > =>
    candidate.type === 'remediation'
    && candidate.id === command.artifactId)
  if (!artifact)
    throw new Error(`No Remediation ${command.artifactId}`)
  if (artifact.diagnosticStatus !== 'pending' || !artifact.diagnosticClaim) {
    throw new Error(
      'Only a pending Remediation with a persisted claim can be recovered',
    )
  }

  const recoveredAt = Math.max(deps.now(), command.observedAt)
  if (!isRemediationDiagnosticClaimPotentiallyAbandoned(
    artifact.diagnosticClaim,
    recoveredAt,
  )) {
    throw new Error(
      'This Remediation diagnostic claim is not yet marked potentially abandoned',
    )
  }

  return {
    ...snapshot,
    reviewArtifacts: snapshot.reviewArtifacts.map(candidate =>
      candidate.id === artifact.id
        ? {
            ...artifact,
            diagnosticClaim: null,
            updatedAt: recoveredAt,
            updatedRevision: snapshot.revision + 1,
          }
        : candidate),
  }
}

function releaseRemediationDiagnosticClaim(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, {
    type: 'release_remediation_diagnostic_claim'
  }>,
  deps: Pick<CommandDependencies, 'now'>,
): ClassroomSnapshot {
  const artifact = snapshot.reviewArtifacts.find((candidate): candidate is Extract<
    ClassroomSnapshot['reviewArtifacts'][number],
    { type: 'remediation' }
  > =>
    candidate.type === 'remediation'
    && candidate.id === command.job.artifactId
    && candidate.attemptIds[0] === command.job.failedAttemptId)
  const claim = artifact?.diagnosticClaim
  if (
    !artifact
    || artifact.diagnosticStatus !== 'pending'
    || !claim
    || claim.ownerNonce !== command.ownerNonce
    || !isSameRemediationDiagnosticJob(claim.job, command.job)
  ) {
    return snapshot
  }

  const updatedAt = deps.now()
  return {
    ...snapshot,
    reviewArtifacts: snapshot.reviewArtifacts.map(candidate =>
      candidate.id === artifact.id
        ? {
            ...artifact,
            diagnosticClaim: null,
            updatedAt,
            updatedRevision: snapshot.revision + 1,
          }
        : candidate),
  }
}

function recordRemediationDiagnosticFailure(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, {
    type: 'record_remediation_diagnostic_failure'
  }>,
  deps: CommandDependencies,
): ClassroomSnapshot {
  const artifact = snapshot.reviewArtifacts.find((candidate): candidate is Extract<
    ClassroomSnapshot['reviewArtifacts'][number],
    { type: 'remediation' }
  > =>
    candidate.type === 'remediation'
    && candidate.attemptIds.includes(command.failedAttemptId))
  if (!artifact)
    throw new Error(`No pending Remediation for ${command.failedAttemptId}`)
  if (artifact.diagnosticStatus === 'ready')
    return snapshot
  if (command.diagnosticClaim) {
    const activeClaim = artifact.diagnosticClaim
    if (
      !activeClaim
      || activeClaim.ownerNonce !== command.diagnosticClaim.ownerNonce
      || !isSameRemediationDiagnosticJob(
        activeClaim.job,
        command.diagnosticClaim.job,
      )
    ) {
      return snapshot
    }
  }
  else if (artifact.diagnosticClaim) {
    throw new Error(
      'A claimed Remediation diagnostic failure requires its exact claim authority',
    )
  }
  if (command.diagnosticAttempt < artifact.diagnosticAttempts)
    return snapshot
  if (command.diagnosticAttempt === artifact.diagnosticAttempts) {
    if (command.failure === artifact.diagnosticFailure)
      return snapshot
    throw new Error(
      `Remediation diagnostic attempt ${command.diagnosticAttempt} was already recorded with a different failure`,
    )
  }
  if (command.diagnosticAttempt !== artifact.diagnosticAttempts + 1) {
    throw new Error(
      `Remediation diagnostic attempt must advance from ${artifact.diagnosticAttempts}`,
    )
  }
  if (
    command.failure === 'context_too_large'
    && command.diagnosticAttempt !== 1
  ) {
    throw new Error(
      'An oversized Remediation context must fail closed on the first diagnostic attempt',
    )
  }

  const updatedAt = deps.now()
  const exhausted
    = command.failure === 'context_too_large'
      || command.diagnosticAttempt >= MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS
  return {
    ...snapshot,
    reviewArtifacts: snapshot.reviewArtifacts.map(candidate =>
      candidate.id === artifact.id
        ? {
            ...artifact,
            diagnosticStatus: exhausted ? 'failed' as const : 'pending' as const,
            diagnosticAttempts: command.diagnosticAttempt,
            diagnosticFailure: command.failure,
            diagnosticClaim: null,
            nextDiagnosticAttemptAt: exhausted
              ? null
              : updatedAt + (
                REMEDIATION_DIAGNOSTIC_RETRY_BASE_MS
                * 2 ** (command.diagnosticAttempt - 1)
              ),
            updatedAt,
            updatedRevision: snapshot.revision + 1,
          }
        : candidate),
  }
}

function retryRemediationDiagnostic(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, {
    type: 'retry_remediation_diagnostic'
  }>,
  deps: Pick<CommandDependencies, 'catalog' | 'now'>,
): ClassroomSnapshot {
  const artifact = snapshot.reviewArtifacts.find((candidate): candidate is Extract<
    ClassroomSnapshot['reviewArtifacts'][number],
    { type: 'remediation' }
  > =>
    candidate.type === 'remediation'
    && candidate.id === command.artifactId)
  if (!artifact)
    throw new Error(`No Remediation ${command.artifactId}`)
  if (artifact.diagnosticClaim) {
    throw new Error(
      'A persisted diagnostic claim requires manual recovery with explicit acknowledgement of the duplicate provider-call risk',
    )
  }
  if (
    artifact.diagnosticStatus === 'pending'
    && artifact.diagnosticAttempts === 0
    && artifact.diagnosticFailure === null
    && artifact.nextDiagnosticAttemptAt === null
  ) {
    return snapshot
  }
  if (artifact.diagnosticStatus !== 'failed')
    throw new Error('Only a failed Remediation diagnostic can be retried')
  if (artifact.diagnosticFailure === 'context_too_large') {
    throw new Error(
      'An oversized immutable Attempt cannot be retried as an automated diagnostic',
    )
  }
  const failedAttempt = snapshot.attempts.find(
    attempt => attempt.id === artifact.attemptIds[0] && !attempt.result.passed,
  )
  const instance = failedAttempt
    ? snapshot.stream.find((entry): entry is ExerciseInstance =>
        entry.type === 'exercise_instance'
        && entry.id === failedAttempt.exerciseInstanceId)
    : undefined
  if (!instance) {
    throw new Error(
      `Remediation ${artifact.id} has no failed Exercise Instance provenance`,
    )
  }
  deps.catalog.requireValidatedVersion(
    instance.conceptId,
    instance.contentVersion,
  )

  const updatedAt = deps.now()
  return {
    ...snapshot,
    reviewArtifacts: snapshot.reviewArtifacts.map(candidate =>
      candidate.id === artifact.id
        ? {
            ...artifact,
            diagnosticStatus: 'pending' as const,
            diagnosticAttempts: 0,
            diagnosticFailure: null,
            nextDiagnosticAttemptAt: null,
            updatedAt,
            updatedRevision: snapshot.revision + 1,
          }
        : candidate),
  }
}

function removeReviewArtifact(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'remove_review_artifact' }>,
  deps: Pick<CommandDependencies, 'now'>,
): ClassroomSnapshot {
  const artifact = snapshot.reviewArtifacts.find(item => item.id === command.artifactId)
  if (!artifact)
    return snapshot
  const removedAt = deps.now()
  const remediationProvenance = createRemediationProvenanceIndex(snapshot)
  const selectedRemediationContract = artifact.type === 'remediation'
    ? remediationProvenance.resolve(artifact)?.learningContractVersion ?? null
    : null
  const artifactsToRemove = artifact.type === 'remediation'
    && artifact.diagnosticStatus === 'ready'
    && artifact.misconceptionTheme !== null
    && selectedRemediationContract !== null
    ? snapshot.reviewArtifacts.filter((candidate) => {
        return candidate.type === 'remediation'
          && candidate.diagnosticStatus === 'ready'
          && candidate.misconceptionTheme !== null
          && remediationReviewGroupKey(
            candidate.conceptId,
            candidate.learningSkillId,
            candidate.misconceptionTheme,
          ) === remediationReviewGroupKey(
            artifact.conceptId,
            artifact.learningSkillId,
            artifact.misconceptionTheme!,
          )
          && remediationProvenance.resolve(candidate)
            ?.learningContractVersion === selectedRemediationContract
      })
    : [artifact]
  const removedIds = new Set(artifactsToRemove.map(item => item.id))
  const tombstones = artifactsToRemove.map(item => item.type === 'clarification'
    ? {
        id: item.id,
        type: item.type,
        conceptId: item.conceptId,
        misconceptionTheme: item.misconceptionTheme,
        suppressionKey: clarificationSuppressionKey(
          item.conceptId,
          item.contentVersion,
          item.misconceptionTheme,
        ),
        suppressionActive: true,
        contentVersion: item.contentVersion,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        createdRevision: item.createdRevision,
        updatedRevision: item.updatedRevision,
        removedAt,
        removedRevision: snapshot.revision + 1,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      } as const
    : {
        id: item.id,
        type: item.type,
        conceptId: item.conceptId,
        learningSkillId: item.learningSkillId,
        misconceptionTheme: item.misconceptionTheme,
        suppressionKey: remediationSuppressionKey(
          item.conceptId,
          item.learningSkillId,
          item.attemptIds,
        ),
        suppressionActive: true,
        attemptIds: item.attemptIds,
        evidenceIds: item.evidenceIds,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        createdRevision: item.createdRevision,
        updatedRevision: item.updatedRevision,
        removedAt,
        removedRevision: snapshot.revision + 1,
        retentionAllowedAt: null,
        retentionAllowedRevision: null,
      } as const)
  return {
    ...snapshot,
    reviewArtifacts: snapshot.reviewArtifacts.filter(item => !removedIds.has(item.id)),
    removedReviewArtifacts: [...snapshot.removedReviewArtifacts, ...tombstones],
  }
}

function allowReviewArtifactRetention(
  snapshot: ClassroomSnapshot,
  command: Extract<ClassroomCommand, { type: 'allow_review_artifact_retention' }>,
  deps: Pick<CommandDependencies, 'createId' | 'now'>,
): ClassroomSnapshot {
  const removed = snapshot.removedReviewArtifacts.find(
    artifact => artifact.id === command.artifactId,
  )
  if (!removed || !removed.suppressionActive)
    return snapshot
  const allowedAt = deps.now()
  const nextRevision = snapshot.revision + 1
  const removedReviewArtifacts = snapshot.removedReviewArtifacts.map(artifact =>
    artifact.id === removed.id
      ? {
          ...artifact,
          suppressionActive: false,
          retentionAllowedAt: allowedAt,
          retentionAllowedRevision: nextRevision,
        }
      : artifact)
  if (removed.type === 'clarification') {
    return {
      ...snapshot,
      removedReviewArtifacts,
    }
  }

  const attempt = snapshot.attempts.find(candidate =>
    candidate.id === removed.attemptIds[0] && !candidate.result.passed)
  const instance = attempt
    ? snapshot.stream.find((entry): entry is ExerciseInstance =>
        entry.type === 'exercise_instance'
        && entry.id === attempt.exerciseInstanceId)
    : undefined
  if (
    !attempt
    || !instance
    || instance.conceptId !== removed.conceptId
    || instance.learningSkillId !== removed.learningSkillId
  ) {
    throw new Error(
      `Removed Remediation ${removed.id} has no restorable failed-attempt provenance`,
    )
  }
  if (snapshot.reviewArtifacts.some(artifact =>
    artifact.type === 'remediation'
    && artifact.attemptIds.includes(attempt.id))) {
    throw new Error(
      `Failed Exercise Attempt ${attempt.id} already has an active Remediation`,
    )
  }
  const artifactId = deps.createId()
  const retentionMarkerId = deps.createId()
  const knownIds = new Set([
    ...snapshot.stream.map(entry => entry.id),
    ...snapshot.reviewArtifacts.map(artifact => artifact.id),
    ...snapshot.removedReviewArtifacts.map(artifact => artifact.id),
  ])
  if (
    artifactId === retentionMarkerId
    || knownIds.has(artifactId)
    || knownIds.has(retentionMarkerId)
  ) {
    throw new Error('Restored Remediation identities must be new')
  }
  return {
    ...snapshot,
    removedReviewArtifacts,
    reviewArtifacts: [...snapshot.reviewArtifacts, {
      id: artifactId,
      type: 'remediation',
      conceptId: removed.conceptId,
      learningSkillId: removed.learningSkillId,
      diagnosticStatus: 'pending',
      diagnosticAttempts: 0,
      diagnosticFailure: null,
      nextDiagnosticAttemptAt: null,
      diagnosticClaim: null,
      misconceptionTheme: null,
      markdown: null,
      attemptIds: [...removed.attemptIds],
      evidenceIds: [...removed.evidenceIds],
      createdAt: allowedAt,
      updatedAt: allowedAt,
      createdRevision: nextRevision,
      updatedRevision: nextRevision,
    }],
    stream: [...snapshot.stream, {
      id: retentionMarkerId,
      type: 'retention_marker',
      learningTrackId: instance.learningTrackId,
      conceptId: removed.conceptId,
      artifactId,
      artifactType: 'remediation',
      request: null,
      createdAt: allowedAt,
      recordedRevision: nextRevision,
    }],
  }
}

async function reduceCommand(
  snapshot: ClassroomSnapshot,
  command: ClassroomCommand,
  deps: CommandDependencies,
): Promise<ClassroomSnapshot> {
  switch (command.type) {
    case 'start_learning_track':
      return startLearningTrack(snapshot, command, deps)
    case 'activate_learning_track':
      return activateLearningTrack(snapshot, command, deps)
    case 'adjust_learning_track':
      return adjustLearningTrack(snapshot, command, deps)
    case 'append_content_reference_group':
      return appendContentReferenceGroup(snapshot, command, deps)
    case 'append_bridge_note':
      return appendBridgeNote(snapshot, command, deps)
    case 'append_skip_marker':
      return appendSkipMarker(snapshot, command, deps)
    case 'create_exercise_instance':
    case 'create_review_check':
      return createExerciseInstance(snapshot, command, deps)
    case 'record_exercise_assistance':
      return recordExerciseAssistance(snapshot, command, deps)
    case 'record_teacher_exposure':
      return recordTeacherExposure(snapshot, command, deps)
    case 'record_exercise_attempt':
      return recordExerciseAttempt(snapshot, command, deps)
    case 'retain_clarification':
      return retainClarification(snapshot, command, deps)
    case 'retain_remediation':
      return retainRemediation(snapshot, command, deps)
    case 'claim_remediation_diagnostic':
      return claimRemediationDiagnostic(snapshot, command, deps)
    case 'recover_potentially_abandoned_remediation_diagnostic_claim':
      return recoverPotentiallyAbandonedRemediationDiagnosticClaim(
        snapshot,
        command,
        deps,
      )
    case 'release_remediation_diagnostic_claim':
      return releaseRemediationDiagnosticClaim(snapshot, command, deps)
    case 'record_remediation_diagnostic_failure':
      return recordRemediationDiagnosticFailure(snapshot, command, deps)
    case 'retry_remediation_diagnostic':
      return retryRemediationDiagnostic(snapshot, command, deps)
    case 'remove_review_artifact':
      return removeReviewArtifact(snapshot, command, deps)
    case 'allow_review_artifact_retention':
      return allowReviewArtifactRetention(snapshot, command, deps)
  }
}

const MAX_CONFLICT_RETRIES = 4

function latestCausalTimestamp(snapshot: ClassroomSnapshot): number {
  let latest = 0
  const include = (timestamp: number) => {
    latest = Math.max(latest, timestamp)
  }
  for (const track of snapshot.tracks) {
    include(track.createdAt)
    for (const adjustment of track.adjustments)
      include(adjustment.createdAt)
  }
  for (const entry of snapshot.stream)
    include(entry.createdAt)
  for (const event of snapshot.assistanceEvents)
    include(event.createdAt)
  if (snapshot.teacherExposureEpoch)
    include(snapshot.teacherExposureEpoch.createdAt)
  for (const attempt of snapshot.attempts)
    include(attempt.createdAt)
  for (const evidence of snapshot.evidence)
    include(evidence.createdAt)
  for (const artifact of snapshot.reviewArtifacts) {
    include(artifact.createdAt)
    include(artifact.updatedAt)
  }
  for (const artifact of snapshot.removedReviewArtifacts) {
    include(artifact.createdAt)
    include(artifact.updatedAt)
    include(artifact.removedAt)
    if (artifact.retentionAllowedAt !== null)
      include(artifact.retentionAllowedAt)
  }
  return latest
}

function causalTimestamp(snapshot: ClassroomSnapshot, wallClock: number): number {
  if (!Number.isSafeInteger(wallClock) || wallClock < 0)
    throw new RangeError('AI Classroom clock must return a non-negative safe integer')
  return Math.max(wallClock, latestCausalTimestamp(snapshot))
}

/**
 * Deep AI Classroom module. Callers submit domain commands; runtime validation,
 * provenance, optimistic concurrency, persistence, and publication stay inside.
 */
export function createAIClassroom(deps: AIClassroomDependencies): AIClassroom {
  const now = deps.now ?? Date.now
  const sourceCreateId = deps.createId ?? defaultCreateId
  let current: ClassroomSnapshot | null = null
  let opening: Promise<ClassroomSnapshot> | null = null
  let writeTail: Promise<unknown> = Promise.resolve()
  let unsubscribeStorage: (() => void) | null = null
  let disposed = false
  let disposal: Promise<void> | null = null
  const listeners = new Set<() => void>()

  function requireCurrent(): ClassroomSnapshot {
    if (!current)
      throw new Error('AI Classroom has not been opened')
    return current
  }

  function snapshot(): ClassroomSnapshot {
    return structuredClone(requireCurrent())
  }

  function reportAsyncError(error: unknown): void {
    if (deps.onStorageError) {
      deps.onStorageError(error)
      return
    }
    queueMicrotask(() => {
      throw error
    })
  }

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener()
      }
      catch (error) {
        reportAsyncError(error)
      }
    }
  }

  async function parseStored(
    stored: unknown | null,
  ): Promise<ClassroomSnapshot> {
    const parsed = stored == null
      ? createEmptyClassroom()
      : classroomSnapshotSchema.parse(stored)
    await assertClassroomDiagnosticIntegrity(parsed)
    assertClassroomIntegrity(parsed, deps.catalog)
    return parsed
  }

  async function reloadCommitted(notifyChange: boolean): Promise<ClassroomSnapshot> {
    const loaded = await parseStored(await deps.storage.load())
    const changed = current == null || loaded.revision !== current.revision
    current = loaded
    if (notifyChange && changed)
      notify()
    return loaded
  }

  function observeExternalWrites(): void {
    if (disposed || unsubscribeStorage || !deps.storage.subscribe)
      return
    unsubscribeStorage = deps.storage.subscribe((revision) => {
      if (disposed || !current || revision <= current.revision)
        return
      const refresh = writeTail.then(async () => {
        if (!current || revision <= current.revision)
          return
        await reloadCommitted(true)
      })
      writeTail = refresh.then(
        () => undefined,
        () => undefined,
      )
      void refresh.catch(reportAsyncError)
    })
  }

  async function open(): Promise<ClassroomSnapshot> {
    if (disposed)
      throw new Error('AI Classroom has been disposed')
    if (current)
      return snapshot()
    opening ??= reloadCommitted(false).then((loaded) => {
      if (disposed)
        throw new Error('AI Classroom has been disposed')
      observeExternalWrites()
      return structuredClone(loaded)
    }).catch((error) => {
      opening = null
      throw error
    })
    return opening
  }

  function execute(
    input: ClassroomCommand,
    options: AIClassroomExecutionOptions = {},
  ): Promise<ClassroomSnapshot> {
    if (disposed)
      throw new Error('AI Classroom has been disposed')
    const commitGuard = options.commitGuard
    const run = writeTail.then(async () => {
      if (disposed)
        throw new Error('AI Classroom has been disposed')
      if (!current)
        await open()
      if (disposed)
        throw new Error('AI Classroom has been disposed')
      const command = classroomCommandSchema.parse(input)
      // A suspended tab can miss a revision notification. Claim acquisition
      // must read the durable owner before deciding that a stable job is
      // ineligible; otherwise a stale no-op would never reach the CAS path.
      if (command.type === 'claim_remediation_diagnostic')
        await reloadCommitted(true)
      const wallClockTimestamp = now()
      const generatedIds: string[] = []

      for (let retry = 0; retry <= MAX_CONFLICT_RETRIES; retry++) {
        commitGuard?.assertActive()
        const base = requireCurrent()
        const commandTimestamp = causalTimestamp(base, wallClockTimestamp)
        let idCursor = 0
        const commandDeps: CommandDependencies = {
          catalog: deps.catalog,
          now: () => commandTimestamp,
          createId: () => {
            const existing = generatedIds[idCursor]
            if (existing) {
              idCursor++
              return existing
            }
            const generated = classroomIdSchema.parse(sourceCreateId())
            generatedIds.push(generated)
            idCursor++
            return generated
          },
        }
        const reduced = await reduceCommand(base, command, commandDeps)
        if (reduced === base)
          return structuredClone(base)

        const compacted = compactClassroomSnapshot(reduced)
        const candidate = classroomSnapshotSchema.parse({
          ...compacted,
          revision: base.revision + 1,
        })
        assertClassroomIntegrity(candidate, deps.catalog)
        try {
          commitGuard?.assertActive()
          await deps.storage.save(
            structuredClone(candidate),
            base.revision,
            commitGuard,
          )
          current = candidate
          notify()
          return structuredClone(candidate)
        }
        catch (error) {
          if (!(error instanceof ClassroomRevisionConflictError))
            throw error
          if (retry === MAX_CONFLICT_RETRIES)
            throw error
          await reloadCommitted(true)
        }
      }

      throw new Error('AI Classroom write retry loop exhausted')
    })
    writeTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function dispose(): Promise<void> {
    if (disposal)
      return disposal

    // Flip the guard before unsubscribing so neither a command nor a storage
    // callback can enqueue more work while teardown is taking its snapshot.
    disposed = true
    unsubscribeStorage?.()
    unsubscribeStorage = null
    listeners.clear()

    const pendingOpening = opening
    const pendingWritesAndRefreshes = writeTail
    disposal = Promise.allSettled([
      pendingOpening ?? Promise.resolve(),
      pendingWritesAndRefreshes,
    ]).then(() => undefined)
    return disposal
  }

  return {
    open,
    snapshot,
    execute,
    subscribe: (listener) => {
      if (disposed)
        throw new Error('AI Classroom has been disposed')
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose,
  }
}
