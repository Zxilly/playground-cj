import { setupI18n } from '@lingui/core'
import type { Messages } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { I18nProvider } from '@lingui/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { messages as zhMessages } from '@/locales/zh/messages.mjs'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbList,
} from '@/components/ui/breadcrumb'
import {
  DialogDescription,
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sidebar,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'

function renderWithLocale(locale: 'en' | 'zh', messages: Messages, children: React.ReactNode) {
  const i18n = setupI18n({
    locale,
    messages: {
      [locale]: messages,
    },
  })
  i18n.activate(locale)

  return render(<I18nProvider i18n={i18n}>{children}</I18nProvider>)
}

function renderWithZh(children: React.ReactNode) {
  return renderWithLocale('zh', zhMessages, children)
}

function renderWithEn(children: React.ReactNode) {
  return renderWithLocale('en', enMessages, children)
}

function MacroFixture() {
  const { i18n } = useLingui()

  return (
    <>
      <span>{i18n._(msg`关闭`)}</span>
      <span><Trans>更多</Trans></span>
    </>
  )
}

describe('ui accessibility copy uses Lingui translations', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width') ? window.innerWidth < 768 : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    cleanup()
    window.innerWidth = 375
  })

  it('renders translated breadcrumb and dialog accessibility labels in zh locale', () => {
    renderWithZh(
      <>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbEllipsis />
          </BreadcrumbList>
        </Breadcrumb>

        <Dialog open onOpenChange={() => {}}>
          <DialogContent>
            <DialogTitle>测试弹窗</DialogTitle>
            <DialogDescription>测试说明</DialogDescription>
          </DialogContent>
        </Dialog>

        <SidebarProvider>
          <SidebarRail />
        </SidebarProvider>
      </>
    )

    screen.getByLabelText('面包屑')
    screen.getByText('更多')
    screen.getAllByText('关闭')
    screen.getByLabelText('切换侧边栏')
    expect(screen.getByTitle('切换侧边栏')).toBeTruthy()
  })

  it('renders translated mobile sidebar accessibility copy in zh locale', () => {
    renderWithZh(
      <SidebarProvider>
        <SidebarTrigger />
        <Sidebar>侧边栏内容</Sidebar>
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '切换侧边栏' }))

    screen.getByText('侧边栏')
    screen.getByText('显示移动端侧边栏。')
  })

  it('renders english accessibility copy from compiled catalogs', () => {
    renderWithEn(
      <>
        <MacroFixture />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbEllipsis />
          </BreadcrumbList>
        </Breadcrumb>

        <SidebarProvider>
          <SidebarTrigger />
          <SidebarRail />
        </SidebarProvider>
      </>
    )

    screen.getByText('Close')
    expect(screen.getAllByText('More')).toHaveLength(2)
    screen.getByLabelText('Breadcrumb')
    screen.getByLabelText('Toggle Sidebar')
    expect(screen.getByTitle('Toggle Sidebar')).toBeTruthy()
  })
})
