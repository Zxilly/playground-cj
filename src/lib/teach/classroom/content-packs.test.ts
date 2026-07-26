import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import {
  contentPackIdSchema,
  contentPacksResponseSchema,
  contentVersionSchema,
  exerciseTaskSchema,
  learningContractVersionSchema,
  validateContentPack,
} from './content-packs'

const contentVersion = `cv:sha256:${'a'.repeat(64)}`
const learningContractVersion = `lc:sha256:${'b'.repeat(64)}`

function approvedPack() {
  return {
    id: 'pack:cj.var.immutable:en',
    version: contentVersion,
    learningContractVersion,
    concept: {
      id: 'cj.var.immutable',
      title: 'Immutable binding let',
      summary: 'let bindings cannot be reassigned.',
      prerequisites: [],
    },
    blocks: [
      {
        id: 'block:let',
        type: 'prose',
        markdown: '`let` creates an immutable binding.',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '02-basics/01-bindings/01',
          title: 'let (Immutable Bindings)',
        }],
      },
      {
        id: 'block:let:program',
        type: 'code_sample',
        code: 'main() {\n    let answer = 42\n    println(answer)\n}',
        language: 'cangjie',
        sampleType: 'program',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '02-basics/01-bindings/01',
          title: 'let (Immutable Bindings)',
        }],
      },
    ],
    learningSkills: [{
      id: 'skill:let:declare',
      conceptId: 'cj.var.immutable',
      title: 'Declare an immutable binding',
      description: 'Can declare and read a let binding.',
      key: true,
    }],
    exerciseTemplates: [{
      id: 'template:let:practice',
      version: contentVersion,
      learningSkillId: 'skill:let:declare',
      purpose: 'practice',
      task: {
        type: 'code_output',
        prompt: 'Declare an immutable binding and print it.',
        starterCode: 'main() { let answer = 42; println(answer) }',
        expectedOutput: '42',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
      },
    }, {
      id: 'template:let:review',
      version: contentVersion,
      learningSkillId: 'skill:let:declare',
      purpose: 'review',
      task: {
        type: 'code_output',
        prompt: 'Review immutable bindings in a fresh program.',
        starterCode: 'main() { let answer = 84; println(answer) }',
        expectedOutput: '84',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
      },
    }],
    review: {
      status: 'approved',
      reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
    },
  }
}

