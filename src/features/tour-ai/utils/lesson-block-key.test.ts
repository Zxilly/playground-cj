import { describe, expect, it } from 'vitest'
import { lessonBlockKey } from './lesson-block-key'

describe('lessonBlockKey', () => {
  it('returns stable non-empty keys for every lesson block variant', () => {
    const blocks = [
      { type: 'heading' as const, text: 'Intro', level: 2 as const },
      { type: 'paragraph' as const, body: [{ text: 'Use ' }, { code: 'let' }, { strong: ' carefully' }] },
      { type: 'concept_card' as const, conceptId: 'cj.let', title: 'Let', body: [{ text: 'Bindings' }] },
      { type: 'code_example' as const, title: 'Example', code: 'x'.repeat(90) },
      { type: 'callout' as const, tone: 'tip' as const, body: [{ text: 'Remember' }] },
      { type: 'steps' as const, items: [[{ text: 'One' }], [{ code: 'two()' }]] },
      { type: 'compare' as const, leftTitle: 'let', left: [{ text: 'a' }], rightTitle: 'var', right: [{ text: 'b' }] },
      { type: 'quiz' as const, conceptId: 'cj.quiz', prompt: [{ strong: 'Why?' }], starterCode: '', expectedOutput: '' },
    ]

    const keys = blocks.map(block => lessonBlockKey(block))

    expect(keys.every(key => key.length > 0)).toBe(true)
    expect(keys).toEqual(blocks.map(block => lessonBlockKey(block)))
    expect(new Set(keys).size).toBe(blocks.length)
  })

  it('includes learner-visible rich text in paragraph and quiz keys', () => {
    expect(lessonBlockKey({ type: 'paragraph', body: [{ text: 'Use ' }, { code: 'let' }, { strong: ' carefully' }] }))
      .toContain('Use let carefully')
    expect(lessonBlockKey({ type: 'quiz', conceptId: 'cj.quiz', prompt: [{ strong: 'Why?' }], starterCode: '', expectedOutput: '' }))
      .toContain('Why?')
  })

  it('truncates code example keys so generated snippets cannot create huge React keys', () => {
    const key = lessonBlockKey({ type: 'code_example', title: 'Example', code: 'x'.repeat(1000) })

    expect(key.length).toBeLessThan(120)
    expect(key).toContain('Example')
  })
})
