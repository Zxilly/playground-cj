import { describe, expect, it } from 'vitest'
import { getAllConcepts } from '@/lib/ai/concept-graph/loader'
import type { ConceptNode } from '@/lib/ai/concept-graph/types'
import { flattenSections, loadTourData } from '@/tour/loader'
import type { FlatSection } from '@/tour/types'
import {
  buildCourseContentPacks,
  getContentPackReferenceValidationCases,
  mdxToSafeMarkdown,
  VALIDATED_CONTENT_CONCEPT_IDS,
} from './content-pack-builder'
import { buildCurrentCourseContentPacks } from './content-pack-generation'
import { validateContentPack } from './content-packs'

describe('course content pack builder', () => {
  it('marks builder output as a non-publishable unversioned draft', async () => {
    const [draft] = buildCourseContentPacks(
      flattenSections(await loadTourData()),
      getAllConcepts().slice(0, 1),
      'en',
    )

    expect(draft.version).toBe('unversioned')
    expect(draft.learningContractVersion).toBe('unversioned')
    expect(draft.exerciseTemplates.every(template =>
      template.version === 'unversioned')).toBe(true)
    expect(validateContentPack(draft).status).toBe('invalid')
  }, 30_000)

  it('generates one Learning Contract Version for each bilingual Concept pair', async () => {
    const [english, chinese] = await Promise.all([
      buildCurrentCourseContentPacks('en'),
      buildCurrentCourseContentPacks('zh'),
    ])
    const chineseByConcept = new Map(chinese.map(pack => [
      pack.concept.id,
      pack,
    ]))

    for (const englishPack of english) {
      const chinesePack = chineseByConcept.get(englishPack.concept.id)
      expect(chinesePack).toBeDefined()
      expect(chinesePack?.learningContractVersion)
        .toBe(englishPack.learningContractVersion)
      expect(chinesePack?.version).not.toBe(englishPack.version)
    }
  }, 30_000)

  it('converts Static Tour MDX components into safe Markdown', () => {
    const markdown = mdxToSafeMarkdown([
      '# Bindings',
      '',
      'Click <Highlight target="run">Run</Highlight>.',
      '',
      '<Note>',
      'Prefer `let` when reassignment is unnecessary.',
      '</Note>',
      '',
      '<CompareGroup>',
      '<CompareWith lang="rust">',
      'Rust spells a mutable binding `let mut`.',
      '</CompareWith>',
      '</CompareGroup>',
      '',
      '<script>alert("x")</script>',
    ].join('\n'), 'en')

    expect(markdown).toContain('Click **Run**.')
    expect(markdown).toContain('> **Note:** Prefer `let` when reassignment is unnecessary.')
    expect(markdown).toContain('### Language comparison')
    expect(markdown).toContain('#### Rust')
    expect(markdown).toContain('&lt;script&gt;alert("x")&lt;/script&gt;')
    expect(markdown).not.toMatch(/<\/?(?:Highlight|Note|CompareGroup|CompareWith)\b/)
    expect(markdown).not.toContain('<script>')
  })

  it('keeps Source References stable when chapter steps are reordered', () => {
    const makeSection = (sectionId: string, chapterStep: string): FlatSection => ({
      chapterId: '02-basics',
      chapterSlug: 'basics',
      chapterStep,
      chapterName: { zh: '基础', en: 'Basics' },
      subChapterId: '01-bindings',
      subChapterName: { zh: '变量', en: 'Bindings' },
      sectionId,
      sectionName: { zh: `小节 ${sectionId}`, en: `Section ${sectionId}` },
      markdown: { zh: `# 小节 ${sectionId}`, en: `# Section ${sectionId}` },
      code: { zh: '', en: '' },
    })
    const concept: ConceptNode = {
      conceptId: 'cj.test.bindings',
      title: { zh: '不可变绑定 let', en: 'Immutable binding let' },
      summary: {
        zh: 'let 声明的绑定不能重新赋值。',
        en: 'let bindings cannot be reassigned.',
      },
      difficulty: 1,
      prerequisites: [],
      chapterRefs: ['02-basics/01-bindings'],
    }

    const before = buildCourseContentPacks(
      [makeSection('01', '1'), makeSection('02', '2')],
      [concept],
      'en',
    )
    const after = buildCourseContentPacks(
      [makeSection('02', '1'), makeSection('01', '99')],
      [concept],
      'en',
    )

    expect(after).toEqual(before)
    expect(before[0].blocks.map(block => block.sourceReferences[0].ref)).toEqual([
      '02-basics/01-bindings/01',
      '02-basics/01-bindings/02',
    ])
    expect(JSON.stringify(before)).not.toContain('chapterStep')
  })

  it('fails closed when a Concept Graph source does not resolve', () => {
    const concept: ConceptNode = {
      conceptId: 'cj.missing',
      title: { zh: '缺失', en: 'Missing' },
      summary: { zh: '缺失来源', en: 'Missing source' },
      difficulty: 1,
      prerequisites: [],
      chapterRefs: ['99-missing/01-missing'],
    }

    expect(() => buildCourseContentPacks([], [concept], 'en'))
      .toThrow(/99-missing\/01-missing/)
  })

  it('binds each default Validated Concept to its smallest authoritative section', async () => {
    const packs = buildCourseContentPacks(
      flattenSections(await loadTourData()),
      getAllConcepts(),
      'en',
    )
    const expectedReferences = {
      'cj.program.main': ['01-welcome/01-intro/01'],
      'cj.io.println': ['01-welcome/01-intro/01'],
      'cj.var.immutable': ['02-basics/01-bindings/01'],
      'cj.var.mutable': ['02-basics/01-bindings/02'],
    }

    for (const [conceptId, expected] of Object.entries(expectedReferences)) {
      const pack = packs.find(candidate => candidate.concept.id === conceptId)
      const references = new Set(
        pack?.blocks.flatMap(block =>
          block.sourceReferences.map(reference => reference.ref),
        ),
      )
      expect([...references]).toEqual(expected)
    }
  }, 30_000)

  it('builds explicit bilingual review candidates without self-approval', async () => {
    const concepts = getAllConcepts()

    for (const lang of ['zh', 'en'] as const) {
      const packs = await buildCurrentCourseContentPacks(lang)
      const validations = packs.map(pack => validateContentPack(pack))

      expect(packs).toHaveLength(concepts.length)
      expect(packs.slice(0, 4).map(pack => pack.concept.id))
        .toEqual([...VALIDATED_CONTENT_CONCEPT_IDS])
      expect(validations.every(result => result.status !== 'invalid')).toBe(true)
      expect(validations.every(result => result.status === 'read_only')).toBe(true)
      expect(packs.every(pack =>
        pack.review.status === 'pending'
        && !('reviewedBy' in pack.review))).toBe(true)
      expect(packs.flatMap(pack => pack.blocks)
        .filter(block => block.type === 'code_sample')
        .every(block =>
          block.sampleType === 'program'
          || block.sampleType === 'snippet')).toBe(true)

      for (const conceptId of VALIDATED_CONTENT_CONCEPT_IDS) {
        const pack = packs.find(candidate => candidate.concept.id === conceptId)
        expect(pack, `${lang} ${conceptId}`).toBeDefined()
        if (!pack)
          continue

        expect(pack.learningSkills).toHaveLength(1)
        const [skill] = pack.learningSkills
        expect(new Set(
          pack.exerciseTemplates
            .filter(template => template.learningSkillId === skill.id)
            .map(template => template.purpose),
        )).toEqual(new Set(['placement', 'practice', 'review']))
        for (const template of pack.exerciseTemplates) {
          if (template.task.type === 'code_output') {
            expect(['exact', 'contains']).toContain(template.task.matchMode)
            expect(template.task.starterCode).toContain('TODO')
          }
        }
        expect(validateContentPack({
          ...pack,
          review: {
            status: 'approved',
            reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
          },
        }), `${lang} ${conceptId} evidence loop`).toMatchObject({
          status: 'validated',
        })
      }

      for (const concept of concepts) {
        if (!VALIDATED_CONTENT_CONCEPT_IDS.includes(
          concept.conceptId as typeof VALIDATED_CONTENT_CONCEPT_IDS[number],
        )) {
          const pack = packs.find(candidate =>
            candidate.concept.id === concept.conceptId)
          expect(pack?.learningSkills, `${lang} ${concept.conceptId}`)
            .toEqual([])
        }
      }
    }
  }, 30_000)

  it('labels non-standalone macro code explicitly as a snippet', async () => {
    const concept: ConceptNode = {
      conceptId: 'cj.test.macro-fragment',
      title: { zh: '宏片段', en: 'Macro fragment' },
      summary: {
        zh: '需要宏包上下文的代码。',
        en: 'Code that requires macro-package context.',
      },
      difficulty: 1,
      prerequisites: [],
      chapterRefs: ['10-macros/01-intro/02'],
    }
    const [pack] = buildCourseContentPacks(
      flattenSections(await loadTourData()),
      [concept],
      'en',
    )

    expect(pack.blocks.find(block => block.type === 'code_sample'))
      .toMatchObject({
        type: 'code_sample',
        sampleType: 'snippet',
      })
  }, 30_000)

  it('projects the complete code evaluator contract into reference validation cases', async () => {
    const packs = await buildCurrentCourseContentPacks('en')
    const templates = new Map(packs.flatMap(pack =>
      pack.exerciseTemplates.map(template => [template.id, template])))
    const cases = getContentPackReferenceValidationCases()

    expect(cases).toHaveLength(12)
    for (const validationCase of cases) {
      const template = templates.get(validationCase.templateId)
      expect(template?.task.type).toBe('code_output')
      if (!template || template.task.type !== 'code_output')
        continue

      expect(validationCase).toMatchObject({
        taskType: 'code_output',
        starterCode: template.task.starterCode,
        expectedOutput: template.task.expectedOutput,
        matchMode: template.task.matchMode,
        sourceRequirements: template.task.sourceRequirements,
      })
    }
  }, 30_000)
})
