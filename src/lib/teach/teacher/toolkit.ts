import type { ToolCallOptions, ToolSet } from 'ai'
import type { AIClassroom, ClassroomCommand } from '../classroom/ai-classroom'
import type { ClassroomCommitGuard } from '../classroom/storage'
import type {
  ClassroomSnapshot,
  ExerciseInstance,
  LearningTrack,
  RemediationDiagnosticClaimAuthority,
  ReviewArtifact,
  TrackAdjustment,
} from '../classroom/state'
import type {
  ContentPackCatalog,
  ContentPackSummary,
} from '../classroom/content-catalog'
import type { SourceRequirement } from '../classroom/content-packs'
import type { PersistedDiagnostic } from '../classroom/persistence-policy'
import type { KnowledgeSource } from '../knowledge/source'
import type { TeacherLang } from './system-prompt'
import { tool } from 'ai'
import { z } from 'zod'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import { isUserAbort } from '../abort'
import { KnowledgeSourceError } from '../knowledge/source'
import { createAssessmentHistoryIndex } from '../classroom/assessment-policy'
import { deriveConceptProgress } from '../classroom/progress'
import {
  bridgeNoteMarkdownSchema,
  classroomIdSchema,
  MAX_LEARNING_TRACK_CONCEPTS,
  personalizationInputsSchema,
  skipMarkerBasisSchema,
} from '../classroom/state'
import {
  contentVersionSchema,
  MAX_CONTENT_PACK_BLOCKS,
  MAX_CONTENT_PACK_EXERCISE_TEMPLATES,
  MAX_CONTENT_PACK_ID_LENGTH,
  MAX_CONTENT_PACK_LEARNING_SKILLS,
  MAX_TEACHER_READABLE_CONTENT_PACK_CHARACTERS,
} from '../classroom/content-packs'
import { deriveTrackPolicyState } from '../classroom/track-policy'
import { groupReviewArtifacts } from '../classroom/retention'
import { createRemediationProvenanceIndex } from '../classroom/remediation-provenance'
import {
  deriveSkipMarkerBasisCandidates,
} from '../classroom/skip-marker-policy'
import {
  deriveUnresolvedFailureEvidenceIds,
} from '../classroom/personalization-candidates'
import { renderPersistedDiagnostic } from '../classroom/persistence-policy'

type OrchestratorCommand = Extract<ClassroomCommand, {
  type:
    | 'append_content_reference_group'
    | 'append_bridge_note'
    | 'append_skip_marker'
    | 'create_exercise_instance'
    | 'create_review_check'
    | 'adjust_learning_track'
    | 'retain_clarification'
    | 'retain_remediation'
}>

/**
 * Capability-limited aggregate port. It can record only evidence-backed Track
 * Adjustments; it cannot start a Track, record Attempt/Evidence, remove learner
 * data, or replace state.
 */
export interface LessonOrchestratorClassroom {
  read: () => ClassroomSnapshot
  commit: (
    command: OrchestratorCommand,
    commitGuard: ClassroomCommitGuard,
  ) => Promise<ClassroomSnapshot>
}

export function createLessonOrchestratorClassroom(
  classroom: AIClassroom,
): LessonOrchestratorClassroom {
  return {
    read: classroom.snapshot,
    commit: (command, commitGuard) =>
      classroom.execute(command, { commitGuard }),
  }
}

export interface ReadonlyEditorBridge {
  getCode: () => string | null
}

export interface TeacherPlayground {
  listTabs: () => Array<{ id: string, title: string }>
}

export interface TeacherMutationBudget {
  tryConsume: () => boolean
}

export interface TeacherMutationBudgetController extends TeacherMutationBudget {
  reset: (limit: number) => void
  remaining: () => number
}

type TeacherToolCallKind = 'general' | 'documentation-search'
type TeacherMutationIdentityPurpose
  = | 'append_content_reference_group'
    | 'append_bridge_note'
    | 'append_skip_marker'
    | 'create_exercise_instance'
    | 'retain_clarification'
    | 'retain_remediation'

export interface TeacherToolCallBudget {
  allocateMutationId: (
    options: ToolCallOptions,
    purpose: TeacherMutationIdentityPurpose,
  ) => string | null
  consume: (
    options: ToolCallOptions,
    kind: TeacherToolCallKind,
  ) => string | null
  hasReadContentVersion: (
    options: ToolCallOptions,
    conceptId: string,
    contentVersion: string,
  ) => boolean
  recordReadContentVersion: (
    options: ToolCallOptions,
    conceptId: string,
    contentVersion: string,
  ) => boolean
  createMutationCommitGuard: (
    options: ToolCallOptions,
  ) => ClassroomCommitGuard | null
}

export interface TeacherToolCallLease {
  close: () => void
  remaining: () => {
    total: number
    documentationSearches: number
  }
}

export interface TeacherToolCallBudgetController extends TeacherToolCallBudget {
  open: (
    signal: AbortSignal,
    limits: {
      total: number
      documentationSearches: number
    },
  ) => TeacherToolCallLease
}

function assertBudgetLimit(limit: number, label: string): void {
  if (!Number.isSafeInteger(limit) || limit < 0)
    throw new RangeError(`${label} must be a non-negative integer.`)
}

export function createTeacherMutationBudget(
  initialLimit: number,
): TeacherMutationBudgetController {
  let remaining = 0
  const reset = (limit: number) => {
    assertBudgetLimit(limit, 'Teacher mutation budget')
    remaining = limit
  }
  reset(initialLimit)
  return {
    tryConsume: () => {
      if (remaining === 0)
        return false
      remaining -= 1
      return true
    },
    reset,
    remaining: () => remaining,
  }
}

/**
 * Bind every executable tool call to the exact AbortSignal of one agent turn.
 * Closing a turn invalidates late tool executions instead of letting them
 * consume a subsequently-reset shared budget.
 */
export function createTeacherToolCallBudget(): TeacherToolCallBudgetController {
  const leases = new Map<AbortSignal, {
    total: number
    documentationSearches: number
    readContentVersions: Set<string>
    mutationIds: Map<TeacherMutationIdentityPurpose, Map<string, string>>
  }>()
  const contentKey = (conceptId: string, contentVersion: string) =>
    JSON.stringify([conceptId, contentVersion])

  return {
    open: (signal, limits) => {
      assertBudgetLimit(limits.total, 'Teacher tool-call budget')
      assertBudgetLimit(
        limits.documentationSearches,
        'Teacher documentation-search budget',
      )
      if (limits.documentationSearches > limits.total) {
        throw new RangeError(
          'Teacher documentation-search budget cannot exceed the total tool-call budget.',
        )
      }
      if (signal.aborted)
        throw new DOMException('Teacher turn is already aborted', 'AbortError')
      if (leases.has(signal))
        throw new Error('A Teacher tool-call lease already exists for this turn.')

      const state = {
        total: limits.total,
        documentationSearches: limits.documentationSearches,
        readContentVersions: new Set<string>(),
        mutationIds:
          new Map<TeacherMutationIdentityPurpose, Map<string, string>>(),
      }
      leases.set(signal, state)
      let closed = false
      const release = () => {
        if (leases.get(signal) === state)
          leases.delete(signal)
        state.readContentVersions.clear()
        state.mutationIds.clear()
      }
      signal.addEventListener('abort', release, { once: true })
      return {
        close: () => {
          if (closed)
            return
          closed = true
          signal.removeEventListener('abort', release)
          release()
        },
        remaining: () => ({
          total: state.total,
          documentationSearches: state.documentationSearches,
        }),
      }
    },
    allocateMutationId: (options, purpose) => {
      const signal = options.abortSignal
      if (!signal || signal.aborted)
        return null
      const state = leases.get(signal)
      if (!state)
        return null
      let purposeIds = state.mutationIds.get(purpose)
      if (!purposeIds) {
        purposeIds = new Map()
        state.mutationIds.set(purpose, purposeIds)
      }
      const existing = purposeIds.get(options.toolCallId)
      if (existing)
        return existing
      const internalId = `teacher-tool:${globalThis.crypto.randomUUID()}`
      purposeIds.set(options.toolCallId, internalId)
      return internalId
    },
    consume: (options, kind) => {
      const signal = options.abortSignal
      if (!signal || signal.aborted)
        return 'Teacher tool call is outside an active turn.'
      const state = leases.get(signal)
      if (!state)
        return 'Teacher tool call is outside an active turn.'
      if (state.total === 0)
        return 'Teacher tool-call budget exhausted for this turn.'
      if (
        kind === 'documentation-search'
        && state.documentationSearches === 0
      ) {
        return 'Teacher documentation-search budget exhausted for this turn.'
      }
      state.total -= 1
      if (kind === 'documentation-search')
        state.documentationSearches -= 1
      return null
    },
    hasReadContentVersion: (options, conceptId, contentVersion) => {
      const signal = options.abortSignal
      if (!signal || signal.aborted)
        return false
      return leases.get(signal)?.readContentVersions.has(
        contentKey(conceptId, contentVersion),
      ) === true
    },
    recordReadContentVersion: (options, conceptId, contentVersion) => {
      const signal = options.abortSignal
      if (!signal || signal.aborted)
        return false
      const state = leases.get(signal)
      if (!state)
        return false
      state.readContentVersions.add(contentKey(conceptId, contentVersion))
      return true
    },
    createMutationCommitGuard: (options) => {
      const signal = options.abortSignal
      if (!signal || signal.aborted)
        return null
      const state = leases.get(signal)
      if (!state)
        return null
      return {
        assertActive: () => {
          if (signal.aborted || leases.get(signal) !== state) {
            throw new DOMException(
              'Teacher turn is no longer active',
              'AbortError',
            )
          }
        },
      }
    },
  }
}

export type TeacherChatScope
  = | { mode: 'live', learningTrackId: string | null }
    | {
      mode: 'review'
      conceptId: string
      contentVersion: string
      learningTrackId: string | null
    }

export interface TeacherToolkitDeps {
  classroom: LessonOrchestratorClassroom
  catalog: ContentPackCatalog
  knowledge: KnowledgeSource
  editor: ReadonlyEditorBridge
  playground: TeacherPlayground
  mutationBudget: TeacherMutationBudget
  toolCallBudget: TeacherToolCallBudget
  getChatScope: () => TeacherChatScope
  createTeacherInteractionId: () => string
  lang: TeacherLang
}

export interface RemediationToolkitDeps {
  classroom: LessonOrchestratorClassroom
  mutationBudget: TeacherMutationBudget
  toolCallBudget: TeacherToolCallBudget
  getAssignedFailedAttemptId: () => string | null
  getAssignedRemediationClaim?: () => RemediationDiagnosticClaimAuthority | null
}

