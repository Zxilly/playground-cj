import type {
  ClassroomEvent,
  ClassroomSession,
  ClassroomStreamItem,
  ClassroomTrackState,
  ContentReference,
  ExerciseInstance,
  LearnerState,
  LearningEvidence,
  ReviewArtifact,
  ReviewExposure,
  RunResult,
  TrackAdjustment,
} from './types'
import { z } from 'zod'
import { unflattenCodeEscapes } from '@/lib/ai/unflatten-code-escapes'

const codeString = z.string().transform(unflattenCodeEscapes)

const richTextSpanSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({ type: z.literal('code'), code: codeString, lang: z.string().optional() }).strict(),
  z.object({ type: z.literal('strong'), text: z.string() }).strict(),
])

export const richTextSchema = z.union([
  z.string().transform(s => [{ type: 'text' as const, text: s }]),
  z.array(richTextSpanSchema).min(1),
])

export const markdownBodySchema = z.string()

export const codeHighlightSchema = z.object({
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1).optional(),
  label: z.string().optional(),
}).strict()

export const lessonContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    text: z.string(),
    level: z.union([z.literal(2), z.literal(3)]).optional(),
  }).strict(),
  z.object({
    type: z.literal('paragraph'),
    body: markdownBodySchema,
  }).strict(),
  z.object({
    type: z.literal('concept_card'),
    conceptId: z.string(),
    title: z.string(),
    body: markdownBodySchema,
  }).strict(),
  z.object({
    type: z.literal('code_example'),
    title: z.string().optional(),
    code: codeString,
    language: z.string().optional(),
    highlights: z.array(codeHighlightSchema).optional(),
  }).strict(),
  z.object({
    type: z.literal('callout'),
    tone: z.union([z.literal('note'), z.literal('warning'), z.literal('tip')]),
    title: z.string().optional(),
    body: markdownBodySchema,
  }).strict(),
  z.object({
    type: z.literal('steps'),
    title: z.string().optional(),
    items: z.array(richTextSchema).min(1),
  }).strict(),
  z.object({
    type: z.literal('compare'),
    leftTitle: z.string(),
    left: richTextSchema,
    rightTitle: z.string(),
    right: richTextSchema,
  }).strict(),
])

export const lessonContentBlocksSchema = z.array(lessonContentBlockSchema)

export type LessonContentBlockInput = z.infer<typeof lessonContentBlockSchema>

export const classroomPhaseSchema = z.enum(['orient', 'teach', 'practice', 'review'])
export const exerciseMatchModeSchema = z.enum(['exact', 'contains', 'regex'])
export const exerciseIntentSchema = z.enum(['mainline', 'placement_check', 'review_check'])
export const exerciseStatusSchema = z.enum(['active', 'success', 'skip', 'superseded'])
export const evidenceOutcomeSchema = z.enum(['success', 'failure', 'skip', 'self_report'])
export const evidenceStrengthSchema = z.enum(['independent', 'aided', 'self_report', 'mastery', 'stale'])
export const conceptStatusSchema = z.enum(['unseen', 'seen', 'practicing', 'demonstrated', 'mastered', 'blocked', 'stale'])
export const reviewExposureStatusSchema = z.enum(['seen', 'skipped', 'unseen'])
export const reviewArtifactKindSchema = z.enum(['clarification', 'read_only_clarification', 'remediation'])
export const chatIntentKindSchema = z.enum(['advance', 'go_deeper', 'slow_down', 'change_topic', 'explain_error', 'review_check'])
export const exerciseAttemptModeSchema = z.enum(['run', 'submit'])
export const runFailureKindSchema = z.enum(['runner_unavailable'])

export const contentReferenceSchema: z.ZodType<ContentReference> = z.object({
  packId: z.string(),
  contentVersion: z.string(),
  blockId: z.string(),
  conceptId: z.string(),
}).strict()

