import type { FetchFn } from './tour-source'
import { describe, expect, it, vi } from 'vitest'
import { createTourSource, TOUR_API_PATH } from './tour-source'

/** Build a fake fetch resolving an ok JSON response with `body`. */
function okFetch(body: unknown): FetchFn & ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => body })) as FetchFn & ReturnType<typeof vi.fn>
}

describe('createTourSource', () => {
  it('fetches the outline for a language and returns the chapters', async () => {
    const outline = [
      { id: 'basics', title: '基础', steps: [{ id: 'basics/1', chapter: '基础', title: '绑定' }] },
    ]
    const fetch = okFetch({ outline })
    const source = createTourSource({ fetch })

    const result = await source.outline('zh')

    expect(fetch).toHaveBeenCalledWith(`${TOUR_API_PATH}?lang=zh`, { signal: undefined })
    expect(result).toEqual(outline)
  })

  it('fetches a single step by id and language', async () => {
    const step = { id: 'basics/1', lang: 'en', chapter: 'Basics', title: 'Bindings', markdown: '# x', code: 'main() {}' }
    const fetch = okFetch({ step })
    const source = createTourSource({ fetch })

    const result = await source.read('basics/1', 'en')

    expect(fetch).toHaveBeenCalledWith(`${TOUR_API_PATH}?step=basics%2F1&lang=en`, { signal: undefined })
    expect(result).toEqual(step)
  })

  it('forwards the abort signal to fetch', async () => {
    const fetch = okFetch({ outline: [] })
    const source = createTourSource({ fetch })
    const controller = new AbortController()

    await source.outline('zh', { signal: controller.signal })

    expect(fetch).toHaveBeenCalledWith(`${TOUR_API_PATH}?lang=zh`, { signal: controller.signal })
  })

  it('returns an empty outline (does not throw) when fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as FetchFn
    const source = createTourSource({ fetch })

    expect(await source.outline('zh')).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns an empty outline on a non-ok response', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as FetchFn
    const source = createTourSource({ fetch })
    expect(await source.outline('zh')).toEqual([])
  })

  it('returns null on a non-ok step response (e.g. 404)', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as FetchFn
    const source = createTourSource({ fetch })
    expect(await source.read('missing/9', 'zh')).toBeNull()
  })

  it('returns null (does not throw) when read fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as FetchFn
    const source = createTourSource({ fetch })

    expect(await source.read('basics/1', 'zh')).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('drops malformed outline entries and a malformed step', async () => {
    const source = createTourSource({
      fetch: okFetch({ outline: [{ id: 'ok', title: 't', steps: [] }, { id: 1, title: 'bad' }, null] }),
    })
    expect(await source.outline('zh')).toEqual([{ id: 'ok', title: 't', steps: [] }])

    const badStep = createTourSource({ fetch: okFetch({ step: { id: 'x' } }) })
    expect(await badStep.read('x', 'zh')).toBeNull()
  })

  it('returns empty/null when the payload shape is unexpected', async () => {
    const source = createTourSource({ fetch: okFetch({ something: 'else' }) })
    expect(await source.outline('zh')).toEqual([])
    expect(await source.read('basics/1', 'zh')).toBeNull()
  })
})