const EDITOR_CODE_CHARACTER_LIMIT = 32_000
const DOCUMENT_HIT_LIMIT = 8
const DOCUMENT_HIT_SCAN_LIMIT = 32
const DOCUMENT_RESULT_CHARACTER_LIMIT = 32_000
const CONTENT_PACK_CHARACTER_LIMIT
  = MAX_TEACHER_READABLE_CONTENT_PACK_CHARACTERS
const CONTENT_PACK_SUMMARY_LIMIT = 64
const CLASSROOM_CONCEPT_LIMIT = 64
const ACTIVE_TRACK_CONCEPT_LIMIT = MAX_LEARNING_TRACK_CONCEPTS
const ACTIVE_TRACK_ADJUSTMENT_LIMIT = 20
const TRACK_ADJUSTMENT_EVIDENCE_LIMIT = 12
const TRACK_POLICY_ENCOUNTERED_LIMIT = 64
const RECENT_ATTEMPT_LIMIT = 12
const RECENT_EVIDENCE_LIMIT = 20
const ACTIVE_EXERCISE_LIMIT = 12
const RETAINED_ARTIFACT_LIMIT = 32
const ARTIFACT_PROVENANCE_ID_LIMIT = 16
const PENDING_REMEDIATION_LIMIT = 8
const RETENTION_SUPPRESSION_LIMIT = 32
const PLAYGROUND_TAB_LIMIT = 32
const PLAYGROUND_TAB_SCAN_LIMIT = 64
const PLAYGROUND_TAB_CHARACTER_LIMIT = 16_000
const toolIdSchema = classroomIdSchema
const toolVersionSchema = contentVersionSchema

function isSafeDocumentationUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  }
  catch {
    return false
  }
}

const knowledgeHitProjectionSchema = z.object({
  sourceId: z.string().trim().min(1),
  ref: z.string().trim().min(1),
  title: z.string().trim().min(1),
  snippet: z.string().trim().min(1),
  url: z.string().trim().min(1).refine(
    isSafeDocumentationUrl,
    'url must use HTTP(S)',
  ).optional(),
}).strip()

const playgroundTabProjectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
}).strip()

interface ProjectionBudget {
  remaining: number
  returnedCharacters: number
  truncated: boolean
  truncatedFields: string[]
  truncationDetailsOmitted: boolean
}

function createProjectionBudget(limit: number): ProjectionBudget {
  return {
    remaining: limit,
    returnedCharacters: 0,
    truncated: false,
    truncatedFields: [],
    truncationDetailsOmitted: false,
  }
}

function noteTruncation(budget: ProjectionBudget, field: string): void {
  budget.truncated = true
  if (budget.truncatedFields.length < 64)
    budget.truncatedFields.push(field)
  else
    budget.truncationDetailsOmitted = true
}

function boundedProjectionText(
  value: string,
  perFieldLimit: number,
  budget: ProjectionBudget,
  field: string,
): string {
  const limit = Math.max(0, Math.min(perFieldLimit, budget.remaining))
  const projected = value.slice(0, limit)
  budget.remaining -= projected.length
  budget.returnedCharacters += projected.length
  if (projected.length < value.length)
    noteTruncation(budget, field)
  return projected
}

function boundedProjectionArray<T, R>(
  values: readonly T[],
  limit: number,
  budget: ProjectionBudget,
  field: string,
  project: (value: T, index: number) => R,
): R[] {
  if (values.length > limit)
    noteTruncation(budget, field)
  return values.slice(0, limit).map(project)
}

function collectionBounds(
  matchedCount: number,
  returnedCount: number,
  limit: number,
  strategy: 'first' | 'page' | 'recent' | 'scope-priority',
) {
  return {
    matchedCount,
    returnedCount,
    limit,
    truncated: returnedCount < matchedCount,
    strategy,
  }
}

function compareIds(left: string, right: string): number {
  if (left === right)
    return 0
  return left < right ? -1 : 1
}

function collectRecentMatching<T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => boolean,
) {
  const items: T[] = []
  let matchedCount = 0
  for (const value of values) {
    if (!matches(value))
      continue
    matchedCount += 1
    if (items.length === limit)
      items.shift()
    items.push(value)
  }
  return { items, matchedCount }
}

function collectMostRecentMatching<T, S extends T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => value is S,
  compare: (left: S, right: S) => number,
): { items: S[], matchedCount: number }
function collectMostRecentMatching<T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => boolean,
  compare: (left: T, right: T) => number,
): { items: T[], matchedCount: number }
function collectMostRecentMatching<T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => boolean,
  compare: (left: T, right: T) => number,
): { items: T[], matchedCount: number } {
  const items: T[] = []
  let matchedCount = 0
  for (const value of values) {
    if (!matches(value))
      continue
    matchedCount += 1
    if (items.length < limit) {
      items.push(value)
      items.sort(compare)
      continue
    }
    if (compare(value, items[0]) <= 0)
      continue
    items[0] = value
    items.sort(compare)
  }
  return { items, matchedCount }
}

function projectContentPackSummary(summary: ContentPackSummary) {
  const conceptId = summary.conceptId.slice(0, MAX_CONTENT_PACK_ID_LENGTH)
  const title = summary.title.slice(0, 512)
  const version = summary.version.slice(0, 128)
  const truncatedFields = [
    ...(conceptId.length < summary.conceptId.length ? ['conceptId'] : []),
    ...(title.length < summary.title.length ? ['title'] : []),
    ...(version.length < summary.version.length ? ['version'] : []),
  ]
  return {
    conceptId,
    title,
    version,
    availability: summary.availability,
    availabilityReason: summary.availabilityReason,
    truncated: truncatedFields.length > 0,
    truncatedFields,
  }
}

function projectKnowledgeHits(input: unknown, requestedLimit: number) {
  if (!Array.isArray(input)) {
    return {
      hits: [],
      originalHitCount: 0,
      examinedHitCount: 0,
      rejectedHitCount: 0,
      invalidResponse: true,
      truncated: false,
      characterLimit: DOCUMENT_RESULT_CHARACTER_LIMIT,
      returnedCharacters: 0,
    }
  }

  const budget = createProjectionBudget(DOCUMENT_RESULT_CHARACTER_LIMIT)
  const hits: Array<{
    sourceId: string
    ref: string
    title: string
    snippet: string
    url?: string
    truncated: boolean
    truncatedFields: string[]
  }> = []
  const maximumHits = Math.min(requestedLimit, DOCUMENT_HIT_LIMIT)
  const scanCount = Math.min(input.length, DOCUMENT_HIT_SCAN_LIMIT)
  let examinedHitCount = 0
  let rejectedHitCount = 0

  for (let index = 0; index < scanCount && hits.length < maximumHits; index += 1) {
    examinedHitCount += 1
    const parsed = knowledgeHitProjectionSchema.safeParse(input[index])
    if (!parsed.success) {
      rejectedHitCount += 1
      continue
    }

    const truncatedFields: string[] = []
    const field = (value: string, limit: number, name: string) => {
      const projected = boundedProjectionText(
        value,
        limit,
        budget,
        `hits.${hits.length}.${name}`,
      )
      if (projected.length < value.length)
        truncatedFields.push(name)
      return projected
    }
    const sourceId = field(parsed.data.sourceId, 128, 'sourceId')
    const ref = field(parsed.data.ref, 512, 'ref')
    const title = field(parsed.data.title, 512, 'title')
    const url = parsed.data.url === undefined
      ? undefined
      : field(parsed.data.url, 2_048, 'url')
    const snippet = field(parsed.data.snippet, 6_000, 'snippet')
    hits.push({
      sourceId,
      ref,
      title,
      snippet,
      ...(url === undefined ? {} : { url }),
      truncated: truncatedFields.length > 0,
      truncatedFields,
    })

    if (budget.remaining === 0)
      break
  }

  const resultSetTruncated
    = examinedHitCount < input.length || hits.length < input.length
  return {
    hits,
    originalHitCount: input.length,
    examinedHitCount,
    rejectedHitCount,
    invalidResponse: false,
    truncated: budget.truncated || resultSetTruncated,
    characterLimit: DOCUMENT_RESULT_CHARACTER_LIMIT,
    returnedCharacters: budget.returnedCharacters,
  }
}

function projectPlaygroundTabs(input: unknown) {
  if (!Array.isArray(input)) {
    return {
      tabs: [],
      originalTabCount: 0,
      examinedTabCount: 0,
      rejectedTabCount: 0,
      invalidResponse: true,
      truncated: false,
      characterLimit: PLAYGROUND_TAB_CHARACTER_LIMIT,
      returnedCharacters: 0,
    }
  }

  const budget = createProjectionBudget(PLAYGROUND_TAB_CHARACTER_LIMIT)
  const tabs: Array<{
    id: string
    title: string
    truncated: boolean
    truncatedFields: string[]
  }> = []
  const scanCount = Math.min(input.length, PLAYGROUND_TAB_SCAN_LIMIT)
  let examinedTabCount = 0
  let rejectedTabCount = 0

  for (
    let index = 0;
    index < scanCount && tabs.length < PLAYGROUND_TAB_LIMIT;
    index += 1
  ) {
    examinedTabCount += 1
    const parsed = playgroundTabProjectionSchema.safeParse(input[index])
    if (!parsed.success) {
      rejectedTabCount += 1
      continue
    }
    const truncatedFields: string[] = []
    const field = (value: string, limit: number, name: string) => {
      const projected = boundedProjectionText(
        value,
        limit,
        budget,
        `tabs.${tabs.length}.${name}`,
      )
      if (projected.length < value.length)
        truncatedFields.push(name)
      return projected
    }
    const id = field(parsed.data.id, 256, 'id')
    const title = field(parsed.data.title, 512, 'title')
    tabs.push({
      id,
      title,
      truncated: truncatedFields.length > 0,
      truncatedFields,
    })
    if (budget.remaining === 0)
      break
  }

  const resultSetTruncated
    = examinedTabCount < input.length || tabs.length < input.length
  return {
    tabs,
    originalTabCount: input.length,
    examinedTabCount,
    rejectedTabCount,
    invalidResponse: false,
    truncated: budget.truncated || resultSetTruncated,
    characterLimit: PLAYGROUND_TAB_CHARACTER_LIMIT,
    returnedCharacters: budget.returnedCharacters,
  }
}

function ok<T extends object>(extra?: T) {
  return { ok: true as const, ...(extra ?? ({} as T)) }
}

function fail(error: string) {
  return { ok: false as const, error }
}

