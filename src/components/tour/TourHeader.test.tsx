import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TourHeader } from '@/components/tour/TourHeader'

let mockPathname = '/zh/01-welcome/01-intro'

function mockUsePathname() {
  return mockPathname
}

function MockImage() {
  return <div data-testid="next-image" />
}

function MockSidebarTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} />
}

function MockSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

function MockLanguagePicker() {
  return <div>Language Picker</div>
}

vi.mock('next/image', () => ({
  default: MockImage,
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: MockSidebarTrigger,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: MockSeparator,
}))

vi.mock('@/components/tour/mdx/LanguagePicker', () => ({
  LanguagePicker: MockLanguagePicker,
}))

describe('tour header', () => {
  beforeEach(() => {
    mockPathname = '/zh/01-welcome/01-intro'
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'https://tour.cj.zxilly.dev',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('links the Playground button to the playground domain when rendered on the tour domain', () => {
    render(
      <TourHeader
        lang="zh"
        section={{
          chapterName: { zh: '欢迎', en: 'Welcome' },
          subChapterName: { zh: '介绍', en: 'Intro' },
          sectionName: { zh: '开始', en: 'Start' },
        } as never}
      />,
    )

    expect(screen.getByRole('link', { name: 'Playground' }).getAttribute('href')).toBe('https://playground.cj.zxilly.dev/zh')
  })

  it('links the logo to the tour index path when the tour is served from a non-tour host', () => {
    mockPathname = '/zh/tour/01-welcome/01-intro'
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost:3000',
    })

    render(
      <TourHeader
        lang="zh"
        section={{
          chapterName: { zh: '欢迎', en: 'Welcome' },
          subChapterName: { zh: '介绍', en: 'Intro' },
          sectionName: { zh: '开始', en: 'Start' },
        } as never}
      />,
    )

    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/zh/tour')
  })
})
