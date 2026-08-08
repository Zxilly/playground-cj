// @vitest-environment node

import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_COURSE_CONTENT_PACKS,
  BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS,
  BUILT_IN_COURSE_VERSION,
  createBuiltInCourseContentPackCatalog,
} from './built-in-course'
import { createAIClassroom } from './ai-classroom'
import { createIndexedDBClassroomStorage } from './storage'
import { assignImmutableContentVersion } from './content-pack-version'
import { currentCourseVersion } from './content-pack-artifact'

describe('built-in immutable Course Content Packs', () => {
  it('compiles both Git-tracked locales without deployment configuration', () => {
    for (const locale of ['en', 'zh'] as const) {
      const response = BUILT_IN_COURSE_CONTENT_PACKS[locale]
      expect(response.packs.map(pack => pack.concept.id))
        .toEqual([...BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS])
      const catalog = createBuiltInCourseContentPackCatalog(locale)
      expect(catalog.list().map(summary => summary.conceptId))
        .toEqual([...BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS])
    }
  })

  it('retains stable content-addressed versions in the application bundle', () => {
    const response = BUILT_IN_COURSE_CONTENT_PACKS.en
    const original = response.packs[0]
    const repeated = assignImmutableContentVersion(original, 'en')
    const changed = assignImmutableContentVersion({
      ...original,
      blocks: original.blocks.map((block, index) =>
        index === 0 && block.type === 'prose'
          ? { ...block, markdown: `${block.markdown}\nChanged.` }
          : block),
    }, 'en')

    expect(original.version).toMatch(/^cv:sha256:[a-f0-9]{64}$/)
    expect(original.learningContractVersion)
      .toMatch(/^lc:sha256:[a-f0-9]{64}$/)
    expect(repeated).toEqual(original)
    expect(changed.version).not.toBe(original.version)
    expect(
      assignImmutableContentVersion(original, 'zh').version,
    ).not.toBe(original.version)
    expect(original.exerciseTemplates.every(template =>
      template.version === original.version)).toBe(true)
    expect(createBuiltInCourseContentPackCatalog('en').get(
      original.concept.id,
      original.version,
    )).toEqual(original)
  })

  it('shares one logical Course Version across locales', () => {
    expect(BUILT_IN_COURSE_VERSION)
      .toMatch(/^course:sha256:[a-f0-9]{64}$/)
    expect(BUILT_IN_COURSE_CONTENT_PACKS.en.courseVersion)
      .toBe(BUILT_IN_COURSE_CONTENT_PACKS.zh.courseVersion)

    const changedVersion = currentCourseVersion({
      en: BUILT_IN_COURSE_CONTENT_PACKS.en.packs.map((pack, index) =>
        index === 0
          ? { ...pack, version: `cv:sha256:${'d'.repeat(64)}` }
          : pack),
      zh: BUILT_IN_COURSE_CONTENT_PACKS.zh.packs,
    })
    expect(changedVersion).not.toBe(BUILT_IN_COURSE_VERSION)
  })

  it('reopens exact provenance after switching the selected locale', async () => {
    const conceptId = BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS[0]
    const englishPack = BUILT_IN_COURSE_CONTENT_PACKS.en.packs[0]
    const chinesePack = BUILT_IN_COURSE_CONTENT_PACKS.zh.packs[0]
    const englishCatalog = createBuiltInCourseContentPackCatalog('en')
    const databaseName = `bilingual-course-${crypto.randomUUID()}`
    const scope = `classroom:${BUILT_IN_COURSE_VERSION}`
    const english = createAIClassroom({
      catalog: englishCatalog,
      storage: createIndexedDBClassroomStorage({ databaseName, scope }),
    })
    await english.open()
    await english.execute({
      type: 'start_learning_track',
      trackId: 'track:bilingual',
      goal: 'Learn main.',
      conceptIds: [conceptId],
      explicitLearnerGoal: true,
    })
    await english.dispose()

    const chineseCatalog = createBuiltInCourseContentPackCatalog('zh')
    expect(chineseCatalog.get(conceptId)).toEqual(chinesePack)
    expect(chineseCatalog.get(conceptId, englishPack.version))
      .toEqual(englishPack)

    const chinese = createAIClassroom({
      catalog: chineseCatalog,
      storage: createIndexedDBClassroomStorage({ databaseName, scope }),
    })
    await expect(chinese.open()).resolves.toMatchObject({
      tracks: [{
        contentVersions: { [conceptId]: englishPack.version },
      }],
    })
    await chinese.dispose()
  })
})
