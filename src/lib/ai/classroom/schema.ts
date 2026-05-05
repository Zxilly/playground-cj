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
