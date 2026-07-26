import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TourSidebar } from '@/features/tour/components/TourSidebar'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function passthrough(tag: keyof HTMLElementTagNameMap) {
  return ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
    const Tag = tag
    return <Tag {...props}>{children}</Tag>
  }
}

function MockSidebarMenuButton({
  children,
  isActive,
  onClick,
}: {
  children?: ReactNode
  isActive?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" aria-current={isActive ? 'page' : undefined} onClick={onClick}>
      {children}
    </button>
  )
}

function MockSidebarRail() {
  return <div data-testid="sidebar-rail" />
}

function MockCollapsible({ children, defaultOpen }: { children: ReactNode, defaultOpen?: boolean }) {
  return <div data-open={defaultOpen ? 'true' : 'false'}>{children}</div>
}

function MockCollapsibleTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>
}

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: passthrough('aside'),
  SidebarContent: passthrough('div'),
  SidebarGroup: passthrough('div'),
  SidebarGroupLabel: passthrough('h2'),
  SidebarMenu: passthrough('div'),
  SidebarMenuButton: MockSidebarMenuButton,
  SidebarMenuItem: passthrough('div'),
  SidebarMenuSub: passthrough('div'),
  SidebarMenuSubItem: passthrough('div'),
  SidebarRail: MockSidebarRail,
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: MockCollapsible,
  CollapsibleContent: passthrough('div'),
  CollapsibleTrigger: MockCollapsibleTrigger,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: passthrough('div'),
}))

const tourData = [
  {
    id: 'basics',
    name: { zh: '基础', en: 'Basics' },
    subChapters: [
      {
        id: 'intro',
        name: { zh: '入门', en: 'Intro' },
        sections: [
          { id: 'hello', name: { zh: '你好', en: 'Hello' } },
          { id: 'types', name: { zh: '类型', en: 'Types' } },
        ],
      },
    ],
  },
] as never[]

describe('tourSidebar', () => {
  afterEach(cleanup)

  it('renders localized tour entries and marks the current section active', () => {
    render(
      <Wrapper>
        <TourSidebar
          lang="en"
          tourData={tourData}
          currentChapter="basics"
          currentSubChapter="intro"
          currentSection="hello"
          onNavigate={() => {}}
        />
      </Wrapper>,
    )

    expect(screen.getByRole('heading', { name: '仓颉之旅' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Basics/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Intro/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hello' }).getAttribute('aria-current')).toBe('page')
  })

  it('calls onNavigate with chapter, subchapter, and section ids', () => {
    const onNavigate = vi.fn()

    render(
      <Wrapper>
        <TourSidebar
          lang="zh"
          tourData={tourData}
          currentChapter="basics"
          currentSubChapter="intro"
          currentSection="hello"
          onNavigate={onNavigate}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '类型' }))

    expect(onNavigate).toHaveBeenCalledWith('basics', 'intro', 'types')
  })
})