export const exerciseInstanceSchema: z.ZodType<ExerciseInstance> = z.object({
  id: z.string(),
  templateId: z.string(),
  templateVersion: z.string(),
  skillId: z.string(),
  conceptIds: z.array(z.string()).min(1),
  prompt: markdownBodySchema,
  starterCode: codeString,
  expectedOutput: z.string(),
  matchMode: exerciseMatchModeSchema,
  status: exerciseStatusSchema,
  intent: exerciseIntentSchema,
  personalizationInputs: z.object({
    summary: z.string(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  }).strict(),
  createdAt: z.number(),
}).strict()

export const learningEvidenceSchema: z.ZodType<LearningEvidence> = z.object({
  evidenceId: z.string(),
  skillId: z.string(),
  conceptIds: z.array(z.string()).min(1),
  exerciseInstanceId: z.string().optional(),
  exerciseIntent: exerciseIntentSchema.optional(),
  outcome: evidenceOutcomeSchema,
  strength: evidenceStrengthSchema,
  summary: z.string(),
  createdAt: z.number(),
  runResultId: z.string().optional(),
}).strict()

export const reviewExposureSchema: z.ZodType<ReviewExposure> = z.object({
  blockId: z.string(),
  conceptId: z.string(),
  contentVersion: z.string(),
  status: reviewExposureStatusSchema,
  updatedAt: z.number(),
}).strict()

export const reviewArtifactSchema: z.ZodType<ReviewArtifact> = z.object({
  artifactId: z.string(),
  kind: reviewArtifactKindSchema,
  conceptId: z.string(),
  skillId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  summary: z.string(),
  evidenceIds: z.array(z.string()),
  createdAt: z.number(),
  removedAt: z.number().optional(),
}).strict()

export const learnerStateSchema: z.ZodType<LearnerState> = z.object({
  evidence: z.array(learningEvidenceSchema),
  reviewExposures: z.record(z.string(), reviewExposureSchema),
  reviewArtifacts: z.array(reviewArtifactSchema),
}).strict()

export const runResultSchema: z.ZodType<RunResult> = z.object({
  ok: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().nullable(),
  durationMs: z.number().optional(),
  compilerOutput: z.string().optional(),
  attemptMode: exerciseAttemptModeSchema.optional(),
  failureKind: runFailureKindSchema.optional(),
}).strict()

export const classroomEventSchema: z.ZodType<ClassroomEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('classroom_opened'), createdAt: z.number(), summary: z.string().optional(), requestedConceptId: z.string().optional() }).strict(),
  z.object({ type: z.literal('exercise_success'), exerciseInstanceId: z.string(), exerciseIntent: exerciseIntentSchema.optional(), skillId: z.string(), conceptIds: z.array(z.string()).min(1), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('exercise_skip'), exerciseInstanceId: z.string(), exerciseIntent: exerciseIntentSchema.optional(), skillId: z.string(), conceptIds: z.array(z.string()).min(1), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({
    type: z.literal('exercise_failure'),
    exerciseInstanceId: z.string(),
    exerciseIntent: exerciseIntentSchema.optional(),
    templateId: z.string(),
    skillId: z.string(),
    conceptIds: z.array(z.string()).min(1),
    prompt: z.string(),
    attemptedCode: z.string(),
    expectedOutput: z.string(),
    actualOutput: z.string(),
    summary: z.string(),
    createdAt: z.number(),
  }).strict(),
  z.object({ type: z.literal('chat_intent'), intent: chatIntentKindSchema, summary: z.string(), activeConceptId: z.string().optional(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('lesson_generation_error'), summary: z.string(), createdAt: z.number() }).strict(),
])

export const classroomStreamItemSchema: z.ZodType<ClassroomStreamItem> = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('content_reference_group'),
    groupId: z.string(),
    conceptId: z.string(),
    skillId: z.string().optional(),
    title: z.string().optional(),
    references: z.array(contentReferenceSchema).min(1),
    createdAt: z.number(),
  }).strict(),
  z.object({ id: z.string(), type: z.literal('bridge_note'), conceptIds: z.array(z.string()).min(1), body: z.string(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('skip_marker'), conceptId: z.string(), blockIds: z.array(z.string()).min(1), reason: z.string(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('exercise_instance'), exercise: exerciseInstanceSchema, createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('run_result'), exerciseInstanceId: z.string().optional(), result: runResultSchema, matched: z.boolean().optional(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('learning_evidence_marker'), evidenceId: z.string(), conceptId: z.string(), skillId: z.string(), exerciseIntent: exerciseIntentSchema.optional(), outcome: evidenceOutcomeSchema, strength: evidenceStrengthSchema, summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('retention_marker'), artifactId: z.string(), conceptId: z.string(), kind: reviewArtifactKindSchema, summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('system_event'), event: classroomEventSchema, createdAt: z.number() }).strict(),
])

export const trackAdjustmentSchema: z.ZodType<TrackAdjustment> = z.object({
  adjustmentId: z.string(),
  kind: z.enum(['topic_entry', 'focused_catch_up', 'skip_ahead', 'review']),
  conceptId: z.string().optional(),
  summary: z.string(),
  createdAt: z.number(),
}).strict()

export const classroomTrackStateSchema: z.ZodType<ClassroomTrackState> = z.object({
  activeTrackId: z.string(),
  targetConceptId: z.string().nullable(),
  targetSkillId: z.string().nullable(),
  adjustments: z.array(trackAdjustmentSchema),
}).strict()

export const classroomSessionSchema: z.ZodType<ClassroomSession> = z.object({
  version: z.literal(3),
  lang: z.string(),
  phase: classroomPhaseSchema,
  contentPackId: z.string(),
  contentVersion: z.string(),
  stream: z.array(classroomStreamItemSchema),
  learner: learnerStateSchema,
  currentExercise: exerciseInstanceSchema.nullable(),
  lastRun: runResultSchema.nullable(),
  sessionSummary: z.string(),
  eventQueue: z.array(classroomEventSchema),
  track: classroomTrackStateSchema,
}).strict()

export const classroomRecordSchema = z.object({
  key: z.string(),
  version: z.literal(1),
  lang: z.string(),
  updatedAt: z.number(),
  session: classroomSessionSchema,
}).strict()