describe('content pack validation', () => {
  it('accepts only namespaced content-addressed revisions in their exact fields', () => {
    expect(contentVersionSchema.safeParse('1.2.3').success).toBe(false)
    expect(contentVersionSchema.safeParse(contentVersion).success).toBe(true)
    expect(contentVersionSchema.safeParse(learningContractVersion).success)
      .toBe(false)
    expect(learningContractVersionSchema.safeParse('1.2.3').success).toBe(false)
    expect(
      learningContractVersionSchema.safeParse(learningContractVersion).success,
    ).toBe(true)
    expect(learningContractVersionSchema.safeParse(contentVersion).success)
      .toBe(false)

    const pack = approvedPack()
    pack.version = contentVersion
    pack.learningContractVersion = learningContractVersion
    for (const template of pack.exerciseTemplates)
      template.version = contentVersion

    expect(validateContentPack(pack).status).toBe('validated')
    expect(contentPacksResponseSchema.safeParse({
      packs: [pack],
      currentVersions: {
        [pack.concept.id]: contentVersion,
      },
    }).success).toBe(true)
  })

  it('rejects malformed, swapped, and non-final revisions', () => {
    expect(contentVersionSchema.safeParse(`cv:sha256:${'A'.repeat(64)}`).success)
      .toBe(false)
    expect(contentVersionSchema.safeParse(`cv:sha256:${'a'.repeat(63)}`).success)
      .toBe(false)
    expect(contentVersionSchema.safeParse('unversioned').success).toBe(false)
    expect(
      learningContractVersionSchema.safeParse(`lc:sha256:${'a'.repeat(65)}`)
        .success,
    ).toBe(false)

    const swapped = approvedPack()
    swapped.version = `lc:sha256:${'a'.repeat(64)}`
    swapped.learningContractVersion = `cv:sha256:${'b'.repeat(64)}`
    expect(validateContentPack(swapped).status).toBe('invalid')
  })

  it('rejects identifier boundary whitespace instead of normalizing identity', () => {
    expect(contentPackIdSchema.parse('pack:stable')).toBe('pack:stable')
    expect(contentPackIdSchema.safeParse(' pack:stable').success).toBe(false)
    expect(contentPackIdSchema.safeParse('pack:stable ').success).toBe(false)
    expect(contentPackIdSchema.safeParse('pack:\u0000stable').success)
      .toBe(false)
  })

  it('rejects repository-local or model-asserted approval identities', () => {
    const pack = approvedPack()

    expect(validateContentPack({
      ...pack,
      review: {
        status: 'approved',
        reviewedBy: 'repository-review-declaration:forged',
      },
    })).toMatchObject({
      status: 'invalid',
      issues: [expect.stringContaining('external review attestation')],
    })
  })

  it('rejects code samples without an explicit executable classification', () => {
    const pack = approvedPack()
    pack.blocks = [{
      id: 'block:unclassified-code',
      type: 'code_sample',
      code: 'main() {}',
      language: 'cangjie',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '01-welcome/01-intro/01',
        title: 'Unclassified code',
      }],
    }] as unknown as typeof pack.blocks

    expect(validateContentPack(pack).status).toBe('invalid')
  })

  it('keeps externally reviewed prose or snippets read-only without a runnable program', () => {
    const pack = approvedPack()
    pack.blocks = pack.blocks.filter(block => block.type === 'prose')
    expect(validateContentPack(pack).status).toBe('read_only')

    const snippetOnly = approvedPack()
    const program = snippetOnly.blocks[1]!
    snippetOnly.blocks = [{
      ...program,
      sampleType: 'snippet' as const,
    }] as unknown as typeof snippetOnly.blocks
    expect(validateContentPack(snippetOnly).status).toBe('read_only')
  })

  it('rejects mainline content when an Exercise Template does not trace to a Learning Skill', () => {
    const result = validateContentPack({
      id: 'pack:cj.var.immutable',
      version: contentVersion,
      learningContractVersion,
      concept: {
        id: 'cj.var.immutable',
        title: '不可变绑定 let',
        summary: 'let 绑定初始化后不能重新赋值。',
        prerequisites: [],
      },
      blocks: [{
        id: 'block:let',
        type: 'prose',
        markdown: '`let` 创建不可变绑定。',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '02-basics/01-bindings/01',
          title: 'let（不可变绑定）',
        }],
      }],
      learningSkills: [],
      exerciseTemplates: [{
        id: 'template:let:practice',
        version: contentVersion,
        learningSkillId: 'skill:let:declare',
        purpose: 'practice',
        task: {
          type: 'code_output',
          prompt: '声明一个不可变绑定并打印它。',
          starterCode: 'main() {}',
          expectedOutput: '42',
          matchMode: 'exact',
          sourceRequirements: [{ type: 'top_level_main' }],
        },
      }],
      review: {
        status: 'approved',
        reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
      },
    })

    expect(result).toEqual({
      status: 'invalid',
      issues: [expect.stringContaining('skill:let:declare')],
    })
  })

  it('rejects regex output matching from Exercise Templates', () => {
    const pack = approvedPack()
    pack.exerciseTemplates[0].task.matchMode = 'regex'

    const result = validateContentPack(pack)

    expect(result.status).toBe('invalid')
    if (result.status === 'invalid')
      expect(result.issues.join(' ')).toContain('matchMode')
  })

  it('rejects an empty contains matcher but permits an exact empty output', () => {
    const alwaysPassingPack = approvedPack()
    alwaysPassingPack.exerciseTemplates[0].task.matchMode = 'contains'
    alwaysPassingPack.exerciseTemplates[0].task.expectedOutput = '   '

    const invalid = validateContentPack(alwaysPassingPack)
    expect(invalid.status).toBe('invalid')
    if (invalid.status === 'invalid')
      expect(invalid.issues.join(' ')).toContain('non-empty')

    const exactEmptyPack = approvedPack()
    exactEmptyPack.exerciseTemplates[0].task.expectedOutput = ''
    expect(validateContentPack(exactEmptyPack).status).toBe('validated')
  })

  it('rejects output-only code tasks with no Learning Skill source contract', () => {
    const pack = approvedPack()
    pack.exerciseTemplates[0].task.sourceRequirements = []

    const result = validateContentPack(pack)
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid')
      expect(result.issues.join(' ')).toContain('sourceRequirements')
  })

  it('rejects presentation-order chapterStep references', () => {
    const pack = approvedPack()
    pack.blocks[0].sourceReferences[0].ref = 'basics/1'

    const result = validateContentPack(pack)

    expect(result.status).toBe('invalid')
    if (result.status === 'invalid')
      expect(result.issues.join(' ')).toContain('chapterId/subChapterId/sectionId')
  })

  it('keeps a Concept Read-Only until every skill has practice and review templates', () => {
    const pack = approvedPack()
    pack.exerciseTemplates = pack.exerciseTemplates
      .filter(template => template.purpose === 'practice')

    expect(validateContentPack(pack).status).toBe('read_only')
  })

  it('keeps a Concept Read-Only when review merely repeats the practice assessment contract', () => {
    const pack = approvedPack()
    pack.exerciseTemplates[1].task = structuredClone(pack.exerciseTemplates[0].task)

    expect(validateContentPack(pack).status).toBe('read_only')
  })

  it('requires every Review Check to be fresh against every earlier assessment form', () => {
    const pack = approvedPack()
    const alternatePractice = structuredClone(pack.exerciseTemplates[0])
    alternatePractice.id = 'template:let:practice:alternate'
    alternatePractice.task.expectedOutput = '84'
    pack.exerciseTemplates.splice(1, 0, alternatePractice)
    pack.exerciseTemplates[2].task = structuredClone(
      pack.exerciseTemplates[0].task,
    )

    expect(validateContentPack(pack).status).toBe('read_only')

    const repeatedReview = approvedPack()
    const secondReview = structuredClone(repeatedReview.exerciseTemplates[1])
    secondReview.id = 'template:let:review:duplicate'
    repeatedReview.exerciseTemplates.push(secondReview)
    expect(validateContentPack(repeatedReview).status).toBe('read_only')
  })

  it('does not mistake a weaker matcher or extra source rule for a fresh code assessment', () => {
    const sourceRuleOnly = approvedPack()
    sourceRuleOnly.exerciseTemplates[1].task.expectedOutput = '42'
    const bindingRequirement = {
      type: 'binding',
      binding: 'let',
      name: 'answer',
    }
    sourceRuleOnly.exerciseTemplates[1].task.sourceRequirements = [
      { type: 'top_level_main' },
      bindingRequirement,
    ]
    expect(validateContentPack(sourceRuleOnly).status).toBe('read_only')

    const weakerMatcher = approvedPack()
    weakerMatcher.exerciseTemplates[1].task.expectedOutput = '4'
    weakerMatcher.exerciseTemplates[1].task.matchMode = 'contains'
    expect(validateContentPack(weakerMatcher).status).toBe('read_only')

    const provablyDifferentOutput = approvedPack()
    provablyDifferentOutput.exerciseTemplates[1].task.expectedOutput = '84'
    expect(validateContentPack(provablyDifferentOutput).status).toBe('validated')
  })

  it('does not mistake quiz distractors or the multiple flag for a fresh assessment', () => {
    const distractorOnly = approvedPack() as unknown as CourseContentPack
    distractorOnly.exerciseTemplates[0]!.task = {
      type: 'quiz',
      questions: [{
        question: 'Choose the immutable binding.',
        options: ['let', 'var'],
        answerIndices: [0],
        multiple: false,
        explanation: '`let` is immutable.',
      }],
    }
    distractorOnly.exerciseTemplates[1]!.task = {
      type: 'quiz',
      questions: [{
        question: 'Choose the immutable binding again.',
        options: ['let', 'var', 'const-like distractor'],
        answerIndices: [0],
        multiple: true,
        explanation: 'The accepted answer has not changed.',
      }],
    }

    expect(validateContentPack(distractorOnly).status).toBe('read_only')

    const changedAnswer = structuredClone(distractorOnly)
    changedAnswer.exerciseTemplates[1]!.task = {
      type: 'quiz',
      questions: [{
        question: 'Choose the mutable binding.',
        options: ['let', 'var'],
        answerIndices: [1],
        multiple: false,
        explanation: '`var` is mutable.',
      }],
    }
    expect(validateContentPack(changedAnswer).status).toBe('validated')
  })

  it('rejects unknown fields instead of silently stripping them', () => {
    const pack = approvedPack()
    const task = pack.exerciseTemplates[0].task as Record<string, unknown>
    task.unreviewedMatcher = 'always-pass'

    const result = validateContentPack(pack)

    expect(result.status).toBe('invalid')
    if (result.status === 'invalid')
      expect(result.issues.join(' ')).toContain('unreviewedMatcher')
  })

  it('keeps publication bounds identical to the complete teacher read contract', () => {
    const tooManyBlocks = approvedPack()
    tooManyBlocks.blocks = Array.from({ length: 49 }, (_, index) => ({
      ...structuredClone(tooManyBlocks.blocks[0]),
      id: `block:${index}`,
    }))
    expect(validateContentPack(tooManyBlocks).status).toBe('invalid')

    const oversizedIdentity = approvedPack()
    oversizedIdentity.blocks[0].id = 'i'.repeat(201)
    expect(validateContentPack(oversizedIdentity).status).toBe('invalid')

    const oversizedProjection = approvedPack()
    oversizedProjection.blocks[0].markdown = 'x'.repeat(80_000)
    const result = validateContentPack(oversizedProjection)
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') {
      expect(result.issues.join(' ')).toContain(
        'teacher-readable Content Pack projection exceeds 80000 characters',
      )
    }
  })

  it('rejects ambiguous duplicate quiz options and questions', () => {
    const question = {
      question: 'Which keyword?',
      options: ['let', 'let'],
      answerIndices: [0],
      multiple: false,
      explanation: 'Use let.',
    }
    expect(exerciseTaskSchema.safeParse({
      type: 'quiz',
      questions: [question],
    }).success).toBe(false)
    expect(exerciseTaskSchema.safeParse({
      type: 'quiz',
      questions: [
        { ...question, options: ['let', 'var'] },
        { ...question, options: ['let', 'var'] },
      ],
    }).success).toBe(false)
  })

  it('rejects duplicate correct-option indices', () => {
    expect(exerciseTaskSchema.safeParse({
      type: 'quiz',
      questions: [{
        question: 'Which keyword?',
        options: ['let', 'var'],
        answerIndices: [0, 0],
        multiple: true,
        explanation: 'Use let.',
      }],
    }).success).toBe(false)
  })

  it('requires an explicit current version for every published Concept', () => {
    expect(contentPacksResponseSchema.safeParse({
      packs: [approvedPack()],
      currentVersions: {},
    }).success).toBe(false)
  })
})
