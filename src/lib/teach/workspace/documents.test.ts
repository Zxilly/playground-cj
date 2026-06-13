import { describe, expect, it } from 'vitest'
import { glossaryTermSchema, learningRecordSchema, missionSchema, workspaceSnapshotSchema } from './documents'

describe('documents', () => {
  it('mission requires topic/why/successLooksLike', () => {
    expect(missionSchema.safeParse({ topic: 'Cangjie CLI', why: 'ship a tool', successLooksLike: ['parse args'], constraints: [], outOfScope: [], updatedAt: 1 }).success).toBe(true)
    expect(missionSchema.safeParse({ topic: 'x' }).success).toBe(false)
  })
  it('learning record status enum', () => {
    expect(learningRecordSchema.safeParse({ id: '0001', title: 't', body: 'b', status: 'active', createdAt: 1 }).success).toBe(true)
    expect(learningRecordSchema.safeParse({ id: '0001', title: 't', body: 'b', status: 'wat', createdAt: 1 }).success).toBe(false)
  })
  it('glossary term requires term/definition/avoid', () => {
    expect(glossaryTermSchema.safeParse({ term: 'let', definition: 'immutable binding', avoid: ['const'], addedAt: 1 }).success).toBe(true)
    expect(glossaryTermSchema.safeParse({ term: '', definition: 'x', avoid: [], addedAt: 1 }).success).toBe(false)
  })
  it('snapshot has version + collections', () => {
    expect(workspaceSnapshotSchema.safeParse({ version: 1, mission: null, learningRecords: [], glossary: { terms: [] }, lessons: [], references: [], notes: { body: '' }, retrieval: [] }).success).toBe(true)
  })
})
