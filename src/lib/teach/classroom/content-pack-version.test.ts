import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import {
  assignBilingualLearningContractVersions,
  assignImmutableContentVersion,
} from './content-pack-version'

function unversionedPack(locale: 'en' | 'zh'): CourseContentPack {
  const english = locale === 'en'
  return {
    id: 'pack:cj.var.immutable',
    version: 'unversioned',
    learningContractVersion: 'unversioned',
    concept: {
      id: 'cj.var.immutable',
      title: english ? 'Immutable binding' : '不可变绑定',
      summary: english
        ? 'A let binding cannot be reassigned.'
        : 'let 绑定不能重新赋值。',
      prerequisites: ['cj.program.main'],
    },
    blocks: [{
      id: 'block:cj.var.immutable:intro',
      type: 'prose',
      markdown: english ? 'Use `let`.' : '使用 `let`。',
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '02-basics/01-bindings/01',
        title: english ? 'Bindings' : '绑定',
      }],
    }],
    learningSkills: [{
      id: 'skill:cj.var.immutable:core',
      conceptId: 'cj.var.immutable',
      title: english ? 'Declare a let binding' : '声明 let 绑定',
      description: english
        ? 'Declare and use an immutable binding.'
        : '声明并使用不可变绑定。',
      key: true,
    }],
    exerciseTemplates: [{
      id: 'template:cj.var.immutable:practice',
      version: 'unversioned',
      learningSkillId: 'skill:cj.var.immutable:core',
      purpose: 'practice',
      task: {
        type: 'code_output',
        prompt: english ? 'Print 42 from a let binding.' : '用 let 绑定输出 42。',
        starterCode: english
          ? '// Complete the program.\nmain() {}'
          : '// 完成程序。\nmain() {}',
        expectedOutput: '42',
        matchMode: 'exact',
        sourceRequirements: [
          { type: 'top_level_main' },
          { type: 'integer_binding', binding: 'let', name: 'answer', value: 42 },
        ],
        hints: [english ? 'Use let.' : '使用 let。'],
      },
    }],
    review: { status: 'pending' },
  }
}

