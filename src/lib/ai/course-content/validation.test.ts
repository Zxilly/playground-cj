import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './types'
import { createCourseContentIndex, getDefaultCourseContentIndex, getDefaultCourseContentPack, getLocalizedBlockContent } from './loader'
import { assertValidCourseContentPack, validateCourseContentPack } from './validation'

function source(path = '02-basics/01-bindings/01') {
  return {
    kind: 'static_tour' as const,
    tourPath: `tour/${path}/index.zh.mdx`,
    chapterId: path.split('/')[0],
    subChapterId: path.split('/')[1],
    sectionId: path.split('/')[2],
    language: 'zh' as const,
  }
}

function validPack(): CourseContentPack {
  return {
    packId: 'default-entry',
    contentVersion: '2026-05-28',
    generatedAt: '2026-05-28T00:00:00.000Z',
    concepts: [
      {
        conceptId: 'cj.var.immutable',
        title: { zh: '不可变绑定 let', en: 'Immutable let binding' },
        summary: { zh: 'let 绑定不可重新赋值。', en: 'let bindings cannot be reassigned.' },
        blockIds: ['cj.var.immutable.heading', 'cj.var.immutable.example'],
        skillIds: ['cj.var.immutable.choose-let'],
      },
      {
        conceptId: 'cj.io.println',
        title: { zh: '标准输出 println', en: 'Standard output println' },
        summary: { zh: '使用 println 输出。', en: 'Use println for output.' },
        blockIds: ['cj.io.println.heading'],
        skillIds: [],
      },
    ],
    blocks: [
      {
        blockId: 'cj.var.immutable.heading',
        conceptId: 'cj.var.immutable',
        contentVersion: '2026-05-28',
        order: 0,
        content: { type: 'heading', text: '不可变绑定 let', level: 2 },
        sourceRefs: [source()],
      },
      {
        blockId: 'cj.var.immutable.example',
        conceptId: 'cj.var.immutable',
        contentVersion: '2026-05-28',
        order: 1,
        content: { type: 'code_example', title: 'let 示例', code: 'main() {\n    let value = 3\n    println(value)\n}', language: 'cangjie' },
        sourceRefs: [source()],
        runnable: { status: 'runnable' },
      },
      {
        blockId: 'cj.io.println.heading',
        conceptId: 'cj.io.println',
        contentVersion: '2026-05-28',
        order: 0,
        content: { type: 'paragraph', body: '使用 `println` 输出值。' },
        sourceRefs: [source('01-welcome/01-intro/01')],
      },
    ],
    skills: [
      {
        skillId: 'cj.var.immutable.choose-let',
        conceptIds: ['cj.var.immutable'],
        title: { zh: '选择 let', en: 'Choose let' },
        summary: { zh: '能在不需要重新赋值时选择 let。', en: 'Choose let when reassignment is unnecessary.' },
        evidenceCriteria: ['Uses let for a value that is not reassigned.'],
      },
    ],
    exerciseTemplates: [
      {
        templateId: 'cj.var.immutable.choose-let.print',
        templateVersion: '1',
        skillId: 'cj.var.immutable.choose-let',
        conceptIds: ['cj.var.immutable'],
        title: { zh: '打印不可变值', en: 'Print an immutable value' },
        prompt: { zh: '声明不可变变量并打印 3。', en: 'Declare an immutable value and print 3.' },
        starterCode: 'main() {\n    // TODO\n}',
        expectedOutput: '3',
        matchMode: 'exact',
        intent: 'mainline',
        difficulty: 1,
        sourceRefs: [source()],
      },
    ],
    tracks: [
      {
        trackId: 'default-entry',
        title: { zh: '入门路径', en: 'Entry track' },
        conceptIds: ['cj.io.println', 'cj.var.immutable'],
        skillIds: ['cj.var.immutable.choose-let'],
      },
    ],
  }
}

describe('course content pack validation', () => {
  it('accepts a valid pack and classifies validated and read-only concepts', () => {
    const result = validateCourseContentPack(validPack())

    expect(result).toEqual({
      ok: true,
      issues: [],
      conceptStatuses: {
        'cj.var.immutable': 'validated',
        'cj.io.println': 'read_only',
      },
    })
  })

  it('rejects duplicate ids with actionable paths', () => {
    const pack = validPack()
    pack.blocks.push({ ...pack.blocks[0] })

    const result = validateCourseContentPack(pack)

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'blocks.3.blockId',
        message: expect.stringContaining('Duplicate id'),
      }),
    ]))
  })

  it('rejects missing source references at the schema boundary', () => {
    const pack = validPack()
    pack.blocks[0] = { ...pack.blocks[0], sourceRefs: [] }

    const result = validateCourseContentPack(pack)

    expect(result.ok).toBe(false)
    expect(result.issues[0]).toMatchObject({
      path: 'blocks.0.sourceRefs',
    })
  })

  it('rejects code examples without runnable markers', () => {
    const pack = validPack()
    pack.blocks[1] = { ...pack.blocks[1], runnable: undefined }

    const result = validateCourseContentPack(pack)

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: 'blocks.1.runnable',
      message: 'Code example "cj.var.immutable.example" must declare runnable status',
    })
  })

  it('rejects concepts whose block links do not resolve', () => {
    const pack = validPack()
    pack.concepts[0] = {
      ...pack.concepts[0],
      blockIds: ['missing.block'],
    }

    const result = validateCourseContentPack(pack)

    expect(result.ok).toBe(false)
    expect(result.conceptStatuses['cj.var.immutable']).toBe('invalid')
    expect(result.issues).toContainEqual({
      path: 'concepts.0.blockIds',
      message: 'Unknown block "missing.block"',
    })
  })

  it('indexes blocks by concept in content-pack order', () => {
    const index = createCourseContentIndex(validPack())

    expect(index.getBlocksForConcept('cj.var.immutable').map(block => block.blockId)).toEqual([
      'cj.var.immutable.heading',
      'cj.var.immutable.example',
    ])
    expect(index.getExerciseTemplatesForSkill('cj.var.immutable.choose-let')).toHaveLength(1)
  })

  it('loads the default entry Course Content Pack as validated content', () => {
    const pack = getDefaultCourseContentPack()
    const result = validateCourseContentPack(pack)
    const index = getDefaultCourseContentIndex()

    expect(result.ok).toBe(true)
    expect(Object.values(result.conceptStatuses)).toEqual(expect.arrayContaining(['validated']))
    expect(index.getBlocksForConcept('cj.var.immutable').map(block => block.blockId)).toEqual([
      'cj.var.immutable.heading',
      'cj.var.immutable.rule',
      'cj.var.immutable.example',
    ])
    expect(index.getExerciseTemplatesForSkill('cj.var.immutable.choose-let').map(template => template.templateId)).toEqual([
      'cj.var.immutable.choose-let.answer',
    ])
  })

  it('serves localized block content for English classrooms without changing default zh content', () => {
    const index = getDefaultCourseContentIndex()
    const block = index.getBlock('cj.program.main.heading')!

    expect(getLocalizedBlockContent(block, 'zh')).toEqual({ type: 'heading', text: '程序入口与 main', level: 2 })
    expect(getLocalizedBlockContent(block, 'en')).toEqual({ type: 'heading', text: 'Program entry and main', level: 2 })
  })

  it('throws with readable diagnostics when asserting invalid packs', () => {
    const pack = validPack()
    pack.tracks[0] = { ...pack.tracks[0], conceptIds: ['missing.concept'] }

    expect(() => assertValidCourseContentPack(pack)).toThrow(/tracks\.0\.conceptIds: Unknown concept "missing\.concept"/)
  })
})
