import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { TourHeader } from '@/features/tour/components/TourHeader'

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  )
}

function MockImage() {
  return <div data-testid="next-image" />
}

const sidebarState = vi.hoisted(() => ({
  toggleSidebar: vi.fn(),
  isMobile: false,
  open: false,
  openMobile: false,
}))

function MockLanguagePicker() {
  return <div>Language Picker</div>
}

vi.mock('next/image', () => ({
  default: MockImage,
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', systemTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/zh/tour/welcome/1',
}))

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => sidebarState,
}))

vi.mock('@/features/tour/components/mdx/LanguagePicker', () => ({
  LanguagePicker: MockLanguagePicker,
}))

describe('tour header', () => {
  beforeEach(() => {
    sidebarState.toggleSidebar.mockClear()
    sidebarState.isMobile = false
    sidebarState.open = false
    sidebarState.openMobile = false
    vi.stubGlobal('location', {
      ...window.location,
      host: 'tour.cj.zxilly.dev',
      origin: 'https://tour.cj.zxilly.dev',
      pathname: '/zh/welcome/1',
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('links the Playground button to the playground domain when rendered on the tour domain', () => {
    render(
      <Wrapper>
        <TourHeader
          lang="zh"
          servingDomain="tour"
          section={{
            chapterSlug: 'welcome',
            chapterStep: '1',
            chapterName: { zh: '欢迎', en: 'Welcome' },
            subChapterName: { zh: '介绍', en: 'Intro' },
            sectionName: { zh: '开始', en: 'Start' },
          } as never}
        />
      </Wrapper>,
    )

    expect(screen.getByRole('link', { name: 'Playground' }).getAttribute('href')).toBe('https://playground.cj.zxilly.dev/zh')
  })

  it('links the logo to the tour index path when the tour is served from a non-tour host', () => {
    vi.stubGlobal('location', {
      ...window.location,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/zh/tour/welcome/1',
    })

    render(
      <Wrapper>
        <TourHeader
          lang="zh"
          section={{
            chapterSlug: 'welcome',
            chapterStep: '1',
            chapterName: { zh: '欢迎', en: 'Welcome' },
            subChapterName: { zh: '介绍', en: 'Intro' },
            sectionName: { zh: '开始', en: 'Start' },
          } as never}
        />
      </Wrapper>,
    )

    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/zh/tour')
  })

  it('links the AI classroom with the current chapter topic query parameter and renders theme toggle & locale switch', () => {
    vi.stubGlobal('location', {
      ...window.location,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/zh/tour/basics/1',
    })

    render(
      <Wrapper>
        <TourHeader
          lang="zh"
          section={{
            chapterSlug: 'basics',
            chapterStep: '1',
            chapterName: { zh: '基础', en: 'Basics' },
            subChapterName: { zh: '变量', en: 'Variables' },
            sectionName: { zh: '开始', en: 'Start' },
          } as never}
        />
      </Wrapper>,
    )

    expect(screen.getByRole('link', { name: 'AI 课堂' }).getAttribute('href')).toBe('/zh/tour/ai?topic=basics')
    expect(screen.getByRole('button', { name: /切换主题/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Switch to English' }).getAttribute('href')).toBe('/en/tour/basics/1')
  })

  it('keeps the lesson title visible in a deduplicated breadcrumb and labels the directory control', () => {
    render(
      <Wrapper>
        <TourHeader
          lang="zh"
          section={{
            chapterSlug: 'welcome',
            chapterStep: '1',
            chapterName: { zh: '欢迎' },
            subChapterName: { zh: '欢迎' },
            sectionName: { zh: 'Hello, 世界' },
          } as never}
        />
      </Wrapper>,
    )

    const breadcrumbs = screen.getByRole('navigation', { name: '当前章节' })
    expect(within(breadcrumbs).getAllByText('欢迎')).toHaveLength(1)
    expect(within(breadcrumbs).getByText('Hello, 世界').getAttribute('aria-current')).toBe('page')
    const directory = screen.getByRole('button', { name: '切换侧边栏' })
    expect(directory.textContent).toContain('目录')
    expect(directory.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(directory)
    expect(sidebarState.toggleSidebar).toHaveBeenCalledOnce()
    const nav = screen.getByRole('navigation', { name: '主导航' })
    expect(within(nav).getByRole('link', { name: '仓颉之旅' }).getAttribute('aria-current')).toBe('page')
  })

  it('reports the mobile drawer state instead of the desktop directory state', () => {
    sidebarState.isMobile = true
    sidebarState.openMobile = true
    render(<Wrapper><TourHeader lang="zh" /></Wrapper>)

    expect(screen.getByRole('button', { name: '切换侧边栏' }).getAttribute('aria-expanded')).toBe('true')
  })
})
