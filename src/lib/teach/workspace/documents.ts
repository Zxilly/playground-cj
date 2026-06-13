import { z } from 'zod'
import { lessonSchema } from '../lessons/lesson'
import { retrievalItemSchema } from '../retrieval/types'

export const missionSchema = z.object({
  topic: z.string().min(1),
  why: z.string().min(1),
  successLooksLike: z.array(z.string()).min(1),
  constraints: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  updatedAt: z.number(),
})
export type Mission = z.infer<typeof missionSchema>

export const learningRecordSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(['active', 'superseded']),
  supersededBy: z.string().optional(),
  evidence: z.string().optional(),
  createdAt: z.number(),
})
export type LearningRecord = z.infer<typeof learningRecordSchema>

export const learningRecordDraftSchema = learningRecordSchema.pick({ title: true, body: true, evidence: true })
export type LearningRecordDraft = z.infer<typeof learningRecordDraftSchema>

export const glossaryTermSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  avoid: z.array(z.string()).default([]),
  group: z.string().optional(),
  addedAt: z.number(),
})
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>

export const glossarySchema = z.object({ terms: z.array(glossaryTermSchema) })
export type Glossary = z.infer<typeof glossarySchema>

export const notesSchema = z.object({ body: z.string().default('') })
export type Notes = z.infer<typeof notesSchema>

export const referenceDocSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  blocks: lessonSchema.shape.blocks,
  updatedAt: z.number(),
})
export type ReferenceDoc = z.infer<typeof referenceDocSchema>

export const WORKSPACE_SNAPSHOT_VERSION = 1
export const workspaceSnapshotSchema = z.object({
  version: z.number(),
  mission: missionSchema.nullable(),
  learningRecords: z.array(learningRecordSchema),
  glossary: glossarySchema,
  lessons: z.array(lessonSchema),
  references: z.array(referenceDocSchema),
  notes: notesSchema,
  retrieval: z.array(retrievalItemSchema),
})
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>
