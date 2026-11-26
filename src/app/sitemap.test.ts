import { describe, expect, it, vi } from 'vitest'
import sitemap from './sitemap'

const headerMocks = vi.hoisted(() => ({
  host: 'play.cj.zxilly.com',
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: headerMocks.host }),
}))

vi.mock('@/tour/loader', () => ({
  loadTourData: async () => [],
  flattenSections: () => [
    { chapterSlug: 'welcome', chapterStep: '1' },
  ],
}))

describe('sitemap', () => {
  it('lists only canonical playground root entries on playground host', async () => {
    headerMocks.host = 'play.cj.zxilly.com'
    const entries = await sitemap()
    expect(entries.map(entry => entry.url)).toEqual([
      'https://play.cj.zxilly.com/zh',
      'https://play.cj.zxilly.com/en',
    ])
  })

  it('includes tour lessons and /ai entries on tour host', async () => {
    headerMocks.host = 'tour.cj.zxilly.dev'
    const entries = await sitemap()
    expect(entries.map(entry => entry.url)).toEqual([
      'https://tour.cj.zxilly.dev/zh/welcome/1',
      'https://tour.cj.zxilly.dev/en/welcome/1',
      'https://tour.cj.zxilly.dev/zh/ai',
      'https://tour.cj.zxilly.dev/en/ai',
    ])
  })
})
