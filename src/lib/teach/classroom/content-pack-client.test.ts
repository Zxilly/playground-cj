import { describe, expect, it, vi } from 'vitest'
import { fetchCourseContentPacks } from './content-pack-client'

function response(input: {
  ok?: boolean
  status?: number
  body?: unknown
}) {
  return {
    ok: input.ok ?? true,
    status: input.status ?? 200,
    json: async () => input.body,
  } as Response
}

describe('fetchCourseContentPacks', () => {
  it('requests one explicit locale and validates the complete response', async () => {
    const fetch = vi.fn(async () => response({
      body: { packs: [], currentVersions: {} },
    }))
    await expect(fetchCourseContentPacks('en', { fetch })).resolves.toEqual({
      packs: [],
      currentVersions: {},
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/teach/content-packs?lang=en',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('fails closed on a malformed response instead of filtering bad packs', async () => {
    const fetch = vi.fn(async () => response({
      body: {
        packs: [{ version: 'broken' }],
        currentVersions: {},
      },
    }))
    await expect(fetchCourseContentPacks('zh', { fetch })).rejects.toThrow()
  })

  it('does not expose the server error body to the browser UI', async () => {
    const fetch = vi.fn(async () => response({
      ok: false,
      status: 500,
      body: { error: 'filesystem details' },
    }))
    await expect(
      fetchCourseContentPacks('zh', { fetch }),
    ).rejects.toThrow('Course Content Pack request failed with status 500')
  })
})
