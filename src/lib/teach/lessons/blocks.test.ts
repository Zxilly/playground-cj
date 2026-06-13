import { describe, expect, it } from 'vitest'
import { blockSchema, quizBlockSchema } from './blocks'

describe('blockSchema', () => {
  it('accepts a prose block with citation', () => {
    const r = blockSchema.safeParse({ type: 'prose', markdown: 'hi', citations: [{ sourceId: 'cangjie-mcp', ref: 'std/option', title: 'Option' }] })
    expect(r.success).toBe(true)
  })
  it('rejects unknown block type', () => {
    expect(blockSchema.safeParse({ type: 'nope' }).success).toBe(false)
  })
})

describe('quizBlockSchema equal-length rule', () => {
  it('accepts options with equal word count', () => {
    const r = quizBlockSchema.safeParse({ type: 'quiz', question: 'q', options: ['let binds value', 'var binds mutable'], answerIndices: [0], multiple: false, explanation: 'e' })
    expect(r.success).toBe(true)
  })
  it('rejects options with unequal word count', () => {
    const r = quizBlockSchema.safeParse({ type: 'quiz', question: 'q', options: ['one two three', 'one two'], answerIndices: [0], multiple: false, explanation: 'e' })
    expect(r.success).toBe(false)
  })
  it('rejects answerIndices out of range', () => {
    const r = quizBlockSchema.safeParse({ type: 'quiz', question: 'q', options: ['a a', 'b b'], answerIndices: [5], multiple: false, explanation: 'e' })
    expect(r.success).toBe(false)
  })
})
