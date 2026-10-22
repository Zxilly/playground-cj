import { beforeEach, describe, expect, it, vi } from 'vitest'

const { serialize } = vi.hoisted(() => ({ serialize: vi.fn() }))

vi.mock('next-mdx-remote/serialize', () => ({ serialize }))
vi.mock('node:fs', () => ({
  existsSync: () => true,
  readdirSync: (path: string) => {
    const name = path.endsWith('tour') ? '01-welcome' : path.endsWith('01-welcome') ? '01-intro' : '1'
    return [{ name, isDirectory: () => true }]
  },
  readFileSync: (path: string) => path.endsWith('name.json')
    ? '{"zh":"入门","en":"Welcome"}'
    : path.endsWith('.cj') ? 'main() {}' : '# Hello\n\nWelcome',
}))

describe('tour loading', () => {
  beforeEach(() => {
    vi.resetModules()
    serialize.mockReset().mockResolvedValue({ compiledSource: 'lesson' })
  })

  it('shares course compilation between concurrent metadata and page loads', async () => {
    const { loadTourData } = await import('./loader')
    const [metadata, page] = await Promise.all([loadTourData(), loadTourData()])
    expect(metadata).toBe(page)
    expect(serialize).toHaveBeenCalledTimes(2) // One section, two locales.
    expect(await loadTourData()).toBe(page)
    expect(serialize).toHaveBeenCalledTimes(2)
  })

  it('allows a later request to retry failed compilation', async () => {
    serialize.mockRejectedValueOnce(new Error('compile failed'))
    const { loadTourData } = await import('./loader')
    const results = await Promise.allSettled([loadTourData(), loadTourData()])
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    const recovered = await loadTourData()
    expect(recovered[0].subChapters[0].sections[0].mdxSource?.en.compiledSource).toBe('lesson')
    expect(serialize).toHaveBeenCalledTimes(3)
  })
})
