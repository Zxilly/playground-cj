// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  loadConfiguredCourseContentPacks,
  loadCourseContentPacks,
} from './content-pack-source'
import { validateContentPack } from './content-packs'
import { assignImmutableContentVersion } from './content-pack-version'

describe('integrity-checked immutable Content Pack loading', () => {
  it('fails closed when external review configuration is incomplete or invalid', () => {
    expect(() => loadConfiguredCourseContentPacks('en', {
      attestationJson: '{}',
    })).toThrow(/both attestation and trusted keys/)
    expect(() => loadConfiguredCourseContentPacks('en', {
      attestationJson: '{',
      trustedReviewKeysJson: '{}',
    })).toThrow(/invalid JSON/)
  })

  it('derives stable full SHA-256 versions and changes identity with content', async () => {
    const response = await loadCourseContentPacks('en')
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
    expect(original.review).toEqual({ status: 'pending' })
    expect(response.packs.filter(pack =>
      validateContentPack(pack).status === 'validated')).toHaveLength(0)
  }, 30_000)
})
