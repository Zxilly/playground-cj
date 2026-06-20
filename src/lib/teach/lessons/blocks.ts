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

const quizQuestionBaseSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(5),
  answerIndices: z.array(z.number().int().nonnegative()).min(1),
  multiple: z.boolean(),
  explanation: z.string(),
})

/**
 * Equal-length quiz rule (teach hard rule), applied PER QUESTION: all options
 * must share the same word count so option formatting never leaks the answer.
 * Also validates that answer indices stay in range and that single-answer
 * questions carry exactly one answer.
 */
function refineQuiz(v: z.infer<typeof quizQuestionBaseSchema>, ctx: z.RefinementCtx) {
  const counts = v.options.map(wordCount)
  if (new Set(counts).size > 1)
    ctx.addIssue({ code: 'custom', message: 'quiz options must have equal word count' })
  if (v.answerIndices.some(i => i >= v.options.length))
    ctx.addIssue({ code: 'custom', message: 'answerIndices out of range' })
  if (!v.multiple && v.answerIndices.length !== 1)
    ctx.addIssue({ code: 'custom', message: 'single-answer quiz needs exactly one answerIndex' })
}

export const quizQuestionSchema = quizQuestionBaseSchema.superRefine(refineQuiz)
export type QuizQuestion = z.infer<typeof quizQuestionSchema>

export const quizBlockSchema = z.object({
  type: z.literal('quiz'),
  questions: z.array(quizQuestionSchema).min(1).max(8),
})

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
export const ojTestCaseSchema = z.object({
  args: z.string().optional(),
  stdin: z.string().optional(),
  expectedOutput: z.string(),
  visible: z.boolean().default(true),
  label: z.string().optional(),
})
export type OjTestCase = z.infer<typeof ojTestCaseSchema>

const ojBlockBaseSchema = z.object({
  type: z.literal('oj'),
  mode: z.enum(['function', 'stdio']),
  title: z.string(),
  prompt: z.string(),
  starterCode: z.string(),
  callTemplate: z.string().optional(),
  testCases: z.array(ojTestCaseSchema).min(1).max(20),
  matchMode: z.enum(['exact', 'contains', 'regex']).default('exact'),
  hints: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
})

/**
 * Function-mode OJ blocks judge a learner-authored function by splicing each
 * test case's `args` into `callTemplate`, so both must be present. Stdio-mode
 * blocks feed `stdin` to a full program, where stdin is optional per case.
 */
function refineOj(v: z.infer<typeof ojBlockBaseSchema>, ctx: z.RefinementCtx) {
  if (v.mode === 'function') {
    if (v.callTemplate == null)
      ctx.addIssue({ code: 'custom', message: 'function-mode oj requires callTemplate' })
    if (v.testCases.some(tc => tc.args == null))
      ctx.addIssue({ code: 'custom', message: 'function-mode oj requires args on every test case' })
  }
}

export const ojBlockSchema = ojBlockBaseSchema.superRefine(refineOj)

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
export type OjBlockSchemaType = z.infer<typeof ojBlockSchema>
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
  ojBlockSchema,
  lessonLinkBlockSchema,
  referenceLinkBlockSchema,
  followupPromptBlockSchema,
  rawHtmlBlockSchema,
])
export type Block = z.infer<typeof blockSchema>
export type BlockType = Block['type']

/**
 * Forward-migrate already-persisted lesson blocks to the current schema so old
 * workspaces keep parsing after a schema change. Pure: returns a new array and
 * never mutates the input.
 *
 * Currently rewrites the legacy single-question quiz shape
 * (`{ type:'quiz', question, options, answerIndices, multiple, explanation }`)
 * into the multi-question shape (`{ type:'quiz', questions:[...] }`). Every
 * other block is passed through untouched.
 */
export function migrateLegacyBlocks(blocks: unknown[]): unknown[] {
  return blocks.map((block) => {
    if (
      block != null
      && typeof block === 'object'
      && (block as { type?: unknown }).type === 'quiz'
      && 'question' in block
      && !('questions' in block)
    ) {
      const { question, options, answerIndices, multiple, explanation } = block as {
        question: unknown
        options: unknown
        answerIndices: unknown
        multiple: unknown
        explanation: unknown
      }
      return {
        type: 'quiz',
        questions: [{ question, options, answerIndices, multiple, explanation }],
      }
    }
    return block
  })
}
