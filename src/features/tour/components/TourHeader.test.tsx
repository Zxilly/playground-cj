import { cleanup, render, screen } from '@testing-library/react'
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

function MockSidebarTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button data-testid="sidebar-trigger" {...props} />
}

function MockSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

function MockLanguagePicker() {
  return <div>Language Picker</div>
}

function MockLLMConfigDialog() {
  return <button type="button">AI 服务设置</button>
}

vi.mock('next/image', () => ({
  default: MockImage,
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: MockSidebarTrigger,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: MockSeparator,
}))

vi.mock('@/features/tour/components/mdx/LanguagePicker', () => ({
  LanguagePicker: MockLanguagePicker,
}))

vi.mock('@/modules/llm-config/components/LLMConfigDialog', () => ({
  LLMConfigDialog: MockLLMConfigDialog,
}))

describe('tour header', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'https://tour.cj.zxilly.dev',
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
          section={{
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
      origin: 'http://localhost:3000',
    })

    render(
      <Wrapper>
        <TourHeader
          lang="zh"
          section={{
            chapterName: { zh: '欢迎', en: 'Welcome' },
            subChapterName: { zh: '介绍', en: 'Intro' },
            sectionName: { zh: '开始', en: 'Start' },
          } as never}
        />
      </Wrapper>,
    )

    expect(screen.getAllByRole('link')[0].getAttribute('href')).toBe('/zh/tour')
  })

  it('links the AI tutor to the teaching workspace route', () => {
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost:3000',
    })

    render(
      <Wrapper>
        <TourHeader
          lang="zh"
          section={{
            chapterName: { zh: '欢迎', en: 'Welcome' },
            subChapterName: { zh: '介绍', en: 'Intro' },
            sectionName: { zh: '开始', en: 'Start' },
          } as never}
        />
      </Wrapper>,
    )

    expect(screen.getByRole('link', { name: 'AI 课堂' }).getAttribute('href')).toBe('/zh/tour/ai')
  })

  it('omits the sidebar trigger on the AI route because it has no sidebar provider', () => {
    render(
      <Wrapper>
        <TourHeader lang="zh" aiMode />
      </Wrapper>,
    )

    expect(screen.queryByTestId('sidebar-trigger')).toBeNull()
    screen.getByRole('button', { name: 'AI 服务设置' })
    expect(screen.queryByRole('link', { name: 'AI 课堂' })).toBeNull()
  })
})
