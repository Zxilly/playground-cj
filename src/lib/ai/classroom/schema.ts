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
import { unflattenCodeEscapes } from '@/lib/ai/unflatten-code-escapes'

// Source-code strings (richText {code} parts, code_example.code, quiz.starterCode)
// run through unflattenCodeEscapes on parse to repair double-JSON-encoded args
// from weaker models.
const codeString = z.string().transform(unflattenCodeEscapes)

// Discriminated union on `type` — models pick the right shape from one keyword
// instead of inferring it from which keys are present.
const richTextSpanSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({ type: z.literal('code'), code: codeString, lang: z.string().optional() }).strict(),
  z.object({ type: z.literal('strong'), text: z.string() }).strict(),
])

// richTextSchema accepts either a plain string (lifted into a single text span)
// or an array of spans. The string fallback is an ergonomic shortcut for the
// common single-text-span case, not back-compat for legacy persisted data.
export const richTextSchema = z.union([
  z.string().transform(s => [{ type: 'text' as const, text: s }]),
  z.array(richTextSpanSchema).min(1),
])

// Body / prompt fields are plain markdown strings. Renderers parse the markdown
// at display time (see MarkdownBody); the schema just enforces "string".
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
  z.object({
    type: z.literal('quiz'),
    conceptId: z.string(),
    prompt: markdownBodySchema,
    starterCode: codeString,
    expectedOutput: z.string(),
    matchMode: z.union([z.literal('exact'), z.literal('contains'), z.literal('regex')]).optional(),
  }).strict(),
])

export const lessonContentBlocksSchema = z.array(lessonContentBlockSchema)

export type LessonContentBlockInput = z.infer<typeof lessonContentBlockSchema>

export const classroomPhaseSchema = z.enum(['orient', 'teach', 'practice'])
export const quizMatchModeSchema = z.enum(['exact', 'contains', 'regex'])
export const quizStatusSchema = z.enum(['active', 'success', 'skip', 'superseded'])
export const conceptStatusSchema = z.enum(['unseen', 'introduced', 'practicing', 'demonstrated'])
export const evidenceOutcomeSchema = z.enum(['success', 'skip'])
export const chatIntentKindSchema = z.enum(['advance', 'go_deeper', 'slow_down', 'change_topic', 'explain_error'])

export const classroomQuizSchema: z.ZodType<ClassroomQuiz> = z.object({
  id: z.string(),
  conceptId: z.string(),
  prompt: markdownBodySchema,
  starterCode: codeString,
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
  z.object({ type: z.literal('classroom_opened'), createdAt: z.number(), summary: z.string().optional() }).strict(),
  z.object({ type: z.literal('quiz_success'), conceptId: z.string(), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('quiz_skip'), conceptId: z.string(), summary: z.string(), createdAt: z.number() }).strict(),
  z.object({
    type: z.literal('quiz_failure'),
    conceptId: z.string(),
    quizId: z.string(),
    prompt: z.string(),
    attemptedCode: z.string(),
    expectedOutput: z.string(),
    actualOutput: z.string(),
    summary: z.string(),
    createdAt: z.number(),
  }).strict(),
  z.object({ type: z.literal('chat_intent'), intent: chatIntentKindSchema, summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ type: z.literal('lesson_generation_error'), summary: z.string(), createdAt: z.number() }).strict(),
])

export const classroomStreamItemSchema: z.ZodType<ClassroomStreamItem> = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('lesson_blocks'), blocks: lessonContentBlocksSchema, createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('quiz'), quiz: classroomQuizSchema, createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('run_result'), result: runResultSchema, matched: z.boolean().optional(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('progress_update'), conceptId: z.string(), outcome: evidenceOutcomeSchema, summary: z.string(), createdAt: z.number() }).strict(),
  z.object({ id: z.string(), type: z.literal('system_event'), event: classroomEventSchema, createdAt: z.number() }).strict(),
])

export const classroomSessionSchema: z.ZodType<ClassroomSession> = z.object({
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
