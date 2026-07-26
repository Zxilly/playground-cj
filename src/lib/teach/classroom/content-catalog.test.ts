import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import { createContentPackCatalog } from './content-catalog'

function validatedPack(
  conceptId: string,
  prerequisites: string[] = [],
): CourseContentPack {
  return {
    id: `pack:${conceptId}`,
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: conceptId,
      title: conceptId,
      summary: `Learn ${conceptId}.`,
      prerequisites,
    },
    blocks: [
      {
        id: `block:${conceptId}`,
        type: 'prose' as const,
        markdown: `Content for ${conceptId}.`,
        sourceReferences: [{
          sourceId: 'static-tour' as const,
          ref: '01-test/01-test/01',
          title: conceptId,
        }],
      },
      {
        id: `block:${conceptId}:program`,
        type: 'code_sample' as const,
        code: `main() {\n    println("${conceptId}")\n}`,
        language: 'cangjie' as const,
        sampleType: 'program' as const,
        sourceReferences: [{
          sourceId: 'static-tour' as const,
          ref: '01-test/01-test/01',
          title: conceptId,
        }],
      },
    ],
    learningSkills: [{
      id: `skill:${conceptId}`,
      conceptId,
      title: `Skill ${conceptId}`,
      description: `Use ${conceptId}.`,
      key: true,
    }],
    exerciseTemplates: [{
      id: `practice:${conceptId}`,
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningSkillId: `skill:${conceptId}`,
      purpose: 'practice' as const,
      task: {
        type: 'recall' as const,
        prompt: `Practice ${conceptId}.`,
        referenceAnswer: `practice ${conceptId}`,
      },
    }, {
      id: `review:${conceptId}`,
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningSkillId: `skill:${conceptId}`,
      purpose: 'review' as const,
      task: {
        type: 'code_output' as const,
        prompt: `Review ${conceptId}.`,
        starterCode: 'main() {}',
        expectedOutput: conceptId,
        matchMode: 'exact' as const,
        sourceRequirements: [{ type: 'top_level_main' as const }],
        hints: [],
      },
    }],
    review: {
      status: 'approved' as const,
      reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
    },
  }
}