describe('immutable Content Pack versions', () => {
  it('uses full namespaced SHA-256 revisions rather than decimalized hashes', () => {
    const bilingual = assignBilingualLearningContractVersions(
      [unversionedPack('en')],
      [unversionedPack('zh')],
    )
    const english = assignImmutableContentVersion(bilingual.en[0], 'en')

    expect(english.learningContractVersion)
      .toMatch(/^lc:sha256:[a-f0-9]{64}$/)
    expect(english.version).toMatch(/^cv:sha256:[a-f0-9]{64}$/)
    expect(english.exerciseTemplates.every(template =>
      template.version === english.version)).toBe(true)
  })

  it('does not assign a Content Version before the Learning Contract exists', () => {
    expect(() => assignImmutableContentVersion(
      unversionedPack('en'),
      'en',
    )).toThrow(/no assigned Learning Contract Version/)
  })

  it('separates locale-specific content identity from the locale-neutral learning contract', () => {
    const bilingual = assignBilingualLearningContractVersions(
      [unversionedPack('en')],
      [unversionedPack('zh')],
    )
    const english = assignImmutableContentVersion(bilingual.en[0], 'en')
    const chinese = assignImmutableContentVersion(bilingual.zh[0], 'zh')

    expect(english.version).not.toBe(chinese.version)
    expect(english.learningContractVersion)
      .toBe(chinese.learningContractVersion)
  })

  it('changes the learning contract only when a learning or evaluator invariant changes', () => {
    const originalPair = assignBilingualLearningContractVersions(
      [unversionedPack('en')],
      [unversionedPack('zh')],
    )
    const original = assignImmutableContentVersion(originalPair.en[0], 'en')
    const localizedProse = unversionedPack('en')
    localizedProse.concept.title = 'A different localized title'
    const firstBlock = localizedProse.blocks[0]
    if (firstBlock.type !== 'prose')
      throw new Error('test fixture requires a prose block')
    firstBlock.markdown = 'A different explanation.'
    const prosePair = assignBilingualLearningContractVersions(
      [localizedProse],
      [unversionedPack('zh')],
    )
    const proseChange = assignImmutableContentVersion(prosePair.en[0], 'en')
    const semanticChange = unversionedPack('en')
    const task = semanticChange.exerciseTemplates[0].task
    if (task.type !== 'code_output')
      throw new Error('test fixture requires a code-output task')
    task.expectedOutput = '84'
    const semanticChinese = unversionedPack('zh')
    const chineseTask = semanticChinese.exerciseTemplates[0].task
    if (chineseTask.type !== 'code_output')
      throw new Error('test fixture requires a code-output task')
    chineseTask.expectedOutput = '84'
    const semanticPair = assignBilingualLearningContractVersions(
      [semanticChange],
      [semanticChinese],
    )
    const changedContract = assignImmutableContentVersion(
      semanticPair.en[0],
      'en',
    )

    expect(proseChange.version).not.toBe(original.version)
    expect(proseChange.learningContractVersion)
      .toBe(original.learningContractVersion)
    expect(
      changedContract.learningContractVersion,
    ).not.toBe(original.learningContractVersion)
  })

  it('invalidates canonical recall answers and quiz option semantics', () => {
    const addAnswerTasks = (
      pack: CourseContentPack,
      locale: 'en' | 'zh',
    ): CourseContentPack => {
      const english = locale === 'en'
      pack.exerciseTemplates.push({
        id: 'template:cj.var.immutable:recall',
        version: 'unversioned',
        learningSkillId: 'skill:cj.var.immutable:core',
        purpose: 'review',
        task: {
          type: 'recall',
          prompt: english ? 'Name the keyword.' : '写出关键字。',
          referenceAnswer: english ? 'let' : '不可变绑定 let',
        },
      }, {
        id: 'template:cj.var.immutable:quiz',
        version: 'unversioned',
        learningSkillId: 'skill:cj.var.immutable:core',
        purpose: 'placement',
        task: {
          type: 'quiz',
          questions: [{
            question: english ? 'Which binding is immutable?' : '哪个绑定不可变？',
            options: english ? ['let', 'var'] : ['不可变 let', '可变 var'],
            answerIndices: [0],
            multiple: false,
            explanation: english ? 'let is immutable.' : 'let 不可变。',
          }],
        },
      })
      return pack
    }
    const originalPair = assignBilingualLearningContractVersions(
      [addAnswerTasks(unversionedPack('en'), 'en')],
      [addAnswerTasks(unversionedPack('zh'), 'zh')],
    )

    const changedRecall = addAnswerTasks(unversionedPack('en'), 'en')
    const recallTask = changedRecall.exerciseTemplates
      .find(template => template.task.type === 'recall')
      ?.task
    if (!recallTask || recallTask.type !== 'recall')
      throw new Error('test fixture requires a recall task')
    recallTask.referenceAnswer = 'const'
    const recallPair = assignBilingualLearningContractVersions(
      [changedRecall],
      [addAnswerTasks(unversionedPack('zh'), 'zh')],
    )

    const changedQuiz = addAnswerTasks(unversionedPack('en'), 'en')
    const quizTask = changedQuiz.exerciseTemplates
      .find(template => template.task.type === 'quiz')
      ?.task
    if (!quizTask || quizTask.type !== 'quiz')
      throw new Error('test fixture requires a quiz task')
    quizTask.questions[0].options[0] = 'const'
    const quizPair = assignBilingualLearningContractVersions(
      [changedQuiz],
      [addAnswerTasks(unversionedPack('zh'), 'zh')],
    )

    expect(
      recallPair.en[0].learningContractVersion,
    ).not.toBe(originalPair.en[0].learningContractVersion)
    expect(
      quizPair.en[0].learningContractVersion,
    ).not.toBe(originalPair.en[0].learningContractVersion)
    expect(originalPair.zh[0].learningContractVersion)
      .toBe(originalPair.en[0].learningContractVersion)
  })

  it('rejects bilingual evaluator structures that disagree', () => {
    const chinese = unversionedPack('zh')
    const task = chinese.exerciseTemplates[0].task
    if (task.type !== 'code_output')
      throw new Error('test fixture requires a code-output task')
    task.expectedOutput = '84'

    expect(() => assignBilingualLearningContractVersions(
      [unversionedPack('en')],
      [chinese],
    )).toThrow(/structure differs/)
  })
})
