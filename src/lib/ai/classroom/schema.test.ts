import { describe, expect, it } from 'vitest'
import { lessonContentBlockSchema, lessonContentBlocksSchema } from './schema'

describe('lesson content DSL schema', () => {
  it('accepts structured rich lesson blocks', () => {
    const result = lessonContentBlocksSchema.safeParse([
      { type: 'heading', text: 'Bindings', level: 2 },
      {
        type: 'paragraph',
        body: [
          { text: 'Use ' },
          { code: 'let' },
          { text: ' for immutable bindings.' },
        ],
      },
      {
        type: 'code_example',
        title: 'Print a value',
        code: 'main() {\n    println(3)\n}',
        highlights: [{ startLine: 2, label: 'output' }],
      },
      {
        type: 'quiz',
        conceptId: 'cj.bindings.let',
        prompt: [{ text: 'Print 3.' }],
        starterCode: 'main() {\n    println(0)\n}',
        expectedOutput: '3',
        matchMode: 'exact',
      },
    ])

    expect(result.success).toBe(true)
  })

  it('rejects MDX, HTML, and layout source as model output', () => {
    expect(lessonContentBlockSchema.safeParse({
      type: 'mdx',
      body: '<ConceptCard className="grid" />',
    }).success).toBe(false)

    expect(lessonContentBlockSchema.safeParse({
      type: 'paragraph',
      body: [{ html: '<strong>unsafe</strong>' }],
    }).success).toBe(false)
  })

  it.each(['sourceRefs', 'origin', 'doc_ref', 'ref', 'provenance'])(
    'rejects removed reference/provenance field %s',
    (field) => {
      expect(lessonContentBlockSchema.safeParse({
        type: 'concept_card',
        conceptId: 'cj.bindings.let',
        title: 'Let',
        body: [{ text: 'Immutable binding.' }],
        [field]: 'not-in-v1',
      }).success).toBe(false)
    },
  )
})
