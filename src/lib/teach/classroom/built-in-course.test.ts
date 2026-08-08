// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { BUILT_IN_COURSE_CONTENT_PACKS } from './built-in-course'
import { validateContentPack } from './content-packs'
import { assignImmutableContentVersion } from './content-pack-version'

describe('built-in immutable Course Content Packs', () => {
  it('compiles both Git-tracked locales without deployment configuration', () => {
    for (const locale of ['en', 'zh'] as const) {
      const response = BUILT_IN_COURSE_CONTENT_PACKS[locale]
      const currentPacks = response.packs.filter(pack =>
        response.currentVersions[pack.concept.id] === pack.version)

      expect(currentPacks.length).toBeGreaterThan(0)
      expect(currentPacks.every(pack =>
        pack.review.status === 'approved'
        && /^repository-review-declaration:[a-f0-9]{64}$/
          .test(pack.review.reviewedBy))).toBe(true)
      expect(currentPacks.some(pack =>
        validateContentPack(pack).status === 'validated')).toBe(true)
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
    expect(response.currentVersions[original.concept.id]).toBe(original.version)
    expect(validateContentPack(original).status).toBe('validated')
  })
})
