import { z } from 'zod'
import { lessonContentBlockSchema } from '@/lib/ai/classroom/schema'
import type { CourseContentPack } from './types'

const sourceReferenceSchema = z.object({
  kind: z.literal('static_tour'),
  tourPath: z.string().min(1),
  chapterId: z.string().min(1),
  subChapterId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  language: z.union([z.literal('zh'), z.literal('en')]).optional(),
  anchor: z.string().min(1).optional(),
}).strict()

const coreContentBlockContentSchema = lessonContentBlockSchema

const localeTextSchema = z.object({
  zh: z.string().min(1),
  en: z.string().min(1),
}).strict()

export const coreContentBlockSchema = z.object({
  blockId: z.string().min(1),
  conceptId: z.string().min(1),
  contentVersion: z.string().min(1),
  order: z.number().int().min(0),
  content: coreContentBlockContentSchema,
  localizedContent: z.object({
    zh: coreContentBlockContentSchema.optional(),
    en: coreContentBlockContentSchema.optional(),
  }).strict().optional(),
  sourceRefs: z.array(sourceReferenceSchema).min(1),
  runnable: z.object({
    status: z.union([z.literal('runnable'), z.literal('not_runnable')]),
    reason: z.string().min(1).optional(),
  }).strict().optional(),
}).strict()

export const courseConceptSchema = z.object({
  conceptId: z.string().min(1),
  title: localeTextSchema,
  summary: localeTextSchema,
  blockIds: z.array(z.string().min(1)),
  skillIds: z.array(z.string().min(1)),
}).strict()

export const learningSkillSchema = z.object({
  skillId: z.string().min(1),
  conceptIds: z.array(z.string().min(1)).min(1),
  title: localeTextSchema,
  summary: localeTextSchema,
  evidenceCriteria: z.array(z.string().min(1)).min(1),
}).strict()

export const exerciseTemplateSchema = z.object({
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  skillId: z.string().min(1),
  conceptIds: z.array(z.string().min(1)).min(1),
  title: localeTextSchema,
  prompt: localeTextSchema,
  starterCode: z.string(),
  expectedOutput: z.string(),
  matchMode: z.union([z.literal('exact'), z.literal('contains'), z.literal('regex')]),
  intent: z.union([z.literal('mainline'), z.literal('placement_check'), z.literal('review_check')]),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  sourceRefs: z.array(sourceReferenceSchema).min(1),
}).strict()

export const learningTrackDefinitionSchema = z.object({
  trackId: z.string().min(1),
  title: localeTextSchema,
  conceptIds: z.array(z.string().min(1)).min(1),
  skillIds: z.array(z.string().min(1)).min(1),
}).strict()

export const courseContentPackSchema: z.ZodType<CourseContentPack> = z.object({
  packId: z.string().min(1),
  contentVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  concepts: z.array(courseConceptSchema).min(1),
  blocks: z.array(coreContentBlockSchema).min(1),
  skills: z.array(learningSkillSchema),
  exerciseTemplates: z.array(exerciseTemplateSchema),
  tracks: z.array(learningTrackDefinitionSchema).min(1),
}).strict()
