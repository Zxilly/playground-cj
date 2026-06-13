import { z } from 'zod'
import { blockSchema, citationSchema } from './blocks'

export const blockOutcomeSchema = z.object({
  correct: z.boolean().optional(),
  attempts: z.number().int().nonnegative().default(0),
  lastAnswer: z.unknown().optional(),
  completedAt: z.number().optional(),
})
export type BlockOutcome = z.infer<typeof blockOutcomeSchema>

export const lessonStateSchema = z.object({
  status: z.enum(['unstarted', 'in_progress', 'completed']),
  blockProgress: z.record(z.string(), blockOutcomeSchema),
  completedAt: z.number().optional(),
})
export type LessonState = z.infer<typeof lessonStateSchema>

export const lessonDraftSchema = z.object({
  title: z.string().min(1),
  missionLink: z.string().min(1),
  skillFocus: z.string().min(1),
  zpdRationale: z.string().min(1),
  blocks: z.array(blockSchema).min(1).max(8),
  citations: z.array(citationSchema).default([]),
})
export type LessonDraft = z.infer<typeof lessonDraftSchema>

export const lessonSchema = lessonDraftSchema.extend({
  id: z.string(),
  state: lessonStateSchema,
  createdAt: z.number(),
})
export type Lesson = z.infer<typeof lessonSchema>
