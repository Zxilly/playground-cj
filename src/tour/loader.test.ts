import { beforeEach, describe, expect, it, vi } from 'vitest'

const { serialize, readdirSync } = vi.hoisted(() => ({
  serialize: vi.fn(),
  readdirSync: vi.fn(),
}))

vi.mock('next-mdx-remote/serialize', () => ({ serialize }))
vi.mock('node:fs', () => ({
  existsSync: () => true,
  readdirSync,
  readFileSync: (path: string) => path.endsWith('name.json')
    ? '{"zh":"入门","en":"Welcome"}'
    : path.endsWith('.cj') ? 'main() {}' : '# Hello\n\nWelcome',
}))

function defaultReaddir(path: string) {
  const name = path.endsWith('tour') ? '01-welcome' : path.endsWith('01-welcome') ? '01-intro' : '1'
  return [{ name, isDirectory: () => true }]
}

describe('tour loading', () => {
  beforeEach(() => {
    vi.resetModules()
    serialize.mockReset().mockResolvedValue({ compiledSource: 'lesson' })
    readdirSync.mockReset().mockImplementation(defaultReaddir)
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

  it('rejects sibling directories sharing the same numeric prefix', async () => {
    readdirSync.mockImplementation((path: string) => {
      if (path.endsWith('tour'))
        return [{ name: '02-basics', isDirectory: () => true }]
      if (path.endsWith('02-basics')) {
        return [
          { name: '01-bindings', isDirectory: () => true },
          { name: '01-packages', isDirectory: () => true },
        ]
      }
      return [{ name: '01', isDirectory: () => true }]
    })
    const { loadTourData } = await import('./loader')
    await expect(loadTourData()).rejects.toThrow(/Duplicate numeric prefix 1/)
  })
})
