import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCourseContentPackRepository } from './content-pack-repository'

const mocks = vi.hoisted(() => ({
  enCache: { merge: vi.fn(), close: vi.fn() },
  zhCache: { merge: vi.fn(), close: vi.fn() },
  createCache: vi.fn(),
  createCatalog: vi.fn(),
  catalog: { id: 'catalog' },
}))

vi.mock('./content-pack-cache', () => ({
  createIndexedDBContentPackCache: mocks.createCache,
}))
vi.mock('./content-catalog', () => ({
  createContentPackCatalog: mocks.createCatalog,
}))
vi.mock('./content-packs', () => ({
  contentPacksResponseSchema: { parse: (value: unknown) => value },
}))

const enResponse = {
  packs: [{ concept: { id: 'concept:test' }, version: 'en-current' }],
  currentVersions: { 'concept:test': 'en-current' },
}
const zhResponse = {
  packs: [{ concept: { id: 'concept:test' }, version: 'zh-current' }],
  currentVersions: { 'concept:test': 'zh-current' },
}
const enHistory = [
  ...enResponse.packs,
  { concept: { id: 'concept:test' }, version: 'en-historical' },
]
const zhHistory = [
  ...zhResponse.packs,
  { concept: { id: 'concept:test' }, version: 'zh-historical' },
]

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createCache.mockImplementation(({ locale }: { locale: 'en' | 'zh' }) =>
    locale === 'en' ? mocks.enCache : mocks.zhCache)
  mocks.createCatalog.mockReturnValue(mocks.catalog)
  mocks.enCache.merge.mockResolvedValue(enHistory)
  mocks.zhCache.merge.mockResolvedValue(zhHistory)
  mocks.enCache.close.mockResolvedValue(undefined)
  mocks.zhCache.close.mockResolvedValue(undefined)
})

describe('course Content Pack repository', () => {
  it('loads both locales and builds one catalog with the selected current map', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async input =>
      response(String(input).includes('lang=en') ? enResponse : zhResponse))
    const repository = createCourseContentPackRepository({ fetch })
    const controller = new AbortController()

    await expect(repository.open('zh', {
      signal: controller.signal,
    })).resolves.toBe(mocks.catalog)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledWith('/api/teach/content-packs?lang=en', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    expect(mocks.enCache.merge).toHaveBeenCalledWith(enResponse)
    expect(mocks.zhCache.merge).toHaveBeenCalledWith(zhResponse)
    expect(mocks.createCatalog).toHaveBeenCalledWith(
      [...enHistory, ...zhHistory],
      zhResponse.currentVersions,
    )

    await repository.close()
  })

  it('fails closed before cache merge when either locale request fails', async () => {
    const unavailable = new Error('zh unavailable')
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).includes('lang=zh'))
        throw unavailable
      return response(enResponse)
    })
    const repository = createCourseContentPackRepository({ fetch })

    await expect(repository.open('en')).rejects.toBe(unavailable)
    expect(mocks.enCache.merge).not.toHaveBeenCalled()
    expect(mocks.zhCache.merge).not.toHaveBeenCalled()
    await repository.close()
  })

  it('waits for both cache merges before surfacing an immutable collision', async () => {
    const collision = new Error('immutable collision')
    let finishChineseMerge!: () => void
    mocks.enCache.merge.mockRejectedValueOnce(collision)
    mocks.zhCache.merge.mockReturnValueOnce(new Promise((resolve) => {
      finishChineseMerge = () => resolve(zhHistory)
    }))
    const fetch = vi.fn<typeof globalThis.fetch>(async input =>
      response(String(input).includes('lang=en') ? enResponse : zhResponse))
    const repository = createCourseContentPackRepository({ fetch })
    let settled = false
    const opening = repository.open('en').finally(() => {
      settled = true
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    finishChineseMerge()
    await expect(opening).rejects.toBe(collision)
    await repository.close()
  })

  it('closes both cache adapters and aggregates close failures', async () => {
    const first = new Error('en close failed')
    const second = new Error('zh close failed')
    mocks.enCache.close.mockRejectedValueOnce(first)
    mocks.zhCache.close.mockRejectedValueOnce(second)
    const repository = createCourseContentPackRepository({
      fetch: vi.fn<typeof globalThis.fetch>(),
    })

    const error = await repository.close().catch(value => value)
    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors).toEqual([first, second])
  })

  it('does not close cache adapters until an in-flight open settles', async () => {
    const finishFetches: Array<(value: Response) => void> = []
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise((resolve) => {
      finishFetches.push(resolve)
    }))
    const repository = createCourseContentPackRepository({ fetch })
    const opening = repository.open('en')
    const closing = repository.close()
    await Promise.resolve()

    expect(mocks.enCache.close).not.toHaveBeenCalled()
    finishFetches[0]!(response(enResponse))
    finishFetches[1]!(response(zhResponse))
    await expect(opening).rejects.toThrow(
      'Course Content Pack repository closed while opening',
    )
    await closing
    expect(mocks.enCache.close).toHaveBeenCalledOnce()
    expect(mocks.zhCache.close).toHaveBeenCalledOnce()
  })
})
