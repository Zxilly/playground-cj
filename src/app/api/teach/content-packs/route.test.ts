// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  contentPacksResponseSchema,
  validateContentPack,
} from '@/lib/teach/classroom/content-packs'
import { GET } from './route'

describe('content-packs route wiring', () => {
  it('serves only Content Packs that pass Content Pack Validation', async () => {
    const response = await GET(
      new Request('http://localhost/api/teach/content-packs?lang=en'),
    )
    const body = contentPacksResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(body.packs.length).toBeGreaterThan(0)
    expect(body.packs.every(pack =>
      validateContentPack(pack).status !== 'invalid',
    )).toBe(true)
    const conceptIds = new Set(body.packs.map(pack => pack.concept.id))
    expect(Object.keys(body.currentVersions)).toHaveLength(conceptIds.size)
    for (const [conceptId, version] of Object.entries(body.currentVersions)) {
      expect(body.packs.some(pack =>
        pack.concept.id === conceptId && pack.version === version)).toBe(true)
    }
    for (const pack of body.packs) {
      expect(body.currentVersions[pack.concept.id]).toBeDefined()
      expect(pack.version).toMatch(/^cv:sha256:[0-9a-f]{64}$/)
      expect(pack.exerciseTemplates.every(template =>
        template.version === pack.version)).toBe(true)
    }
  }, 30_000)
})
