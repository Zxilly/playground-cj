import { describe, expect, it } from 'vitest'
import { lessonBlockKey } from './lesson-block-key'

describe('lessonBlockKey', () => {
  it('returns stable non-empty keys for every core content block variant', () => {
    const blocks = [
      { type: 'heading' as const, text: 'Intro', level: 2 as const },
      { type: 'paragraph' as const, body: 'Use `let` carefully' },
      { type: 'concept_card' as const, conceptId: 'cj.let', title: 'Let', body: 'Bindings' },
      { type: 'code_example' as const, title: 'Example', code: 'x'.repeat(90) },
      { type: 'callout' as const, tone: 'tip' as const, body: 'Remember' },
      { type: 'steps' as const, items: [
        [{ type: 'text' as const, text: 'One' }],
        [{ type: 'code' as const, code: 'two()' }],
      ] },
      { type: 'compare' as const, leftTitle: 'let', left: [{ type: 'text' as const, text: 'a' }], rightTitle: 'var', right: [{ type: 'text' as const, text: 'b' }] },
    ]

    const keys = blocks.map(block => lessonBlockKey(block))

    expect(keys.every(key => key.length > 0)).toBe(true)
    expect(keys).toEqual(blocks.map(block => lessonBlockKey(block)))
    expect(new Set(keys).size).toBe(blocks.length)
  })

  it('includes learner-visible text for paragraph keys', () => {
    expect(lessonBlockKey({ type: 'paragraph', body: 'Use let carefully' }))
      .toContain('Use let carefully')
  })

  it('truncates code example keys so snippets cannot create huge React keys', () => {
    const key = lessonBlockKey({ type: 'code_example', title: 'Example', code: 'x'.repeat(1000) })

    expect(key.length).toBeLessThan(120)
    expect(key).toContain('Example')
  })
})
