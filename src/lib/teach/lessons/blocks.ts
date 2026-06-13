import { z } from 'zod'

export const citationSchema = z.object({
  sourceId: z.string(),
  ref: z.string(),
  title: z.string(),
})
export type Citation = z.infer<typeof citationSchema>

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export const proseBlockSchema = z.object({
  type: z.literal('prose'),
  markdown: z.string(),
  citations: z.array(citationSchema).optional(),
})
export const headingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string(),
})
export const calloutBlockSchema = z.object({
  type: z.literal('callout'),
  variant: z.enum(['note', 'warning', 'insight']),
  markdown: z.string(),
})
export const codeSampleBlockSchema = z.object({
  type: z.literal('code_sample'),
  code: z.string(),
  language: z.literal('cangjie').default('cangjie'),
  explanation: z.string().optional(),
  citations: z.array(citationSchema).optional(),
})
export const glossaryRefBlockSchema = z.object({
  type: z.literal('glossary_ref'),
  term: z.string(),
})

const quizBlockBaseSchema = z.object({
  type: z.literal('quiz'),
  question: z.string(),
  options: z.array(z.string()).min(2).max(5),
  answerIndices: z.array(z.number().int().nonnegative()).min(1),
  multiple: z.boolean(),
  explanation: z.string(),
})

/**
 * Equal-length quiz rule (teach hard rule): all options must share the same
 * word count so option formatting never leaks the answer. Also validates that
 * answer indices stay in range and that single-answer quizzes carry exactly
 * one answer.
 */
function refineQuiz(v: z.infer<typeof quizBlockBaseSchema>, ctx: z.RefinementCtx) {
  const counts = v.options.map(wordCount)
  if (new Set(counts).size > 1)
    ctx.addIssue({ code: 'custom', message: 'quiz options must have equal word count' })
  if (v.answerIndices.some(i => i >= v.options.length))
    ctx.addIssue({ code: 'custom', message: 'answerIndices out of range' })
  if (!v.multiple && v.answerIndices.length !== 1)
    ctx.addIssue({ code: 'custom', message: 'single-answer quiz needs exactly one answerIndex' })
}

export const quizBlockSchema = quizBlockBaseSchema.superRefine(refineQuiz)

export const recallPromptBlockSchema = z.object({
  type: z.literal('recall_prompt'),
  prompt: z.string(),
  answer: z.string(),
})
export const codeTaskBlockSchema = z.object({
  type: z.literal('code_task'),
  prompt: z.string(),
  starterCode: z.string(),
  expectedOutput: z.string(),
  matchMode: z.enum(['exact', 'contains', 'regex']),
  hints: z.array(z.string()).optional(),
})
export const lessonLinkBlockSchema = z.object({
  type: z.literal('lesson_link'),
  lessonId: z.string(),
  label: z.string(),
})
export const referenceLinkBlockSchema = z.object({
  type: z.literal('reference_link'),
  referenceId: z.string(),
  label: z.string(),
})
export const followupPromptBlockSchema = z.object({
  type: z.literal('followup_prompt'),
  prompt: z.string(),
})
export const rawHtmlBlockSchema = z.object({
  type: z.literal('raw_html'),
  html: z.string(),
  height: z.number().int().positive().max(1200).optional(),
})

export type ProseBlockSchemaType = z.infer<typeof proseBlockSchema>
export type HeadingBlockSchemaType = z.infer<typeof headingBlockSchema>
export type CalloutBlockSchemaType = z.infer<typeof calloutBlockSchema>
export type CodeSampleBlockSchemaType = z.infer<typeof codeSampleBlockSchema>
export type GlossaryRefBlockSchemaType = z.infer<typeof glossaryRefBlockSchema>
export type QuizBlockSchemaType = z.infer<typeof quizBlockSchema>
export type RecallPromptBlockSchemaType = z.infer<typeof recallPromptBlockSchema>
export type CodeTaskBlockSchemaType = z.infer<typeof codeTaskBlockSchema>
export type LessonLinkBlockSchemaType = z.infer<typeof lessonLinkBlockSchema>
export type ReferenceLinkBlockSchemaType = z.infer<typeof referenceLinkBlockSchema>
export type FollowupPromptBlockSchemaType = z.infer<typeof followupPromptBlockSchema>
export type RawHtmlBlockSchemaType = z.infer<typeof rawHtmlBlockSchema>

export const blockSchema = z.discriminatedUnion('type', [
  proseBlockSchema,
  headingBlockSchema,
  calloutBlockSchema,
  codeSampleBlockSchema,
  glossaryRefBlockSchema,
  quizBlockSchema,
  recallPromptBlockSchema,
  codeTaskBlockSchema,
  lessonLinkBlockSchema,
  referenceLinkBlockSchema,
  followupPromptBlockSchema,
  rawHtmlBlockSchema,
])
export type Block = z.infer<typeof blockSchema>
export type BlockType = Block['type']
