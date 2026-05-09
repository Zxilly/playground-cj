import type {
  ClassroomEvent,
  ClassroomQuiz,
  ClassroomSession,
  ClassroomStreamItem,
  ConceptState,
  Evidence,
  LearnerState,
  RunResult,
} from './types'
import { z } from 'zod'

const richTextSpanSchema = z.union([
  z.object({ text: z.string() }).strict(),
  z.object({ code: z.string() }).strict(),
  z.object({ strong: z.string() }).strict(),
])

export const richTextSchema = z.array(richTextSpanSchema).min(1)

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
    body: richTextSchema,
  }).strict(),
  z.object({
    type: z.literal('concept_card'),
    conceptId: z.string(),
    title: z.string(),
    body: richTextSchema,
  }).strict(),
  z.object({
    type: z.literal('code_example'),
    title: z.string().optional(),
    code: z.string(),
    highlights: z.array(codeHighlightSchema).optional(),
  }).strict(),
  z.object({
    type: z.literal('callout'),
    tone: z.union([z.literal('note'), z.literal('warning'), z.literal('tip')]),
    title: z.string().optional(),
    body: richTextSchema,
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
  z.object({
    type: z.literal('quiz'),
    conceptId: z.string(),
    prompt: richTextSchema,
    starterCode: z.string(),
    expectedOutput: z.string(),
    matchMode: z.union([z.literal('exact'), z.literal('contains'), z.literal('regex')]).optional(),
  }).strict(),
])

export const lessonContentBlocksSchema = z.array(lessonContentBlockSchema)

export type LessonContentBlockInput = z.infer<typeof lessonContentBlockSchema>

export const classroomPhaseSchema = z.enum(['orient', 'teach', 'practice'])
export const quizMatchModeSchema = z.enum(['exact', 'contains', 'regex'])
export const quizStatusSchema = z.enum(['active', 'success', 'skip'])
export const conceptStatusSchema = z.enum(['unseen', 'introduced', 'practicing', 'demonstrated'])
export const evidenceOutcomeSchema = z.enum(['success', 'skip'])

export const classroomQuizSchema: z.ZodType<ClassroomQuiz> = z.object({
  conceptId: z.string(),
  prompt: richTextSchema,
  starterCode: z.string(),
  expectedOutput: z.string(),
  matchMode: quizMatchModeSchema,
  status: quizStatusSchema,
  createdAt: z.number(),
}).strict()

export const evidenceSchema: z.ZodType<Evidence> = z.object({
  conceptId: z.string(),
  outcome: evidenceOutcomeSchema,
  source: z.literal('quiz'),
  summary: z.string(),
  createdAt: z.number(),
}).strict()

export const conceptStateSchema: z.ZodType<ConceptState> = z.object({
  conceptId: z.string(),
  status: conceptStatusSchema,
  notes: z.string().optional(),
  updatedAt: z.number(),
}).strict()

export const learnerStateSchema: z.ZodType<LearnerState> = z.object({
  concepts: z.record(z.string(), conceptStateSchema),
  evidence: z.array(evidenceSchema),
  learningNotes: z.string(),
}).strict()

export const runResultSchema: z.ZodType<RunResult> = z.object({
  ok: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().nullable(),
  durationMs: z.number().optional(),
  compilerOutput: z.string().optional(),
}).strict()

export const classroomEventSchema: z.ZodType<ClassroomEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('page_opened'), createdAt: z.number(), summary: z.string().optional() }).strict(),
  z.object({ type: z.literal('quiz_success'), conceptId: z.string(), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('quiz_skip'), conceptId: z.string(), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('chat_intent'), intent: z.string(), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('lesson_generation_error'), summary: z.string(), createdAt: z.number() }).strict(),
])

export const classroomStreamItemSchema: z.ZodType<ClassroomStreamItem> = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('lesson_blocks'), blocks: lessonContentBlocksSchema, createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('quiz'), quiz: classroomQuizSchema, createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('run_result'), result: runResultSchema, matched: z.boolean().optional(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('progress_update'), conceptId: z.string(), outcome: evidenceOutcomeSchema, summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('system_event'), event: classroomEventSchema, createdAt: z.number() }).strict(),
])

// IMPORTANT TYPE NOTE: ClassroomSession in src/lib/ai/classroom/types.ts CURRENTLY contains a `pendingAction: PendingAction` field. The schema below intentionally describes the FUTURE v2 shape (no pendingAction, version: 2 literal). Therefore the type annotation `z.ZodType<ClassroomSession>` will fail to compile against the current ClassroomSession type.
//
// Use this annotation INSTEAD to describe the future shape without coupling to the current types.ts:
//   z.ZodType<Omit<ClassroomSession, 'pendingAction' | 'version'> & { version: 2 }>
//
// This will be reverted to plain z.ZodType<ClassroomSession> in Task 14 when types.ts is updated.

export const classroomSessionSchema: z.ZodType<Omit<ClassroomSession, 'pendingAction' | 'version'> & { version: 2 }> = z.object({
  version: z.literal(2),
  lang: z.string(),
  phase: classroomPhaseSchema,
  stream: z.array(classroomStreamItemSchema),
  learner: learnerStateSchema,
  currentQuiz: classroomQuizSchema.nullable(),
  lastRun: runResultSchema.nullable(),
  sessionSummary: z.string(),
  eventQueue: z.array(classroomEventSchema),
}).strict()

export const classroomRecordSchema = z.object({
  key: z.string(),
  version: z.literal(1),
  lang: z.string(),
  updatedAt: z.number(),
  session: classroomSessionSchema,
}).strict()
