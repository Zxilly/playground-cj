import { describe, expect, it } from 'vitest'
import { lessonDraftSchema, lessonSchema } from './lesson'

const draft = {
  title: 'let vs var',
  missionLink: 'build a CLI',
  skillFocus: 'declare bindings',
  zpdRationale: 'knows nothing yet',
  blocks: [{ type: 'prose', markdown: 'x' }],
  citations: [],
}

describe('lessonDraftSchema', () => {
  it('accepts a minimal draft (no id/state)', () => expect(lessonDraftSchema.safeParse(draft).success).toBe(true))
  it('rejects empty blocks', () => expect(lessonDraftSchema.safeParse({ ...draft, blocks: [] }).success).toBe(false))
  it('rejects >8 blocks', () => expect(lessonDraftSchema.safeParse({ ...draft, blocks: Array.from({ length: 9 }, () => ({ type: 'prose', markdown: 'x' })) }).success).toBe(false))
})

describe('lessonSchema', () => {
  it('requires id/state/createdAt', () => {
    expect(lessonSchema.safeParse({ ...draft, id: '0001', createdAt: 1, state: { status: 'unstarted', blockProgress: {} } }).success).toBe(true)
  })
})
