import { describe, expect, it } from 'vitest'
import { classroomEventSchema, classroomRecordSchema, classroomSessionSchema, classroomStreamItemSchema, lessonContentBlockSchema, lessonContentBlocksSchema, markdownBodySchema, richTextSchema } from './schema'
import { classroomStorageKey } from './store'

describe('lesson content DSL schema', () => {
  it('accepts a structured set of lesson blocks', () => {
    const result = lessonContentBlocksSchema.safeParse([
      { type: 'heading', text: 'Bindings', level: 2 },
      {
        type: 'paragraph',
        body: 'Use `let` for immutable bindings.',
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
        prompt: 'Print 3.',
        starterCode: 'main() {\n    println(0)\n}',
        expectedOutput: '3',
        matchMode: 'exact',
      },
    ])

    expect(result.success).toBe(true)
  })

  it('accepts language hints on compare-side code blocks', () => {
    expect(lessonContentBlockSchema.safeParse({
      type: 'compare',
      leftTitle: 'Cangjie',
      left: [{ type: 'code', code: 'let value = 1', lang: 'cangjie' }],
      rightTitle: 'TypeScript',
      right: [{ type: 'code', code: 'const value = 1', lang: 'typescript' }],
    }).success).toBe(true)

    expect(lessonContentBlockSchema.safeParse({
      type: 'code_example',
      title: 'TypeScript comparison',
      code: 'const value = 1',
      language: 'typescript',
    }).success).toBe(true)
  })

  it('rejects MDX, HTML, and layout source as model output', () => {
    expect(lessonContentBlockSchema.safeParse({
      type: 'mdx',
      body: '<ConceptCard className="grid" />',
    }).success).toBe(false)

    // body is a string field; an object/array there is rejected.
    expect(lessonContentBlockSchema.safeParse({
      type: 'paragraph',
      body: [{ html: '<strong>unsafe</strong>' }],
    }).success).toBe(false)
  })

  it('paragraph body must be a plain string', () => {
    const result = lessonContentBlockSchema.safeParse({
      type: 'paragraph',
      body: 'Use **let** for immutable bindings.',
    })
    expect(result.success).toBe(true)
    if (result.success && result.data.type === 'paragraph')
      expect(result.data.body).toBe('Use **let** for immutable bindings.')
  })

  it('quiz prompt must be a plain string', () => {
    const result = lessonContentBlockSchema.safeParse({
      type: 'quiz',
      conceptId: 'cj.x',
      prompt: 'Print 3.',
      starterCode: '',
      expectedOutput: '3',
    })
    expect(result.success).toBe(true)
    if (result.success && result.data.type === 'quiz')
      expect(result.data.prompt).toBe('Print 3.')
  })

  it('richTextSchema accepts a plain string and lifts it into a single text span', () => {
    const result = richTextSchema.safeParse('just a string')
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data).toEqual([{ type: 'text', text: 'just a string' }])
  })

  it('richTextSchema accepts a discriminated-union array directly', () => {
    const result = richTextSchema.safeParse([
      { type: 'text', text: 'Use ' },
      { type: 'code', code: 'let', lang: 'cangjie' },
    ])
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data).toEqual([
        { type: 'text', text: 'Use ' },
        { type: 'code', code: 'let', lang: 'cangjie' },
      ])
  })

  it('richTextSchema rejects legacy untagged spans (back-compat removed)', () => {
    expect(richTextSchema.safeParse([{ text: 'Use ' }]).success).toBe(false)
    expect(richTextSchema.safeParse([{ code: 'let', language: 'cangjie' }]).success).toBe(false)
    expect(richTextSchema.safeParse([{ strong: 'bold' }]).success).toBe(false)
  })

  it('markdownBodySchema rejects anything that is not a string', () => {
    expect(markdownBodySchema.safeParse(42).success).toBe(false)
    expect(markdownBodySchema.safeParse([{ type: 'text', text: 'x' }]).success).toBe(false)
    expect(markdownBodySchema.safeParse([]).success).toBe(false)
    expect(markdownBodySchema.safeParse({}).success).toBe(false)
  })

  it.each(['sourceRefs', 'origin', 'doc_ref', 'ref', 'provenance'])(
    'rejects removed reference/provenance field %s',
    (field) => {
      expect(lessonContentBlockSchema.safeParse({
        type: 'concept_card',
        conceptId: 'cj.bindings.let',
        title: 'Let',
        body: 'Immutable binding.',
        [field]: 'not-in-v1',
      }).success).toBe(false)
    },
  )
})

