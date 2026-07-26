import { describe, expect, it, vi } from 'vitest'
import { createContentPacksHandler } from './content-packs-handler'

describe('get /api/teach/content-packs', () => {
  it('requires an explicit zh or en language', async () => {
    const load = vi.fn()
    const GET = createContentPacksHandler(load, { error: vi.fn() })

    const missing = await GET(new Request('http://localhost/api/teach/content-packs'))
    const unsupported = await GET(
      new Request('http://localhost/api/teach/content-packs?lang=ja'),
    )

    expect(missing.status).toBe(400)
    expect(unsupported.status).toBe(400)
    expect(load).not.toHaveBeenCalled()
  })

  it('fails the entire response when any built pack is invalid', async () => {
    const logger = { error: vi.fn() }
    const load = vi.fn().mockResolvedValue({
      packs: [{ id: 'invalid-pack' }],
      currentVersions: {},
    })
    const GET = createContentPacksHandler(load, logger)

    const response = await GET(
      new Request('http://localhost/api/teach/content-packs?lang=en'),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Course Content Packs are unavailable',
    })
    expect(logger.error).toHaveBeenCalledOnce()
  })

  it('fails closed instead of publishing an empty curriculum', async () => {
    const logger = { error: vi.fn() }
    const GET = createContentPacksHandler(
      vi.fn().mockResolvedValue({ packs: [], currentVersions: {} }),
      logger,
    )

    const response = await GET(
      new Request('http://localhost/api/teach/content-packs?lang=zh'),
    )

    expect(response.status).toBe(500)
    expect(logger.error).toHaveBeenCalledOnce()
  })
})
