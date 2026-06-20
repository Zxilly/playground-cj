import { describe, expect, it } from 'vitest'
import { blockSchema, migrateLegacyBlocks, ojBlockSchema, quizBlockSchema } from './blocks'

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
  it('accepts questions with equal-word-count options', () => {
    const r = quizBlockSchema.safeParse({
      type: 'quiz',
      questions: [
        { question: 'q', options: ['let binds value', 'var binds mutable'], answerIndices: [0], multiple: false, explanation: 'e' },
      ],
    })
    expect(r.success).toBe(true)
  })
  it('rejects a question with unequal word count', () => {
    const r = quizBlockSchema.safeParse({
      type: 'quiz',
      questions: [
        { question: 'q', options: ['one two three', 'one two'], answerIndices: [0], multiple: false, explanation: 'e' },
      ],
    })
    expect(r.success).toBe(false)
  })
  it('rejects answerIndices out of range', () => {
    const r = quizBlockSchema.safeParse({
      type: 'quiz',
      questions: [
        { question: 'q', options: ['a a', 'b b'], answerIndices: [5], multiple: false, explanation: 'e' },
      ],
    })
    expect(r.success).toBe(false)
  })
  it('rejects a single-answer question with more than one index', () => {
    const r = quizBlockSchema.safeParse({
      type: 'quiz',
      questions: [
        { question: 'q', options: ['a a', 'b b'], answerIndices: [0, 1], multiple: false, explanation: 'e' },
      ],
    })
    expect(r.success).toBe(false)
  })
  it('accepts multiple questions', () => {
    const r = quizBlockSchema.safeParse({
      type: 'quiz',
      questions: [
        { question: 'q1', options: ['a a', 'b b'], answerIndices: [0], multiple: false, explanation: 'e' },
        { question: 'q2', options: ['c', 'd'], answerIndices: [0, 1], multiple: true, explanation: 'e' },
      ],
    })
    expect(r.success).toBe(true)
  })

  // The teacher authors lessons through `blockSchema` (the discriminated union),
  // never through `quizBlockSchema` directly — so the per-question equal-length
  // refine must still fire when a quiz is parsed via the union path, or a
  // malformed quiz could slip into a persisted lesson.
  it('enforces the equal-length rule through the discriminated union', () => {
    const ok = blockSchema.safeParse({
      type: 'quiz',
      questions: [{ question: 'q', options: ['let binds value', 'var binds mutable'], answerIndices: [0], multiple: false, explanation: 'e' }],
    })
    expect(ok.success).toBe(true)
    const bad = blockSchema.safeParse({
      type: 'quiz',
      questions: [{ question: 'q', options: ['one two three', 'one two'], answerIndices: [0], multiple: false, explanation: 'e' }],
    })
    expect(bad.success).toBe(false)
  })
})

describe('ojBlockSchema', () => {
  it('accepts a function-mode block with callTemplate and per-case args', () => {
    const r = ojBlockSchema.safeParse({
      type: 'oj',
      mode: 'function',
      title: 'Add',
      prompt: '实现 add',
      starterCode: 'func add(a: Int64, b: Int64) {}',
      callTemplate: 'add(${args})',
      testCases: [
        { args: '1, 2', expectedOutput: '3' },
        { args: '3, 4', expectedOutput: '7' },
      ],
    })
    expect(r.success).toBe(true)
  })
  it('defaults matchMode to exact and visible to true', () => {
    const r = ojBlockSchema.parse({
      type: 'oj',
      mode: 'stdio',
      title: 'Echo',
      prompt: 'echo',
      starterCode: 'main() {}',
      testCases: [{ expectedOutput: 'hi' }],
    })
    expect(r.matchMode).toBe('exact')
    expect(r.testCases[0].visible).toBe(true)
  })
  it('rejects function-mode without callTemplate', () => {
    const r = ojBlockSchema.safeParse({
      type: 'oj',
      mode: 'function',
      title: 'Add',
      prompt: 'p',
      starterCode: 's',
      testCases: [{ args: '1', expectedOutput: '1' }],
    })
    expect(r.success).toBe(false)
  })
  it('rejects function-mode when a test case is missing args', () => {
    const r = ojBlockSchema.safeParse({
      type: 'oj',
      mode: 'function',
      title: 'Add',
      prompt: 'p',
      starterCode: 's',
      callTemplate: 'add(${args})',
      testCases: [{ expectedOutput: '1' }],
    })
    expect(r.success).toBe(false)
  })
  it('accepts stdio-mode without args (stdin optional)', () => {
    const r = ojBlockSchema.safeParse({
      type: 'oj',
      mode: 'stdio',
      title: 'Sum',
      prompt: 'p',
      starterCode: 's',
      testCases: [
        { stdin: '1 2', expectedOutput: '3' },
        { expectedOutput: 'no-input' },
      ],
    })
    expect(r.success).toBe(true)
  })
  it('is reachable through the discriminated union', () => {
    const r = blockSchema.safeParse({
      type: 'oj',
      mode: 'stdio',
      title: 'Echo',
      prompt: 'p',
      starterCode: 's',
      testCases: [{ expectedOutput: 'hi' }],
    })
    expect(r.success).toBe(true)
  })
})

describe('migrateLegacyBlocks', () => {
  it('rewrites a legacy single-question quiz into the questions[] shape', () => {
    const legacy = {
      type: 'quiz',
      question: 'q',
      options: ['let binds value', 'var binds mutable'],
      answerIndices: [0],
      multiple: false,
      explanation: 'e',
    }
    const [migrated] = migrateLegacyBlocks([legacy])
    expect(migrated).toEqual({
      type: 'quiz',
      questions: [{
        question: 'q',
        options: ['let binds value', 'var binds mutable'],
        answerIndices: [0],
        multiple: false,
        explanation: 'e',
      }],
    })
    // The migrated quiz now parses under the current schema.
    expect(blockSchema.safeParse(migrated).success).toBe(true)
  })
  it('leaves an already-migrated quiz untouched', () => {
    const current = { type: 'quiz', questions: [{ question: 'q', options: ['a a', 'b b'], answerIndices: [0], multiple: false, explanation: 'e' }] }
    const [out] = migrateLegacyBlocks([current])
    expect(out).toBe(current)
  })
  it('leaves non-quiz blocks untouched', () => {
    const prose = { type: 'prose', markdown: 'hi' }
    const [out] = migrateLegacyBlocks([prose])
    expect(out).toBe(prose)
  })
  it('does not mutate the input array', () => {
    const input = [{ type: 'quiz', question: 'q', options: ['a a', 'b b'], answerIndices: [0], multiple: false, explanation: 'e' }]
    const snapshot = JSON.parse(JSON.stringify(input))
    migrateLegacyBlocks(input)
    expect(input).toEqual(snapshot)
  })
})
