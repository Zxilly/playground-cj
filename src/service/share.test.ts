import { generateDataShareUrl, generateHashShareUrl, loadDataShareCode, loadLegacyShareCode } from '@/service/share'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

it.each([
  'print(\'Hello, world!\')',
  'print(\'中文代码\')',
])('round-trips compressed data shares without depending on the compression bytes: %s', async (code) => {
  const url = generateDataShareUrl(code)
  const hash = new URL(url).hash
  const payload = new URLSearchParams(hash.slice(1)).get('data')

  expect(hash).toMatch(/^#data=/)
  expect(payload).toMatch(/^[\w-]+$/)

  window.history.replaceState(null, '', `/${hash}`)
  expect(loadDataShareCode()).toBe(code)
})

describe('share loading', () => {
  it('returns undefined when no data payload exists in the hash', () => {
    window.history.replaceState(null, '', '/#hash=legacy')

    expect(loadDataShareCode()).toBeUndefined()
  })

  it('returns undefined for corrupted data payloads', () => {
    window.history.replaceState(null, '', '/#data=not-a-valid-lz-payload')

    expect(loadDataShareCode()).toBeUndefined()
  })

  it('loads dpaste content for legacy hashes and reports misses', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('legacy code'))
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))

    window.history.replaceState(null, '', '/#hash=abc123')
    await expect(loadLegacyShareCode()).resolves.toEqual(['legacy code', true])

    window.history.replaceState(null, '', '/#hash=missing')
    await expect(loadLegacyShareCode()).resolves.toEqual(['', false])

    expect(fetch).toHaveBeenNthCalledWith(1, 'https://dpaste.com/abc123.txt')
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://dpaste.com/missing.txt')
  })

  it('treats missing legacy hashes as already handled', async () => {
    window.history.replaceState(null, '', '/')

    await expect(loadLegacyShareCode()).resolves.toEqual(['', true])
  })
})

describe('share URL generation', () => {
  it('creates hash share URLs without preserving existing search or hash state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ hash: 'new-hash' })))
    window.history.replaceState(null, '', '/playground?debug=1#old=1')

    await expect(generateHashShareUrl('main()')).resolves.toBe('http://localhost:3000/playground?hash=new-hash')

    expect(fetch).toHaveBeenCalledWith('/api/dpaste', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'main()' }),
    })
  })

  it('throws when hash share creation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 500 }))

    await expect(generateHashShareUrl('main()')).rejects.toThrow('Failed to create share URL')
  })

  it.each([
    ['missing hash', {}],
    ['null hash', { hash: null }],
    ['non-string hash', { hash: 123 }],
    ['empty hash', { hash: '' }],
  ])('rejects ok responses with %s', async (_description, body) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)))

    await expect(generateHashShareUrl('main()')).rejects.toThrow(/hash/i)
  })
})
