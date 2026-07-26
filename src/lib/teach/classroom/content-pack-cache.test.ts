import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type {
  ContentPacksResponse,
  CourseContentPack,
} from './content-packs'
import {
  CONTENT_PACK_CACHE_DATABASE_NAME,
  ContentPackVersionCollisionError,
  createIndexedDBContentPackCache,
} from './content-pack-cache'
import { createContentPackCatalog } from './content-catalog'

function pack(version: string, markdown: string): CourseContentPack {
  return {
    id: 'pack:concept:test:en',
    version,
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
      markdown,
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: '01-test/01-test/01',
        title: 'Test',
      }],
    }],
    learningSkills: [],
    exerciseTemplates: [],
    review: { status: 'pending' },
  }
}

function response(current: CourseContentPack): ContentPacksResponse {
  return {
    packs: [current],
    currentVersions: {
      [current.concept.id]: current.version,
    },
  }
}

function approved(pack: CourseContentPack): CourseContentPack {
  return {
    ...pack,
    review: {
      status: 'approved',
      reviewedBy:
        `external-review-attestation:test-key:${
          '0'.repeat(64)}`,
    },
  }
}

describe('indexedDB immutable Content Pack cache', () => {
  it('merges remote current material with exact locally cached history', async () => {
    const databaseName
      = `${CONTENT_PACK_CACHE_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createIndexedDBContentPackCache({
      databaseName,
      locale: 'en',
    })
    const versionOne = pack('cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Original content.')
    await first.merge(response(versionOne))
    await first.close()

    const second = createIndexedDBContentPackCache({
      databaseName,
      locale: 'en',
    })
    const versionTwo = pack('cv:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'Updated content.')
    const merged = await second.merge(response(versionTwo))
    const catalog = createContentPackCatalog(merged, {
      'concept:test': versionTwo.version,
    })

    expect(merged.map(candidate => candidate.version))
      .toEqual(['cv:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'])
    expect(catalog.get('concept:test')).toEqual(versionTwo)
    expect(catalog.getVersion('concept:test', 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toEqual(versionOne)
    await second.close()
  })

  it('fails closed when a server silently changes an existing version', async () => {
    const cache = createIndexedDBContentPackCache({
      databaseName:
        `${CONTENT_PACK_CACHE_DATABASE_NAME}-test-${crypto.randomUUID()}`,
      locale: 'zh',
    })
    await cache.merge(response(pack('cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'Immutable payload.')))

    await expect(cache.merge(
      response(pack('cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'Mutated under the same identity.')),
    )).rejects.toEqual(
      new ContentPackVersionCollisionError('concept:test', 'cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    )

    await cache.close()
  })

  it('refreshes external approval metadata without treating it as content mutation', async () => {
    const cache = createIndexedDBContentPackCache({
      databaseName:
        `${CONTENT_PACK_CACHE_DATABASE_NAME}-test-${crypto.randomUUID()}`,
      locale: 'en',
    })
    const pending = pack('cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'Immutable payload.')
    const externallyApproved = approved(pending)

    await expect(cache.merge(response(pending))).resolves.toEqual([pending])
    await expect(cache.merge(response(externallyApproved)))
      .resolves
      .toEqual([externallyApproved])
    await expect(cache.merge(response(pending))).resolves.toEqual([pending])

    await cache.close()
  })

  it('keeps identical Concept Version keys isolated by locale', async () => {
    const databaseName
      = `${CONTENT_PACK_CACHE_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const english = createIndexedDBContentPackCache({
      databaseName,
      locale: 'en',
    })
    const chinese = createIndexedDBContentPackCache({
      databaseName,
      locale: 'zh',
    })

    await english.merge(response(pack('cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'English content.')))
    await expect(chinese.merge(
      response(pack('cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '中文内容。')),
    )).resolves.toEqual([pack('cv:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '中文内容。')])

    await Promise.all([english.close(), chinese.close()])
  })

  it('validates cross-record links before an invalid version can poison the cache', async () => {
    const cache = createIndexedDBContentPackCache({
      databaseName:
        `${CONTENT_PACK_CACHE_DATABASE_NAME}-test-${crypto.randomUUID()}`,
      locale: 'en',
    })
    const invalid = pack('cv:sha256:5555555555555555555555555555555555555555555555555555555555555555', 'Invalid duplicate blocks.')
    invalid.blocks.push(structuredClone(invalid.blocks[0]!))

    await expect(
      cache.merge(response(invalid)),
    ).rejects.toThrow(/duplicate Core Content Block/)

    const valid = pack('cv:sha256:5555555555555555555555555555555555555555555555555555555555555555', 'Valid replacement under the unused identity.')
    await expect(cache.merge(response(valid))).resolves.toEqual([valid])
    await cache.close()
  })
})