function successfulToolResultValues(
  options: ToolCallOptions,
  toolName: string,
): unknown[] {
  const values: unknown[] = []
  for (const message of options.messages) {
    if (message.role !== 'tool')
      continue
    for (const part of message.content) {
      if (
        part.type === 'tool-result'
        && part.toolName === toolName
        && part.output.type === 'json'
      ) {
        values.push(part.output.value)
      }
    }
  }
  return values
}

const successfulContentReadResultSchema = z.object({
  ok: z.literal(true),
  truncation: z.object({
    truncated: z.literal(false),
  }).passthrough(),
  pack: z.object({
    concept: z.object({
      id: z.string(),
    }).passthrough(),
    version: z.string(),
    blocks: z.array(z.object({
      id: z.string(),
    }).passthrough()).default([]),
    learningSkills: z.array(z.object({
      id: z.string(),
    }).passthrough()).default([]),
    exerciseTemplates: z.array(z.object({
      id: z.string(),
    }).passthrough()).default([]),
  }).passthrough(),
}).passthrough()

interface ContentReadRequirement {
  blockIds?: string[]
  learningSkillId?: string
  templateId?: string
}

function hasPriorSuccessfulContentRead(
  options: ToolCallOptions,
  conceptId: string,
  contentVersion: string,
  requirement: ContentReadRequirement,
): boolean {
  return successfulToolResultValues(options, 'read_content_pack').some(
    (value) => {
      const parsed = successfulContentReadResultSchema.safeParse(value)
      if (
        !parsed.success
        || parsed.data.pack.concept.id !== conceptId
        || parsed.data.pack.version !== contentVersion
      ) {
        return false
      }
      const returnedBlockIds = new Set(
        parsed.data.pack.blocks.map(block => block.id),
      )
      return (requirement.blockIds ?? []).every(id => returnedBlockIds.has(id))
        && (
          requirement.learningSkillId === undefined
          || parsed.data.pack.learningSkills.some(
            skill => skill.id === requirement.learningSkillId,
          )
        )
        && (
          requirement.templateId === undefined
          || parsed.data.pack.exerciseTemplates.some(
            template => template.id === requirement.templateId,
          )
        )
    },
  )
}

function requireSameTurnContentRead(
  budget: TeacherToolCallBudget,
  options: ToolCallOptions,
  conceptId: string,
  contentVersion: string,
  requirement: ContentReadRequirement = {},
) {
  if (
    budget.hasReadContentVersion(options, conceptId, contentVersion)
    && hasPriorSuccessfulContentRead(
      options,
      conceptId,
      contentVersion,
      requirement,
    )
  ) {
    return null
  }
  return fail(
    `Read and receive exact Course Content Pack ${conceptId}@${contentVersion} `
    + 'in this Teacher turn before mutating classroom content.',
  )
}

function pinnedTrackContentVersion(
  classroom: LessonOrchestratorClassroom,
  learningTrackId: string,
  conceptId: string,
): string | null {
  const track = classroom.read().tracks.find(item => item.id === learningTrackId)
  return track?.contentVersions[conceptId] ?? null
}

function withTeacherToolCallBudget<Input, Output>(
  budget: TeacherToolCallBudget,
  kind: TeacherToolCallKind,
  run: (input: Input, options: ToolCallOptions) => Output | Promise<Output>,
) {
  return async (input: Input, options: ToolCallOptions) => {
    const denial = budget.consume(options, kind)
    if (denial)
      return fail(denial)
    return run(input, options)
  }
}

interface AbortedToolResult {
  ok: false
  error: 'User aborted'
  aborted: true
}

const ABORTED_RESULT: AbortedToolResult = {
  ok: false,
  error: 'User aborted',
  aborted: true,
}

function withAbort<Output>(
  options: ToolCallOptions,
  run: (signal: AbortSignal | undefined) => Promise<Output>,
): Promise<Output | AbortedToolResult> {
  const signal = options.abortSignal
  if (signal?.aborted)
    return Promise.resolve(ABORTED_RESULT)
  return awaitWithSignal(run(signal), signal).catch((error) => {
    if (isUserAbort(error, signal))
      return ABORTED_RESULT
    throw error
  })
}

async function execute(
  classroom: LessonOrchestratorClassroom,
  command: OrchestratorCommand,
  commitGuard: ClassroomCommitGuard,
  signal: AbortSignal | undefined,
) {
  try {
    await classroom.commit(command, commitGuard)
    return ok()
  }
  catch (reason) {
    if (isUserAbort(reason, signal))
      return ABORTED_RESULT
    return fail(reason instanceof Error ? reason.message : String(reason))
  }
}

async function executeMutation(
  classroom: LessonOrchestratorClassroom,
  budget: TeacherMutationBudget,
  toolCallBudget: TeacherToolCallBudget,
  options: ToolCallOptions,
  command: () => OrchestratorCommand,
) {
  const commitGuard = toolCallBudget.createMutationCommitGuard(options)
  if (!commitGuard)
    return fail('Teacher tool call is outside an active turn.')
  if (!budget.tryConsume())
    return fail('Teacher mutation budget exhausted for this turn.')
  return execute(classroom, command(), commitGuard, options.abortSignal)
}

async function executeIdentifiedMutation(
  classroom: LessonOrchestratorClassroom,
  mutationBudget: TeacherMutationBudget,
  toolCallBudget: TeacherToolCallBudget,
  options: ToolCallOptions,
  purpose: TeacherMutationIdentityPurpose,
  command: (internalId: string) => OrchestratorCommand,
) {
  const internalId = toolCallBudget.allocateMutationId(options, purpose)
  if (!internalId)
    return fail('Teacher tool call is outside an active turn.')
  return executeMutation(
    classroom,
    mutationBudget,
    toolCallBudget,
    options,
    () => command(internalId),
  )
}

function boundedDiagnosticText(value: string | undefined, maximum: number): string | undefined {
  if (value === undefined || value.length <= maximum)
    return value
  const half = Math.floor(maximum / 2)
  return `${value.slice(0, half)}\n…[bounded diagnostic excerpt]…\n${value.slice(-half)}`
}

function projectSourceRequirement(
  requirement: SourceRequirement,
): SourceRequirement {
  switch (requirement.type) {
    case 'top_level_main':
      return requirement
    case 'binding':
      return {
        ...requirement,
        name: requirement.name.slice(0, 128),
      }
    case 'call_identifier':
      return {
        ...requirement,
        argumentName: requirement.argumentName.slice(0, 128),
      }
    case 'reassignment':
    case 'integer_binding':
    case 'add_integer_reassignment':
      return {
        ...requirement,
        name: requirement.name.slice(0, 128),
      }
    case 'binary_integer_binding':
      return {
        ...requirement,
        name: requirement.name.slice(0, 128),
        leftName: requirement.leftName.slice(0, 128),
      }
  }
}

function teacherReadablePack(
  pack: NonNullable<ReturnType<ContentPackCatalog['getVersion']>>,
) {
  const budget = createProjectionBudget(CONTENT_PACK_CHARACTER_LIMIT)
  const exact = (value: string, field: string) => {
    if (value.length > budget.remaining) {
      throw new RangeError(
        `Content Pack identity metadata exceeds the projection budget at ${field}.`,
      )
    }
    budget.remaining -= value.length
    budget.returnedCharacters += value.length
    return value
  }
  const text = (value: string, field: string) =>
    boundedProjectionText(value, value.length, budget, field)

  // Reserve every capability-bearing identity before projecting descriptive
  // text. A valid pack is guaranteed to fit the full projection budget, while
  // a malformed catalog implementation fails closed rather than returning
  // blank or unreachable ids.
  const id = exact(pack.id, 'id')
  const version = exact(pack.version, 'version')
  const learningContractVersion = exact(
    pack.learningContractVersion,
    'learningContractVersion',
  )
  const conceptId = exact(pack.concept.id, 'concept.id')
  const prerequisites = boundedProjectionArray(
    pack.concept.prerequisites,
    MAX_LEARNING_TRACK_CONCEPTS,
    budget,
    'concept.prerequisites',
    (prerequisite, index) =>
      exact(prerequisite, `concept.prerequisites.${index}`),
  )
  const learningSkillIdentities = boundedProjectionArray(
    pack.learningSkills,
    MAX_CONTENT_PACK_LEARNING_SKILLS,
    budget,
    'learningSkills',
    (skill, index) => ({
      skill,
      id: exact(skill.id, `learningSkills.${index}.id`),
      conceptId: exact(
        skill.conceptId,
        `learningSkills.${index}.conceptId`,
      ),
    }),
  )
  const exerciseTemplateIdentities = boundedProjectionArray(
    pack.exerciseTemplates,
    MAX_CONTENT_PACK_EXERCISE_TEMPLATES,
    budget,
    'exerciseTemplates',
    (template, index) => ({
      template,
      id: exact(template.id, `exerciseTemplates.${index}.id`),
      version: exact(
        template.version,
        `exerciseTemplates.${index}.version`,
      ),
      learningSkillId: exact(
        template.learningSkillId,
        `exerciseTemplates.${index}.learningSkillId`,
      ),
    }),
  )
  const blockIdentities = boundedProjectionArray(
    pack.blocks,
    MAX_CONTENT_PACK_BLOCKS,
    budget,
    'blocks',
    (block, index) => ({
      block,
      id: exact(block.id, `blocks.${index}.id`),
    }),
  )

  const concept = {
    id: conceptId,
    title: text(pack.concept.title, 'concept.title'),
    summary: text(pack.concept.summary, 'concept.summary'),
    prerequisites,
  }
  const learningSkills = learningSkillIdentities.map(
    ({ skill, id: skillId, conceptId: skillConceptId }, index) => ({
      id: skillId,
      conceptId: skillConceptId,
      title: text(skill.title, `learningSkills.${index}.title`),
      description: text(
        skill.description,
        `learningSkills.${index}.description`,
      ),
      key: skill.key,
    }),
  )
  const exerciseTemplates = exerciseTemplateIdentities.map(
    ({
      template,
      id: templateId,
      version: templateVersion,
      learningSkillId,
    }, templateIndex) => {
      const codeTask = template.task.type === 'code_output'
        ? template.task
        : null
      const personalizable = template.purpose !== 'placement' && codeTask !== null
      return {
        id: templateId,
        version: templateVersion,
        learningSkillId,
        purpose: template.purpose,
        authoredHintCount: codeTask?.hints.length ?? 0,
        supportsEasy: personalizable
          && codeTask !== null
          && codeTask.hints.length > 0,
        supportsHard: personalizable
          && codeTask !== null
          && codeTask.starterCode.trim().length > 0,
        task: template.task.type === 'code_output'
          ? {
              type: template.task.type,
              prompt: text(
                template.task.prompt,
                `exerciseTemplates.${templateIndex}.task.prompt`,
              ),
              starterCode: text(
                template.task.starterCode,
                `exerciseTemplates.${templateIndex}.task.starterCode`,
              ),
            }
          : template.task.type === 'recall'
            ? {
                type: template.task.type,
                prompt: text(
                  template.task.prompt,
                  `exerciseTemplates.${templateIndex}.task.prompt`,
                ),
              }
            : {
                type: template.task.type,
                questions: boundedProjectionArray(
                  template.task.questions,
                  8,
                  budget,
                  `exerciseTemplates.${templateIndex}.task.questions`,
                  (question, questionIndex) => ({
                    question: text(
                      question.question,
                      `exerciseTemplates.${templateIndex}.task.questions.${questionIndex}.question`,
                    ),
                    options: boundedProjectionArray(
                      question.options,
                      5,
                      budget,
                      `exerciseTemplates.${templateIndex}.task.questions.${questionIndex}.options`,
                      (option, optionIndex) => text(
                        option,
                        `exerciseTemplates.${templateIndex}.task.questions.${questionIndex}.options.${optionIndex}`,
                      ),
                    ),
                    multiple: question.multiple,
                  }),
                ),
              },
      }
    },
  )
  const blocks = blockIdentities.map(({ block, id: blockId }, blockIndex) => {
    const sourceReferences = boundedProjectionArray(
      block.sourceReferences,
      16,
      budget,
      `blocks.${blockIndex}.sourceReferences`,
      (reference, referenceIndex) => ({
        sourceId: text(
          reference.sourceId,
          `blocks.${blockIndex}.sourceReferences.${referenceIndex}.sourceId`,
        ),
        ref: text(
          reference.ref,
          `blocks.${blockIndex}.sourceReferences.${referenceIndex}.ref`,
        ),
        title: text(
          reference.title,
          `blocks.${blockIndex}.sourceReferences.${referenceIndex}.title`,
        ),
      }),
    )
    if (block.type === 'prose') {
      return {
        id: blockId,
        type: block.type,
        markdown: text(
          block.markdown,
          `blocks.${blockIndex}.markdown`,
        ),
        sourceReferences,
      }
    }
    return {
      id: blockId,
      type: block.type,
      code: text(block.code, `blocks.${blockIndex}.code`),
      language: block.language,
      explanation: block.explanation === undefined
        ? undefined
        : text(
            block.explanation,
            `blocks.${blockIndex}.explanation`,
          ),
      sourceReferences,
    }
  })

  return {
    pack: {
      id,
      version,
      learningContractVersion,
      concept,
      blocks,
      learningSkills,
      exerciseTemplates,
    },
    truncation: {
      truncated: budget.truncated,
      characterLimit: CONTENT_PACK_CHARACTER_LIMIT,
      returnedCharacters: budget.returnedCharacters,
      truncatedFields: budget.truncatedFields,
      detailsOmitted: budget.truncationDetailsOmitted,
    },
  }
}