describe('classroomEventSchema', () => {
  it('accepts all five event types', () => {
    expect(classroomEventSchema.safeParse({ type: 'classroom_opened', createdAt: 1 }).success).toBe(true)
    expect(classroomEventSchema.safeParse({
      type: 'quiz_success',
      conceptId: 'c',
      summary: 's',
      createdAt: 1,
    }).success).toBe(true)
    expect(classroomEventSchema.safeParse({
      type: 'quiz_skip',
      conceptId: 'c',
      summary: 's',
      createdAt: 1,
    }).success).toBe(true)
    expect(classroomEventSchema.safeParse({
      type: 'chat_intent',
      intent: 'go_deeper',
      summary: 's',
      createdAt: 1,
    }).success).toBe(true)
    expect(classroomEventSchema.safeParse({
      type: 'lesson_generation_error',
      summary: 's',
      createdAt: 1,
    }).success).toBe(true)
  })

  it('rejects unknown event types', () => {
    expect(classroomEventSchema.safeParse({ type: 'lesson_author_error', summary: 's', createdAt: 1 }).success).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(classroomEventSchema.safeParse({ type: 'quiz_success', summary: 's', createdAt: 1 }).success).toBe(false)
  })

  it('rejects extra fields under strict mode', () => {
    expect(classroomEventSchema.safeParse({
      type: 'classroom_opened',
      createdAt: 1,
      extra: 'nope',
    }).success).toBe(false)
  })
})

describe('classroomStreamItemSchema', () => {
  it('accepts a quiz stream item', () => {
    expect(classroomStreamItemSchema.safeParse({
      id: 'q1',
      type: 'quiz',
      quiz: {
        id: 'q1',
        conceptId: 'c',
        prompt: 'p',
        starterCode: 's',
        expectedOutput: '3',
        matchMode: 'exact',
        status: 'active',
        createdAt: 1,
      },
      createdAt: 1,
    }).success).toBe(true)
  })

  it('rejects a stream item with bad discriminator', () => {
    expect(classroomStreamItemSchema.safeParse({
      id: 'x',
      type: 'unknown',
      createdAt: 1,
    }).success).toBe(false)
  })
})

describe('classroomSessionSchema', () => {
  it('accepts a fresh v2 session', () => {
    const session = {
      version: 2,
      lang: 'zh',
      phase: 'orient',
      stream: [],
      learner: { concepts: {}, evidence: [], learningNotes: '' },
      currentQuiz: null,
      lastRun: null,
      sessionSummary: 'Fresh',
      eventQueue: [],
    }
    expect(classroomSessionSchema.safeParse(session).success).toBe(true)
  })

  it('rejects v1 session payload', () => {
    const session = {
      version: 1,
      lang: 'zh',
      phase: 'orient',
      pendingAction: 'none',
      stream: [],
      learner: { concepts: {}, evidence: [], learningNotes: '' },
      currentQuiz: null,
      lastRun: null,
      sessionSummary: '',
      eventQueue: [],
    }
    expect(classroomSessionSchema.safeParse(session).success).toBe(false)
  })

  it('rejects sessions with corrupted stream items', () => {
    const session = {
      version: 2,
      lang: 'zh',
      phase: 'orient',
      stream: [{ id: 'x', type: 'quiz', createdAt: 1 }], // missing quiz
      learner: { concepts: {}, evidence: [], learningNotes: '' },
      currentQuiz: null,
      lastRun: null,
      sessionSummary: '',
      eventQueue: [],
    }
    expect(classroomSessionSchema.safeParse(session).success).toBe(false)
  })
})

describe('classroomRecordSchema', () => {
  it('accepts a valid record envelope', () => {
    const record = {
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1234,
      session: {
        version: 2,
        lang: 'zh',
        phase: 'orient',
        stream: [],
        learner: { concepts: {}, evidence: [], learningNotes: '' },
        currentQuiz: null,
        lastRun: null,
        sessionSummary: '',
        eventQueue: [],
      },
    }
    expect(classroomRecordSchema.safeParse(record).success).toBe(true)
  })

  it('rejects an envelope wrapping a v1 session', () => {
    const record = {
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1234,
      session: { version: 1 },
    }
    expect(classroomRecordSchema.safeParse(record).success).toBe(false)
  })
})