describe('course Content Pack catalog', () => {
  it('keeps unapproved content available for review but out of mainline tutoring', () => {
    const catalog = createContentPackCatalog([{
      id: 'pack:cj.var.immutable',
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
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
      exerciseTemplates: [],
      review: { status: 'pending' },
    }])

    expect(catalog.list()).toMatchObject([{
      conceptId: 'cj.var.immutable',
      availability: 'read_only',
    }])
    expect(catalog.get('cj.var.immutable')?.concept.title).toBe('不可变绑定 let')
    expect(() => catalog.requireValidated('cj.var.immutable')).toThrow(/not a Validated Concept/)
  })

  it('retains historical versions and uses explicit current instead of semver order', () => {
    const base = {
      id: 'pack:cj.program.main',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      concept: {
        id: 'cj.program.main',
        title: 'main',
        summary: 'Program entry point.',
        prerequisites: [],
      },
      learningSkills: [{
        id: 'skill:main',
        conceptId: 'cj.program.main',
        title: 'Run main',
        description: 'Run a program entry point.',
        key: true,
      }],
      exerciseTemplates: [
        {
          id: 'template:main',
          version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          learningSkillId: 'skill:main',
          purpose: 'practice',
          task: {
            type: 'code_output',
            prompt: 'Print hello',
            starterCode: 'main() {}',
            expectedOutput: 'hello',
            matchMode: 'exact',
            sourceRequirements: [{ type: 'top_level_main' }],
            hints: [],
          },
        },
        {
          id: 'template:main:review',
          version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          learningSkillId: 'skill:main',
          purpose: 'review',
          task: {
            type: 'recall',
            prompt: 'Name the entry function',
            referenceAnswer: 'main',
          },
        },
      ],
      review: {
        status: 'approved',
        reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
      },
    } as const
    const catalog = createContentPackCatalog([
      {
        ...base,
        version: 'cv:sha256:1111111111111111111111111111111111111111111111111111111111111111',
        blocks: [{
          id: 'block:old',
          type: 'prose',
          markdown: 'Old content.',
          sourceReferences: [{
            sourceId: 'static-tour',
            ref: '01-basics/01-program/01',
            title: 'main',
          }],
        }],
      },
      {
        ...base,
        version: 'cv:sha256:2222222222222222222222222222222222222222222222222222222222222222',
        blocks: [{
          id: 'block:new',
          type: 'prose',
          markdown: 'New content.',
          sourceReferences: [{
            sourceId: 'static-tour',
            ref: '01-basics/01-program/01',
            title: 'main',
          }],
        }],
      },
    ], {
      'cj.program.main': 'cv:sha256:1111111111111111111111111111111111111111111111111111111111111111',
    })

    expect(catalog.get('cj.program.main')?.version).toBe('cv:sha256:1111111111111111111111111111111111111111111111111111111111111111')
    expect(catalog.getVersion('cj.program.main', 'cv:sha256:1111111111111111111111111111111111111111111111111111111111111111')?.blocks[0]?.id).toBe('block:old')
    expect(catalog.getVersion('cj.program.main', 'cv:sha256:2222222222222222222222222222222222222222222222222222222222222222')?.blocks[0]?.id).toBe('block:new')
    expect(catalog.listVersions('cj.program.main')).toEqual(['cv:sha256:1111111111111111111111111111111111111111111111111111111111111111', 'cv:sha256:2222222222222222222222222222222222222222222222222222222222222222'])
  })

  it('fails closed when multiple versions have no explicit current designation', () => {
    const pack = {
      id: 'pack:test',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      concept: {
        id: 'concept:test',
        title: 'Test',
        summary: 'Test content.',
        prerequisites: [],
      },
      blocks: [{
        id: 'block:test',
        type: 'prose',
        markdown: 'Test.',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '01-test/01-test/01',
          title: 'Test',
        }],
      }],
      learningSkills: [],
      exerciseTemplates: [],
      review: { status: 'pending' },
    } as const

    expect(() => createContentPackCatalog([
      { ...pack, version: 'cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      { ...pack, version: 'cv:sha256:9999999999999999999999999999999999999999999999999999999999999999' },
    ])).toThrow(/require an explicit current version/)
  })

  it('does not silently omit a Concept when an explicit current-version map is incomplete', () => {
    const pack = {
      id: 'pack:test',
      version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      concept: {
        id: 'concept:test',
        title: 'Test',
        summary: 'Test content.',
        prerequisites: [],
      },
      blocks: [{
        id: 'block:test',
        type: 'prose',
        markdown: 'Test.',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '01-test/01-test/01',
          title: 'Test',
        }],
      }],
      learningSkills: [],
      exerciseTemplates: [],
      review: { status: 'pending' },
    } as const

    expect(() => createContentPackCatalog([pack], {}))
      .toThrow(/missing an explicit current version/)
  })

  it('downgrades missing, read-only, and cyclic prerequisite graphs', () => {
    const missing = validatedPack('concept:missing-child', ['concept:absent'])
    const readOnlyRoot = validatedPack('concept:pending')
    readOnlyRoot.review = { status: 'pending' as const }
    const readOnlyChild = validatedPack(
      'concept:pending-child',
      ['concept:pending'],
    )
    const cycleA = validatedPack('concept:cycle-a', ['concept:cycle-b'])
    const cycleB = validatedPack('concept:cycle-b', ['concept:cycle-a'])
    const healthyRoot = validatedPack('concept:root')
    const healthyChild = validatedPack('concept:child', ['concept:root'])

    const catalog = createContentPackCatalog([
      missing,
      readOnlyRoot,
      readOnlyChild,
      cycleA,
      cycleB,
      healthyRoot,
      healthyChild,
    ])
    const summaries = new Map(catalog.list().map(summary => [
      summary.conceptId,
      summary,
    ]))

    for (const conceptId of [
      'concept:missing-child',
      'concept:pending-child',
      'concept:cycle-a',
      'concept:cycle-b',
    ]) {
      expect(summaries.get(conceptId)).toMatchObject({
        availability: 'read_only',
        availabilityReason: 'prerequisite_graph_invalid',
      })
      expect(() => catalog.requireValidated(conceptId)).toThrow(
        /not a Validated Concept/,
      )
    }
    expect(summaries.get('concept:pending')).toMatchObject({
      availability: 'read_only',
      availabilityReason: 'editorial_review',
    })
    expect(summaries.get('concept:root')?.availability).toBe('validated')
    expect(summaries.get('concept:child')?.availability).toBe('validated')
  })
})