function pendingRemediationContext(
  snapshot: ClassroomSnapshot,
  failedAttemptId: string | undefined,
) {
  if (!failedAttemptId)
    return null
  const attempt = snapshot.attempts.find(item => item.id === failedAttemptId)
  const instance = snapshot.stream.find((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance'
    && entry.id === attempt?.exerciseInstanceId)
  if (!attempt || !instance)
    return null
  const truncatedFields: string[] = []
  const markTruncated = (field: string) => {
    if (!truncatedFields.includes(field))
      truncatedFields.push(field)
  }
  const diagnosticText = (
    value: string | undefined,
    maximum: number,
    field: string,
  ) => {
    if (value !== undefined && value.length > maximum)
      markTruncated(field)
    return boundedDiagnosticText(value, maximum)
  }
  const persistedDiagnosticText = (
    value: PersistedDiagnostic | undefined,
    maximum: number,
    field: string,
  ) => {
    if (value && (value.omittedUtf8Bytes > 0 || value.sourceTruncated))
      markTruncated(field)
    return diagnosticText(
      value ? renderPersistedDiagnostic(value) : undefined,
      maximum,
      field,
    )
  }

  const submission = attempt.submission.type === 'code_output'
    ? {
        type: attempt.submission.type,
        code: diagnosticText(
          attempt.submission.code,
          12_000,
          'submission.code',
        ),
      }
    : attempt.submission.type === 'recall'
      ? {
          type: attempt.submission.type,
          answer: diagnosticText(
            attempt.submission.answer,
            4_000,
            'submission.answer',
          ),
        }
      : {
          type: attempt.submission.type,
          answerIndices: attempt.submission.answerIndices
            .slice(0, 8)
            .map(indices => indices.slice(0, 5)),
        }
  const task = instance.task.type === 'code_output'
    ? {
        type: instance.task.type,
        prompt: diagnosticText(instance.task.prompt, 2_000, 'task.prompt'),
        expectedOutput: diagnosticText(
          instance.task.expectedOutput,
          2_000,
          'task.expectedOutput',
        ),
        matchMode: instance.task.matchMode,
        sourceRequirements: instance.task.sourceRequirements
          .slice(0, 12)
          .map(projectSourceRequirement),
      }
    : instance.task.type === 'recall'
      ? {
          type: instance.task.type,
          prompt: diagnosticText(instance.task.prompt, 4_000, 'task.prompt'),
          referenceAnswer: diagnosticText(
            instance.task.referenceAnswer,
            4_000,
            'task.referenceAnswer',
          ),
        }
      : {
          type: instance.task.type,
          questions: instance.task.questions.slice(0, 8).map((question, index) => ({
            question: diagnosticText(
              question.question,
              1_000,
              `task.questions.${index}.question`,
            ),
            options: question.options.slice(0, 5).map((option, optionIndex) =>
              diagnosticText(
                option,
                500,
                `task.questions.${index}.options.${optionIndex}`,
              )),
            answerIndices: question.answerIndices.slice(0, 5),
            multiple: question.multiple,
            explanation: diagnosticText(
              question.explanation,
              1_000,
              `task.questions.${index}.explanation`,
            ),
          })),
        }
  return {
    exerciseInstanceId: instance.id,
    templateId: instance.templateId,
    task,
    submission,
    result: {
      passed: attempt.result.passed,
      runnerOk: attempt.result.runnerOk,
      phase: attempt.result.phase,
      stdout: persistedDiagnosticText(
        attempt.result.stdout,
        4_000,
        'result.stdout',
      ),
      stderr: persistedDiagnosticText(
        attempt.result.stderr,
        6_000,
        'result.stderr',
      ),
      compilerOutput: persistedDiagnosticText(
        attempt.result.compilerOutput,
        6_000,
        'result.compilerOutput',
      ),
      exitCode: attempt.result.exitCode,
    },
    assistance: attempt.assistance,
    truncation: {
      truncated: truncatedFields.length > 0,
      truncatedFields,
    },
  }
}

export type RemediationDiagnosticContextAvailability
  = | 'complete'
    | 'missing'
    | 'too_large'

export function remediationDiagnosticContextAvailability(
  snapshot: ClassroomSnapshot,
  failedAttemptId: string,
): RemediationDiagnosticContextAvailability {
  const context = pendingRemediationContext(snapshot, failedAttemptId)
  if (!context || context.result.passed)
    return 'missing'
  return context.truncation.truncated ? 'too_large' : 'complete'
}

/**
 * Build the two-tool surface for one background Remediation job.
 *
 * Unlike the learner-facing classroom projection, this capability addresses
 * exactly the assigned failed Attempt and therefore cannot starve behind a
 * recent-item window or inspect unrelated learner state. A retention is
 * accepted only after that exact context was read once on the same turn signal.
 */
export function createRemediationToolkit(
  deps: RemediationToolkitDeps,
): ToolSet {
  const {
    classroom,
    getAssignedFailedAttemptId,
    getAssignedRemediationClaim,
    mutationBudget,
    toolCallBudget,
  } = deps
  const readSignals = new WeakSet<AbortSignal>()
  const groundedTargets = new WeakMap<AbortSignal, string>()
  const successfulAssignedReadResultSchema = z.object({
    ok: z.literal(true),
    remediation: z.object({
      failedAttemptId: z.string(),
      diagnosticContext: z.object({
        truncation: z.object({
          truncated: z.literal(false),
        }).passthrough(),
      }).passthrough(),
    }).passthrough(),
  }).passthrough()
  const hasPriorSuccessfulAssignedRead = (
    options: ToolCallOptions,
    failedAttemptId: string,
  ) => successfulToolResultValues(
    options,
    'read_assigned_remediation_context',
  ).some((value) => {
    const parsed = successfulAssignedReadResultSchema.safeParse(value)
    return parsed.success
      && parsed.data.remediation.failedAttemptId === failedAttemptId
  })

  return {
    read_assigned_remediation_context: tool({
      description: 'Read exactly the pending diagnostic context assigned to this internal Remediation job. This tool can be called only once in the turn and exposes no unrelated classroom state.',
      inputSchema: z.object({}).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (_input, options) => {
          const signal = options.abortSignal
          if (!signal || signal.aborted)
            return fail('Remediation context read is outside an active turn.')
          if (readSignals.has(signal)) {
            return fail(
              'The assigned Remediation context was already read in this turn.',
            )
          }
          readSignals.add(signal)

          const assignedClaim = getAssignedRemediationClaim?.() ?? null
          const failedAttemptId
            = assignedClaim?.job.failedAttemptId
              ?? getAssignedFailedAttemptId()
          if (!failedAttemptId) {
            return fail(
              'No pending Remediation is assigned to this diagnostic job.',
            )
          }
          const snapshot = classroom.read()
          const artifact = snapshot.reviewArtifacts.find(
            (candidate): candidate is Extract<
              ClassroomSnapshot['reviewArtifacts'][number],
              { type: 'remediation' }
            > =>
              candidate.type === 'remediation'
              && candidate.diagnosticStatus === 'pending'
              && candidate.attemptIds.includes(failedAttemptId),
          )
          const diagnosticContext = pendingRemediationContext(
            snapshot,
            failedAttemptId,
          )
          if (!artifact || !diagnosticContext || diagnosticContext.result.passed) {
            return fail(
              `No pending diagnostic context for assigned Attempt ${failedAttemptId}.`,
            )
          }
          if (diagnosticContext.truncation.truncated) {
            return fail(
              'The assigned Attempt exceeds the complete grounded diagnostic '
              + `context limit (${diagnosticContext.truncation.truncatedFields.join(', ')}).`,
            )
          }
          if (signal.aborted) {
            return fail(
              'Teacher turn ended before the Remediation context read completed.',
            )
          }
          groundedTargets.set(signal, failedAttemptId)
          return ok({
            remediation: {
              artifactId: artifact.id,
              conceptId: artifact.conceptId,
              learningSkillId: artifact.learningSkillId,
              failedAttemptId,
              evidenceIds: artifact.evidenceIds.slice(
                -ARTIFACT_PROVENANCE_ID_LIMIT,
              ),
              evidenceCount: artifact.evidenceIds.length,
              evidenceIdsTruncated:
                artifact.evidenceIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
              diagnosticContext,
            },
          })
        },
      ),
    }),
    retain_remediation: tool({
      description: 'Complete only the exact assigned pending Remediation after reading its diagnostic context in this same internal turn.',
      inputSchema: z.object({
        misconceptionTheme: z.string().trim().min(1).max(160),
        markdown: z.string().trim().min(1).max(1_200),
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (input, options) => {
          const assignedClaim = getAssignedRemediationClaim?.() ?? null
          const failedAttemptId
            = assignedClaim?.job.failedAttemptId
              ?? getAssignedFailedAttemptId()
          const signal = options.abortSignal
          if (!failedAttemptId || !signal || signal.aborted) {
            return fail(
              'No pending Remediation is assigned to this diagnostic job.',
            )
          }
          if (
            groundedTargets.get(signal) !== failedAttemptId
            || !hasPriorSuccessfulAssignedRead(options, failedAttemptId)
          ) {
            return fail(
              'Read and receive the assigned Remediation context in this turn before retaining a diagnostic.',
            )
          }
          return executeIdentifiedMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            'retain_remediation',
            artifactId => ({
              type: 'retain_remediation',
              artifactId,
              failedAttemptId,
              ...input,
              ...(assignedClaim
                ? { diagnosticClaim: assignedClaim }
                : {}),
            }),
          )
        },
      ),
    }),
  }
}

function projectTrackAdjustment(adjustment: TrackAdjustment) {
  const base = {
    id: adjustment.id,
    type: adjustment.type,
    conceptId: adjustment.conceptId,
    decision: adjustment.decision,
    createdAt: adjustment.createdAt,
    recordedRevision: adjustment.recordedRevision,
  }
  if (adjustment.type === 'accelerate') {
    return {
      ...base,
      placementEvidenceId: adjustment.placementEvidenceId,
    }
  }
  if (adjustment.type === 'focused_catch_up') {
    return {
      ...base,
      failureEvidenceId: adjustment.failureEvidenceId,
    }
  }
  if (adjustment.type === 'review') {
    return {
      ...base,
      encounteredStreamEntryId: adjustment.encounteredStreamEntryId,
    }
  }
  return {
    ...base,
    nextConceptId: adjustment.nextConceptId,
    blockedEvidenceIds: adjustment.blockedEvidenceIds.slice(
      -TRACK_ADJUSTMENT_EVIDENCE_LIMIT,
    ),
    blockedEvidenceCount: adjustment.blockedEvidenceIds.length,
    blockedEvidenceTruncated:
      adjustment.blockedEvidenceIds.length > TRACK_ADJUSTMENT_EVIDENCE_LIMIT,
  }
}

function projectActiveTrack(
  track: LearningTrack,
  relevantConceptIds: readonly (string | null)[],
) {
  const conceptIds = track.conceptIds.slice(0, ACTIVE_TRACK_CONCEPT_LIMIT)
  const versionConceptIds = [
    ...new Set([
      ...conceptIds,
      ...relevantConceptIds.filter((id): id is string => id !== null),
    ]),
  ]
  const contentVersionEntries: Array<[string, string]> = []
  for (const conceptId of versionConceptIds) {
    const version = track.contentVersions[conceptId]
    if (version !== undefined)
      contentVersionEntries.push([conceptId, version])
  }
  const adjustments = track.adjustments
    .slice(-ACTIVE_TRACK_ADJUSTMENT_LIMIT)
    .map(projectTrackAdjustment)
  return {
    track: {
      id: track.id,
      goal: track.goal,
      conceptIds,
      contentVersions: Object.fromEntries(contentVersionEntries),
      createdAt: track.createdAt,
      recordedRevision: track.recordedRevision,
      adjustments,
    },
    bounds: {
      conceptIds: collectionBounds(
        track.conceptIds.length,
        conceptIds.length,
        ACTIVE_TRACK_CONCEPT_LIMIT,
        'first',
      ),
      contentVersions: collectionBounds(
        Object.keys(track.contentVersions).length,
        contentVersionEntries.length,
        ACTIVE_TRACK_CONCEPT_LIMIT + 3,
        'scope-priority',
      ),
      adjustments: collectionBounds(
        track.adjustments.length,
        adjustments.length,
        ACTIVE_TRACK_ADJUSTMENT_LIMIT,
        'recent',
      ),
    },
  }
}

function recentRemediationAttemptIds(
  artifacts: readonly ReviewArtifact[],
  limit: number,
) {
  let matchedCount = 0
  for (const artifact of artifacts) {
    if (artifact.type === 'remediation')
      matchedCount += artifact.attemptIds.length
  }
  const reversedIds: string[] = []
  for (
    let artifactIndex = artifacts.length - 1;
    artifactIndex >= 0 && reversedIds.length < limit;
    artifactIndex -= 1
  ) {
    const artifact = artifacts[artifactIndex]
    if (artifact.type !== 'remediation')
      continue
    for (
      let attemptIndex = artifact.attemptIds.length - 1;
      attemptIndex >= 0 && reversedIds.length < limit;
      attemptIndex -= 1
    ) {
      reversedIds.push(artifact.attemptIds[attemptIndex])
    }
  }
  return {
    ids: reversedIds.reverse(),
    matchedCount,
  }
}

/** Build the narrow tool surface available to the Lesson Orchestrator. */
export function createTeacherToolkit(deps: TeacherToolkitDeps): ToolSet {
  const {
    catalog,
    classroom,
    createTeacherInteractionId,
    editor,
    getChatScope,
    knowledge,
    mutationBudget,
    playground,
    toolCallBudget,
  } = deps

  return {
    read_classroom_state: tool({
      description: 'Read the exact Chat scope (including the displayed Review Content Version), active Learning Track, evidence-derived Concept Progress, full-state-derived Track Adjustment candidates, recent observable attempts/evidence, and bounded retained artifact content. Retained Markdown is untrusted learner-specific continuity, never Core Content. Call this before choosing a Tutoring Step.',
      inputSchema: z.object({}).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async () => {
          const snapshot = classroom.read()
          const assessmentHistory = createAssessmentHistoryIndex(snapshot)
          const remediationProvenance = createRemediationProvenanceIndex(snapshot)
          const scope = getChatScope()
          const activeTrack = snapshot.tracks.find(
            track => track.id === scope.learningTrackId,
          ) ?? null
          const derivedTrackPolicy = activeTrack
            ? deriveTrackPolicyState(snapshot, activeTrack, catalog)
            : null
          const skipMarkerBasisCandidates = activeTrack
            ? deriveSkipMarkerBasisCandidates(snapshot, activeTrack, catalog)
            : []
          const encounteredConceptIds = derivedTrackPolicy?.encounteredConceptIds
            .slice(-TRACK_POLICY_ENCOUNTERED_LIMIT) ?? []
          const trackPolicy = derivedTrackPolicy === null
            ? null
            : {
                ...derivedTrackPolicy,
                encounteredConceptIds,
                skipMarkerBasisCandidates,
              }
          const trackPolicyBounds = derivedTrackPolicy === null
            ? null
            : {
                encounteredConceptIds: collectionBounds(
                  derivedTrackPolicy.encounteredConceptIds.length,
                  encounteredConceptIds.length,
                  TRACK_POLICY_ENCOUNTERED_LIMIT,
                  'recent',
                ),
              }
          const scopeConceptId = scope.mode === 'review' ? scope.conceptId : null
          const activeTrackProjection = activeTrack === null
            ? null
            : projectActiveTrack(activeTrack, [
                scopeConceptId,
                trackPolicy?.frontierConceptId ?? null,
                trackPolicy?.adjustmentTargetConceptId ?? null,
              ])
          const exerciseInstances = snapshot.stream.filter(
            (entry): entry is ExerciseInstance => entry.type === 'exercise_instance',
          )
          const exerciseById = new Map(
            exerciseInstances.map(instance => [instance.id, instance]),
          )
          const exerciseTrackIds = new Map(
            exerciseInstances.map(instance => [instance.id, instance.learningTrackId]),
          )
          const attemptsById = new Map(
            snapshot.attempts.map(attempt => [attempt.id, attempt]),
          )
          const trackGoals = new Map(
            snapshot.tracks.map(track => [track.id, track.goal]),
          )
          const displayedReviewPack = scope.mode === 'review'
            ? catalog.getVersion(scope.conceptId, scope.contentVersion) ?? null
            : null
          const activeTrackConceptIds = new Set(activeTrack?.conceptIds ?? [])
          const activeTrackContractVersions = new Map<string, string>()
          for (const conceptId of activeTrack?.conceptIds ?? []) {
            const contentVersion = activeTrack?.contentVersions[conceptId]
            const pack = contentVersion
              ? catalog.getVersion(conceptId, contentVersion)
              : undefined
            if (pack) {
              activeTrackContractVersions.set(
                conceptId,
                pack.learningContractVersion,
              )
            }
          }
          const retainedArtifactMatchesScope = (
            artifact: ClassroomSnapshot['reviewArtifacts'][number]
              | ClassroomSnapshot['removedReviewArtifacts'][number],
          ): boolean => {
            if (scope.mode === 'review') {
              if (artifact.conceptId !== scope.conceptId)
                return false
              return artifact.type === 'clarification'
                ? artifact.contentVersion === scope.contentVersion
                : displayedReviewPack !== null
                  && remediationProvenance.resolve(artifact)
                    ?.learningContractVersion
                    === displayedReviewPack.learningContractVersion
            }
            if (
              activeTrack === null
              || !activeTrackConceptIds.has(artifact.conceptId)
            ) {
              return false
            }
            if (artifact.type === 'clarification') {
              return artifact.contentVersion
                === activeTrack.contentVersions[artifact.conceptId]
            }
            return remediationProvenance.resolve(artifact)
              ?.learningContractVersion
              === activeTrackContractVersions.get(artifact.conceptId)
          }
          const remediationBelongsToActiveTrack = (
            artifact: Extract<ReviewArtifact, { type: 'remediation' }>,
          ): boolean => scope.mode === 'live'
            && scope.learningTrackId !== null
            && artifact.attemptIds.every((attemptId) => {
              const attempt = attemptsById.get(attemptId)
              return attempt !== undefined
                && exerciseById.get(attempt.exerciseInstanceId)
                  ?.learningTrackId === scope.learningTrackId
            })
          const catalogSummaries = catalog.list()
          const catalogSummaryByConcept = new Map(
            catalogSummaries.map(summary => [summary.conceptId, summary]),
          )
          const selectedConceptIds: string[] = []
          const selectedConceptSet = new Set<string>()
          const addConcept = (conceptId: string | null) => {
            if (
              conceptId === null
              || selectedConceptIds.length === CLASSROOM_CONCEPT_LIMIT
              || selectedConceptSet.has(conceptId)
              || !catalogSummaryByConcept.has(conceptId)
            ) {
              return
            }
            selectedConceptSet.add(conceptId)
            selectedConceptIds.push(conceptId)
          }
          addConcept(scopeConceptId)
          addConcept(trackPolicy?.frontierConceptId ?? null)
          addConcept(trackPolicy?.adjustmentTargetConceptId ?? null)
          for (const conceptId of activeTrack?.conceptIds ?? []) {
            addConcept(conceptId)
            if (selectedConceptIds.length === CLASSROOM_CONCEPT_LIMIT)
              break
          }
          if (selectedConceptIds.length < CLASSROOM_CONCEPT_LIMIT) {
            for (const summary of catalogSummaries) {
              addConcept(summary.conceptId)
              if (selectedConceptIds.length === CLASSROOM_CONCEPT_LIMIT)
                break
            }
          }
          const concepts = selectedConceptIds.map((conceptId) => {
            const summary = catalogSummaryByConcept.get(conceptId)
            if (!summary)
              throw new Error(`Course Content Pack ${conceptId} disappeared.`)
            const currentVersion = summary.version
            const trackContentVersion = activeTrack?.contentVersions[summary.conceptId] ?? null
            const displayedReviewContentVersion
              = scope.mode === 'review'
                && scope.conceptId === summary.conceptId
                ? scope.contentVersion
                : null
            const version = displayedReviewContentVersion
              ?? trackContentVersion
              ?? currentVersion
            const pack = catalog.getVersion(summary.conceptId, version)
            const availability = catalog.availability(summary.conceptId, version)
              ?? summary.availability
            const projected = projectContentPackSummary({
              conceptId: summary.conceptId,
              title: pack?.concept.title ?? summary.title,
              version,
              availability,
              availabilityReason: availability === 'validated'
                ? null
                : version === currentVersion
                  ? summary.availabilityReason
                  : 'editorial_review',
            })
            return {
              ...projected,
              currentVersion,
              currentAvailability: summary.availability,
              trackContentVersion,
              progress: availability === 'validated' && pack
                ? deriveConceptProgress(snapshot, pack)
                : null,
            }
          })
          const scopedAttemptWindow = collectRecentMatching(
            snapshot.attempts,
            RECENT_ATTEMPT_LIMIT,
            (attempt) => {
              const instance = exerciseById.get(attempt.exerciseInstanceId)
              return scope.mode === 'live'
                ? instance?.learningTrackId === scope.learningTrackId
                : instance?.conceptId === scope.conceptId
                  && instance.contentVersion === scope.contentVersion
            },
          )
          const recentAttempts = scopedAttemptWindow.items
            .map((attempt) => {
              const learningTrackId
                = exerciseTrackIds.get(attempt.exerciseInstanceId) ?? null
              return {
                id: attempt.id,
                exerciseInstanceId: attempt.exerciseInstanceId,
                learningTrackId,
                learningTrackGoal: learningTrackId === null
                  ? null
                  : trackGoals.get(learningTrackId) ?? null,
                passed: attempt.result.passed,
                assistance: attempt.assistance,
                createdAt: attempt.createdAt,
              }
            })
          const scopedEvidenceWindow = collectRecentMatching(
            snapshot.evidence,
            RECENT_EVIDENCE_LIMIT,
            (item) => {
              if (scope.mode === 'review') {
                return displayedReviewPack !== null
                  && item.conceptId === scope.conceptId
                  && item.learningContractVersion
                  === displayedReviewPack.learningContractVersion
              }
              return item.exerciseInstanceId !== undefined
                && exerciseTrackIds.get(item.exerciseInstanceId)
                === scope.learningTrackId
            },
          )
          const recentEvidence = scopedEvidenceWindow.items
            .map((item) => {
              const learningTrackId = item.exerciseInstanceId === undefined
                ? null
                : exerciseTrackIds.get(item.exerciseInstanceId) ?? null
              return {
                id: item.id,
                type: item.type,
                outcome: item.outcome,
                conceptId: item.conceptId,
                learningSkillId: item.learningSkillId,
                contentVersion: item.contentVersion,
                learningContractVersion: item.learningContractVersion,
                templateId: item.templateId,
                templateVersion: item.templateVersion,
                exerciseInstanceId: item.exerciseInstanceId,
                attemptId: item.attemptId,
                createdAt: item.createdAt,
                learningTrackId,
                learningTrackGoal: learningTrackId === null
                  ? null
                  : trackGoals.get(learningTrackId) ?? null,
              }
            })
          const scopedExerciseWindow = collectRecentMatching(
            exerciseInstances,
            ACTIVE_EXERCISE_LIMIT,
            instance => scope.mode === 'live'
              ? instance.learningTrackId === scope.learningTrackId
              : instance.conceptId === scope.conceptId
                && instance.contentVersion === scope.contentVersion,
          )
          const recentExercises = scopedExerciseWindow.items
          const attemptCounts = new Map<string, number>()
          const passedExercises = new Set<string>()
          for (const attempt of snapshot.attempts) {
            attemptCounts.set(
              attempt.exerciseInstanceId,
              (attemptCounts.get(attempt.exerciseInstanceId) ?? 0) + 1,
            )
            if (attempt.result.passed)
              passedExercises.add(attempt.exerciseInstanceId)
          }
          const assistanceByExercise = new Map<string, Set<string>>()
          for (const event of snapshot.assistanceEvents) {
            const types = assistanceByExercise.get(event.exerciseInstanceId)
              ?? new Set<string>()
            types.add(event.type)
            assistanceByExercise.set(event.exerciseInstanceId, types)
          }
          const activeExercises = recentExercises.map((instance) => {
            const eligibility = assessmentHistory.projectCurrentEligibility(instance)
            return {
              id: instance.id,
              learningTrackId: instance.learningTrackId,
              learningTrackGoal: instance.learningTrackId === null
                ? null
                : trackGoals.get(instance.learningTrackId) ?? null,
              conceptId: instance.conceptId,
              contentVersion: instance.contentVersion,
              learningContractVersion: instance.learningContractVersion,
              learningSkillId: instance.learningSkillId,
              templateId: instance.templateId,
              templateVersion: instance.templateVersion,
              purpose: instance.purpose,
              effectiveDifficulty: instance.effectiveDifficulty,
              personalizationInputs: instance.personalizationInputs,
              taskType: instance.task.type,
              prompt: instance.task.type === 'quiz'
                ? instance.task.questions.slice(0, 8).map(question =>
                    boundedDiagnosticText(question.question, 1_000))
                : boundedDiagnosticText(instance.task.prompt, 4_000),
              promptTruncated: instance.task.type === 'quiz'
                ? instance.task.questions.some(question =>
                    question.question.length > 1_000)
                : instance.task.prompt.length > 4_000,
              instanceAttemptCount: attemptCounts.get(instance.id) ?? 0,
              instancePassed: passedExercises.has(instance.id),
              instanceAssistanceTypes: [
                ...(assistanceByExercise.get(instance.id) ?? []),
              ],
              assessmentEligibility: eligibility,
            }
          })
          const scopedArtifactGroups = groupReviewArtifacts(
            snapshot.reviewArtifacts.filter(retainedArtifactMatchesScope),
            {
              learningContractVersionFor: artifact =>
                remediationProvenance.resolve(artifact)
                  ?.learningContractVersion ?? null,
            },
          ).sort((left, right) =>
            left.representative.updatedRevision
            - right.representative.updatedRevision
            || compareIds(left.representative.id, right.representative.id))
          const recentArtifactGroups = scopedArtifactGroups.slice(
            -RETAINED_ARTIFACT_LIMIT,
          )
          const retainedArtifacts = recentArtifactGroups.map((group) => {
            const artifact = group.representative
            const artifactIds = group.artifacts
              .slice(-ARTIFACT_PROVENANCE_ID_LIMIT)
              .map(item => item.id)
            const failedAttempts = recentRemediationAttemptIds(
              group.artifacts,
              ARTIFACT_PROVENANCE_ID_LIMIT,
            )
            return {
              id: artifact.id,
              artifactIds,
              artifactCount: group.artifacts.length,
              artifactIdsTruncated: artifactIds.length < group.artifacts.length,
              type: artifact.type,
              conceptId: artifact.conceptId,
              misconceptionTheme: artifact.misconceptionTheme,
              markdown: artifact.markdown,
              ...(artifact.type === 'remediation'
                ? {
                    learningSkillId: artifact.learningSkillId,
                    learningContractVersion: group.learningContractVersion,
                    diagnosticStatus: artifact.diagnosticStatus,
                    failedAttemptIds: failedAttempts.ids,
                    failedAttemptCount: failedAttempts.matchedCount,
                    failedAttemptIdsTruncated:
                    failedAttempts.matchedCount > failedAttempts.ids.length,
                  }
                : {
                    contentVersion: artifact.contentVersion,
                    retainedAsReadOnly: artifact.retainedAsReadOnly,
                  }),
            }
          })
          const pendingRemediationWindow = collectMostRecentMatching(
            snapshot.reviewArtifacts,
            PENDING_REMEDIATION_LIMIT,
            (artifact): artifact is Extract<
              ClassroomSnapshot['reviewArtifacts'][number],
              { type: 'remediation' }
            > =>
              artifact.type === 'remediation'
              && artifact.diagnosticStatus === 'pending'
              && retainedArtifactMatchesScope(artifact)
              && (
                scope.mode === 'review'
                || remediationBelongsToActiveTrack(artifact)
              ),
            (left, right) =>
              left.updatedRevision - right.updatedRevision
              || compareIds(left.id, right.id),
          )
          const pendingRemediations = pendingRemediationWindow.items
            .map(artifact => ({
              id: artifact.id,
              conceptId: artifact.conceptId,
              learningSkillId: artifact.learningSkillId,
              failedAttemptIds: artifact.attemptIds.slice(
                -ARTIFACT_PROVENANCE_ID_LIMIT,
              ),
              failedAttemptCount: artifact.attemptIds.length,
              failedAttemptIdsTruncated:
              artifact.attemptIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
              evidenceIds: artifact.evidenceIds.slice(
                -ARTIFACT_PROVENANCE_ID_LIMIT,
              ),
              evidenceCount: artifact.evidenceIds.length,
              evidenceIdsTruncated:
              artifact.evidenceIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
            }))
          const suppressionWindow = collectMostRecentMatching(
            snapshot.removedReviewArtifacts,
            RETENTION_SUPPRESSION_LIMIT,
            artifact =>
              artifact.suppressionActive
              && retainedArtifactMatchesScope(artifact),
            (left, right) =>
              left.removedRevision - right.removedRevision
              || compareIds(left.id, right.id),
          )
          const activeRetentionSuppressions = suppressionWindow.items
            .map(artifact => ({
              id: artifact.id,
              type: artifact.type,
              conceptId: artifact.conceptId,
              misconceptionTheme: artifact.misconceptionTheme,
              ...(artifact.type === 'remediation'
                ? {
                    learningSkillId: artifact.learningSkillId,
                    learningContractVersion:
                      remediationProvenance.resolve(artifact)
                        ?.learningContractVersion ?? null,
                    failedAttemptIds: artifact.attemptIds.slice(
                      -ARTIFACT_PROVENANCE_ID_LIMIT,
                    ),
                    failedAttemptCount: artifact.attemptIds.length,
                    failedAttemptIdsTruncated:
                    artifact.attemptIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
                  }
                : {
                    contentVersion: artifact.contentVersion,
                  }),
            }))
          return ok({
            teacherExposureActive: snapshot.teacherExposureEpoch !== null,
            activeTrack: activeTrackProjection?.track ?? null,
            activeTrackBounds: activeTrackProjection?.bounds ?? null,
            trackPolicy,
            trackPolicyBounds,
            concepts,
            chatScope: scope,
            displayedReviewContentVersion: scope.mode === 'review'
              ? scope.contentVersion
              : null,
            recentAttempts,
            recentEvidence,
            activeExercises,
            retainedArtifacts,
            pendingRemediations,
            activeRetentionSuppressions,
            collectionBounds: {
              concepts: collectionBounds(
                catalogSummaries.length,
                concepts.length,
                CLASSROOM_CONCEPT_LIMIT,
                'scope-priority',
              ),
              recentAttempts: collectionBounds(
                scopedAttemptWindow.matchedCount,
                recentAttempts.length,
                RECENT_ATTEMPT_LIMIT,
                'recent',
              ),
              recentEvidence: collectionBounds(
                scopedEvidenceWindow.matchedCount,
                recentEvidence.length,
                RECENT_EVIDENCE_LIMIT,
                'recent',
              ),
              activeExercises: collectionBounds(
                scopedExerciseWindow.matchedCount,
                activeExercises.length,
                ACTIVE_EXERCISE_LIMIT,
                'recent',
              ),
              retainedArtifacts: collectionBounds(
                scopedArtifactGroups.length,
                retainedArtifacts.length,
                RETAINED_ARTIFACT_LIMIT,
                'recent',
              ),
              pendingRemediations: collectionBounds(
                pendingRemediationWindow.matchedCount,
                pendingRemediations.length,
                PENDING_REMEDIATION_LIMIT,
                'recent',
              ),
              activeRetentionSuppressions: collectionBounds(
                suppressionWindow.matchedCount,
                activeRetentionSuppressions.length,
                RETENTION_SUPPRESSION_LIMIT,
                'recent',
              ),
            },
          })
        },
      ),
    }),
    list_content_packs: tool({
      description: 'List one deterministic page of Course Content Packs and whether each Concept is validated or read-only. Follow nextOffset to inspect later pages. Only validated Concepts can drive mainline tutoring.',
      inputSchema: z.object({
        offset: z.number().int().min(0).max(1_024).default(0),
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async ({ offset = 0 }) => {
          const summaries = catalog.list()
          const packs = summaries
            .slice(offset, offset + CONTENT_PACK_SUMMARY_LIMIT)
            .map(projectContentPackSummary)
          const nextOffset = offset + packs.length < summaries.length
            ? offset + packs.length
            : null
          return ok({
            packs,
            bounds: collectionBounds(
              summaries.length,
              packs.length,
              CONTENT_PACK_SUMMARY_LIMIT,
              'page',
            ),
            page: {
              offset,
              nextOffset,
              totalCount: summaries.length,
            },
          })
        },
      ),
    }),
    read_content_pack: tool({
      description: 'Read one exact immutable Content Version with Core Content, Learning Skills, learner-visible Exercise Template metadata, and aggregate-derived unresolved failure candidates for each Learning Skill. Evaluator answers, source requirements, explanations, and hidden hints are private to the aggregate. Content-dependent mutations require this exact version to have been read in the same Teacher turn.',
      inputSchema: z.object({
        conceptId: toolIdSchema,
        contentVersion: toolVersionSchema,
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async ({ conceptId, contentVersion }, options) => {
          const pack = catalog.getVersion(conceptId, contentVersion)
          if (!pack)
            return fail(`No Course Content Pack for ${conceptId}@${contentVersion}.`)
          const projection = teacherReadablePack(pack)
          const snapshot = classroom.read()
          const unresolvedFailureEvidence = pack.learningSkills.flatMap(
            (skill) => {
              const evidenceIds = deriveUnresolvedFailureEvidenceIds(snapshot, {
                conceptId,
                learningSkillId: skill.id,
                learningContractVersion: pack.learningContractVersion,
              })
              return evidenceIds.length === 0
                ? []
                : [{
                    learningSkillId: skill.id,
                    evidenceIds,
                  }]
            },
          )
          if (!toolCallBudget.recordReadContentVersion(
            options,
            conceptId,
            contentVersion,
          )) {
            return fail('Teacher turn ended before the Content Pack read completed.')
          }
          return ok({
            availability: catalog.availability(conceptId, contentVersion),
            pack: projection.pack,
            personalizationCandidates: {
              unresolvedFailureEvidence,
            },
            truncation: projection.truncation,
          })
        },
      ),
    }),
    append_content_reference_group: tool({
      description: 'Append an ordered subset of immutable Core Content references for one Tutoring Step. The aggregate rejects unknown, repeated, reordered, out-of-track, or read-only content.',
      inputSchema: z.object({
        conceptId: toolIdSchema,
        learningSkillId: toolIdSchema,
        blockIds: z.array(toolIdSchema).min(1).max(MAX_CONTENT_PACK_BLOCKS),
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (input, options) => {
          const scope = getChatScope()
          if (scope.mode === 'review')
            return fail('Review-scoped Chat cannot append mainline Core Content.')
          const learningTrackId = scope.learningTrackId
          if (!learningTrackId)
            return fail('Start a Learning Track before appending Core Content.')
          const contentVersion = pinnedTrackContentVersion(
            classroom,
            learningTrackId,
            input.conceptId,
          )
          if (!contentVersion) {
            return fail(
              `No active Track Content Version for ${input.conceptId}.`,
            )
          }
          const unread = requireSameTurnContentRead(
            toolCallBudget,
            options,
            input.conceptId,
            contentVersion,
            {
              blockIds: input.blockIds,
              learningSkillId: input.learningSkillId,
            },
          )
          if (unread)
            return unread
          return executeIdentifiedMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            'append_content_reference_group',
            tutoringStepId => ({
              type: 'append_content_reference_group',
              learningTrackId,
              tutoringStepId,
              ...input,
            }),
          )
        },
      ),
    }),
    append_bridge_note: tool({
      description: 'Append a short path-orientation note around Core Content. It is at most two paragraphs and cannot contain headings or fenced code. This does not replace, restate, or enter Review View as Core Content.',
      inputSchema: z.object({
        conceptId: toolIdSchema,
        markdown: bridgeNoteMarkdownSchema,
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (input, options) => {
          const scope = getChatScope()
          if (scope.mode === 'review')
            return fail('Review-scoped Chat cannot append a Live View Bridge Note.')
          const learningTrackId = scope.learningTrackId
          if (!learningTrackId)
            return fail('Start a Learning Track before appending a Bridge Note.')
          const contentVersion = pinnedTrackContentVersion(
            classroom,
            learningTrackId,
            input.conceptId,
          )
          if (!contentVersion) {
            return fail(
              `No active Track Content Version for ${input.conceptId}.`,
            )
          }
          const unread = requireSameTurnContentRead(
            toolCallBudget,
            options,
            input.conceptId,
            contentVersion,
          )
          if (unread)
            return unread
          return executeIdentifiedMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            'append_bridge_note',
            tutoringStepId => ({
              type: 'append_bridge_note',
              teacherInteractionId: createTeacherInteractionId(),
              learningTrackId,
              tutoringStepId,
              ...input,
            }),
          )
        },
      ),
    }),
    append_skip_marker: tool({
      description: 'Record an important ordered Core Content subset skipped in the current Learning Track using one exact basis from read_classroom_state.trackPolicy.skipMarkerBasisCandidates. A basis is available only after an Accelerate/Delay adjustment for this Concept or current successful observable Evidence across all key Learning Skills. The displayed explanation is system-derived.',
      inputSchema: z.object({
        conceptId: toolIdSchema,
        blockIds: z.array(toolIdSchema).min(1).max(MAX_CONTENT_PACK_BLOCKS),
        basis: skipMarkerBasisSchema,
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (input, options) => {
          const scope = getChatScope()
          if (scope.mode === 'review')
            return fail('Review-scoped Chat cannot append a Live View Skip Marker.')
          const learningTrackId = scope.learningTrackId
          if (!learningTrackId)
            return fail('Start a Learning Track before appending a Skip Marker.')
          const contentVersion = pinnedTrackContentVersion(
            classroom,
            learningTrackId,
            input.conceptId,
          )
          if (!contentVersion) {
            return fail(
              `No active Track Content Version for ${input.conceptId}.`,
            )
          }
          const unread = requireSameTurnContentRead(
            toolCallBudget,
            options,
            input.conceptId,
            contentVersion,
            { blockIds: input.blockIds },
          )
          if (unread)
            return unread
          const snapshot = classroom.read()
          const track = snapshot.tracks.find(
            candidate => candidate.id === learningTrackId,
          )
          const exactBasis = track
            ? deriveSkipMarkerBasisCandidates(snapshot, track, catalog)
                .some(candidate =>
                  candidate.conceptId === input.conceptId
                  && JSON.stringify(candidate.basis)
                  === JSON.stringify(input.basis))
            : false
          if (!exactBasis) {
            return fail(
              'Skip Marker basis no longer matches a current full-state candidate. '
              + 'Re-read classroom state before retrying.',
            )
          }
          return executeIdentifiedMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            'append_skip_marker',
            tutoringStepId => ({
              type: 'append_skip_marker',
              learningTrackId,
              tutoringStepId,
              ...input,
            }),
          )
        },
      ),
    }),
    create_exercise_instance: tool({
      description: 'Create a learner Exercise Instance from an existing Exercise Template. Omit difficulty for Standard (starter, no hints), request Easy for authored hints plus starter, or Hard for neither; Easy fails when the template has no authored hints. Copy unresolvedFailureEvidenceIds only from the exact Learning Skill candidates returned by read_content_pack; applicable failure/remediation references select Easy and cannot be combined with Hard. Expected answers and evaluator requirements never change. Placement Checks accept no personalization, and no ad-hoc task text is accepted.',
      inputSchema: z.object({
        conceptId: toolIdSchema,
        contentVersion: toolVersionSchema,
        templateId: toolIdSchema,
        personalizationInputs: personalizationInputsSchema.partial().default({}),
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (input, options) => {
          const scope = getChatScope()
          const learningTrackId = scope.learningTrackId
          if (!learningTrackId)
            return fail('Start a Learning Track before creating an Exercise Instance.')
          const pack = catalog.getVersion(
            input.conceptId,
            input.contentVersion,
          )
          const template = pack?.exerciseTemplates.find(
            item => item.id === input.templateId,
          )
          if (scope.mode === 'review') {
            if (scope.conceptId !== input.conceptId)
              return fail(`Review Chat is scoped to ${scope.conceptId}.`)
            if (scope.contentVersion !== input.contentVersion) {
              return fail(
                `Review Chat is scoped to displayed Content Version `
                + `${scope.contentVersion}.`,
              )
            }
            if (template?.purpose !== 'review')
              return fail('Review-scoped Chat can create only a Review Check.')
          }
          else if (template?.purpose === 'review') {
            return fail(
              'Live Chat cannot create a Review Check; open Review View.',
            )
          }
          const requestedFailureEvidenceIds
            = input.personalizationInputs.unresolvedFailureEvidenceIds ?? []
          if (requestedFailureEvidenceIds.length > 0) {
            const candidates = template && pack
              ? new Set(deriveUnresolvedFailureEvidenceIds(
                  classroom.read(),
                  {
                    conceptId: input.conceptId,
                    learningSkillId: template.learningSkillId,
                    learningContractVersion: pack.learningContractVersion,
                  },
                ))
              : new Set<string>()
            if (requestedFailureEvidenceIds.some(
              (id: string) => !candidates.has(id),
            )) {
              return fail(
                'unresolvedFailureEvidenceIds must copy current exact candidates '
                + 'from read_content_pack for this Learning Skill.',
              )
            }
          }
          const unread = requireSameTurnContentRead(
            toolCallBudget,
            options,
            input.conceptId,
            input.contentVersion,
            { templateId: input.templateId },
          )
          if (unread)
            return unread
          return executeIdentifiedMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            'create_exercise_instance',
            tutoringStepId => scope.mode === 'review'
              ? {
                  type: 'create_review_check',
                  learningTrackId,
                  tutoringStepId,
                  ...input,
                }
              : {
                  type: 'create_exercise_instance',
                  learningTrackId,
                  tutoringStepId,
                  ...input,
                },
          )
        },
      ),
    }),
    record_track_adjustment: tool({
      description: 'Record one evidence-backed Learning Track adjustment using an exact candidate returned by read_classroom_state.trackPolicy.adjustmentCandidates. Acceleration requires successful independent Placement Evidence; Focused Catch-Up requires failed Placement Evidence; Review requires an earlier encounter; Delay uses the fixed three-failure witness and exact next target. The aggregate revalidates every reference.',
      inputSchema: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('accelerate'),
          conceptId: toolIdSchema,
          placementEvidenceId: toolIdSchema,
        }).strict(),
        z.object({
          type: z.literal('focused_catch_up'),
          conceptId: toolIdSchema,
          failureEvidenceId: toolIdSchema,
        }).strict(),
        z.object({
          type: z.literal('review'),
          conceptId: toolIdSchema,
          encounteredStreamEntryId: toolIdSchema,
        }).strict(),
        z.object({
          type: z.literal('delay'),
          conceptId: toolIdSchema,
          nextConceptId: toolIdSchema,
          blockedEvidenceIds: z.array(toolIdSchema).length(3),
        }).strict(),
      ]),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (adjustment, options) => {
          const scope = getChatScope()
          if (scope.mode === 'review')
            return fail('Review-scoped Chat cannot adjust the active Learning Track.')
          const learningTrackId = scope.learningTrackId
          if (!learningTrackId)
            return fail('Start a Learning Track before adjusting it.')
          const snapshot = classroom.read()
          const track = snapshot.tracks.find(
            candidate => candidate.id === learningTrackId,
          )
          if (!track)
            return fail('The active Learning Track no longer exists. Re-read classroom state.')
          const candidates = deriveTrackPolicyState(
            snapshot,
            track,
            catalog,
          ).adjustmentCandidates
          const isCurrentCandidate = adjustment.type === 'accelerate'
            ? candidates.accelerate.some(candidate =>
                candidate.conceptId === adjustment.conceptId
                && candidate.placementEvidenceId
                === adjustment.placementEvidenceId)
            : adjustment.type === 'focused_catch_up'
              ? candidates.focusedCatchUp.some(candidate =>
                  candidate.conceptId === adjustment.conceptId
                  && candidate.failureEvidenceId
                  === adjustment.failureEvidenceId)
              : adjustment.type === 'review'
                ? candidates.review.some(candidate =>
                    candidate.conceptId === adjustment.conceptId
                    && candidate.encounteredStreamEntryId
                    === adjustment.encounteredStreamEntryId)
                : candidates.delay !== null
                  && candidates.delay.conceptId === adjustment.conceptId
                  && candidates.delay.nextConceptId === adjustment.nextConceptId
                  && candidates.delay.blockedEvidenceIds.every(
                    (id, index) => adjustment.blockedEvidenceIds[index] === id,
                  )
          if (!isCurrentCandidate) {
            return fail(
              'Track Adjustment no longer matches a current full-state candidate. '
              + 'Re-read classroom state before retrying.',
            )
          }
          return executeMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            () => ({
              type: 'adjust_learning_track',
              learningTrackId,
              adjustment,
            }),
          )
        },
      ),
    }),
    retain_clarification: tool({
      description: 'Retain a concise reusable personalized re-explanation for one exact Content Version. Live Track Concepts must use their Track pin; exact versions read for out-of-Track or Review help remain eligible. Repeated themes merge.',
      inputSchema: z.object({
        conceptId: toolIdSchema,
        contentVersion: toolVersionSchema,
        misconceptionTheme: z.string().trim().min(1).max(160),
        markdown: z.string().trim().min(1).max(1_200),
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async (input, options) => {
          const scope = getChatScope()
          if (scope.mode === 'review' && scope.conceptId !== input.conceptId)
            return fail(`Review Chat is scoped to ${scope.conceptId}.`)
          if (
            scope.mode === 'review'
            && scope.contentVersion !== input.contentVersion
          ) {
            return fail(
              `Review Chat is scoped to displayed Content Version `
              + `${scope.contentVersion}.`,
            )
          }
          if (!catalog.getVersion(input.conceptId, input.contentVersion)) {
            return fail(
              `No Course Content Pack for ${input.conceptId}@${input.contentVersion}.`,
            )
          }
          let learningTrackId: string | null = null
          if (scope.mode === 'live') {
            const snapshot = classroom.read()
            const activeTrack = snapshot.tracks.find(track =>
              track.id === scope.learningTrackId)
            const trackContentVersion = activeTrack?.contentVersions[input.conceptId]
            if (trackContentVersion && input.contentVersion !== trackContentVersion) {
              return fail(
                `Live Track Concept ${input.conceptId} must use Content Version `
                + `${trackContentVersion}.`,
              )
            }
            if (trackContentVersion)
              learningTrackId = scope.learningTrackId
          }
          const unread = requireSameTurnContentRead(
            toolCallBudget,
            options,
            input.conceptId,
            input.contentVersion,
          )
          if (unread)
            return unread
          return executeIdentifiedMutation(
            classroom,
            mutationBudget,
            toolCallBudget,
            options,
            'retain_clarification',
            artifactId => ({
              type: 'retain_clarification',
              learningTrackId,
              artifactId,
              ...input,
            }),
          )
        },
      ),
    }),
    search_docs: tool({
      description: 'Search authoritative Cangjie documentation for Out-of-Pack Help. Search before making factual claims not already present in a Course Content Pack.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(300),
        limit: z.number().int().min(1).max(8).default(5),
      }).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'documentation-search',
        async ({ query, limit }, options) => withAbort(
          options,
          async (signal) => {
            try {
              const rawHits: unknown = await knowledge.search(query, { limit, signal })
              return ok(projectKnowledgeHits(rawHits, limit))
            }
            catch (error) {
              if (!(error instanceof KnowledgeSourceError))
                throw error
              return fail(error.failure === 'unavailable'
                ? 'Authoritative Cangjie documentation is currently unavailable.'
                : 'Authoritative Cangjie documentation returned an invalid response.')
            }
          },
        ),
      ),
    }),
    read_editor_code: tool({
      description: 'Read the learner-visible active editor for contextual help. This is read-only; propose changes in Chat and let the learner decide whether to apply them.',
      inputSchema: z.object({}).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async () => {
          const code = editor.getCode()
          if (code === null) {
            return ok({
              code: null,
              truncated: false,
              originalLength: 0,
              characterLimit: EDITOR_CODE_CHARACTER_LIMIT,
            })
          }
          return ok({
            code: code.slice(0, EDITOR_CODE_CHARACTER_LIMIT),
            truncated: code.length > EDITOR_CODE_CHARACTER_LIMIT,
            originalLength: code.length,
            characterLimit: EDITOR_CODE_CHARACTER_LIMIT,
          })
        },
      ),
    }),
    list_playground_tabs: tool({
      description: 'List learner-visible temporary Playground tabs. Playground work does not create Learning Evidence.',
      inputSchema: z.object({}).strict(),
      execute: withTeacherToolCallBudget(
        toolCallBudget,
        'general',
        async () => {
          const rawTabs: unknown = playground.listTabs()
          return ok(projectPlaygroundTabs(rawTabs))
        },
      ),
    }),
  }
}
