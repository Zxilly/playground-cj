import { renderToString } from 'react-dom/server'
import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import TourAIWrapper, { AIClassroomLoadingShell } from './TourAIWrapper'
import { messages as enMessages } from '@/locales/en/messages.mjs'

const AI_CLASSROOM_LOADING_RECOVERY_DELAY_MS = 6000

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function EnWrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  globalI18n.load({ en: enMessages })
  globalI18n.activate('en')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

describe('tourAIWrapper', () => {
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    window.history.replaceState(null, '', '/')
  })

  it('renders a visible server fallback while the client AI app loads', () => {
    const html = renderToString(
      <Wrapper>
        <TourAIWrapper lang="zh" />
      </Wrapper>,
    )

    expect(html).toContain('AI 课堂')
    expect(html).toContain('ai-classroom-viewport-root')
    expect(html).not.toContain('h-screen')
    expect(html).toContain('正在恢复课堂环境')
    expect(html).toContain('正在加载编辑器、语言服务和你的课堂进度')
    expect(html).not.toContain('刷新页面')
    expect(html).not.toContain('data-motion=')
  })

  it('waits before showing recovery actions so normal loading does not look broken', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/zh/tour/ai?topic=cj.program.main')

    render(<AIClassroomLoadingShell />, { wrapper: Wrapper })

    const region = screen.getByRole('region', { name: '正在恢复课堂环境' })
    expect(region).toBe(screen.getByTestId('ai-classroom-loading-shell'))
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(describedByText(region)).toBe('正在加载编辑器、语言服务和你的课堂进度，通常只需要几秒。')
    const status = screen.getByRole('status', { name: '正在恢复课堂环境' })
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(describedByText(status)).toBe('正在加载编辑器、语言服务和你的课堂进度，通常只需要几秒。')
    screen.getByText('正在加载编辑器、语言服务和你的课堂进度，通常只需要几秒。')
    expect(screen.queryByRole('link', { name: '刷新页面' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(AI_CLASSROOM_LOADING_RECOVERY_DELAY_MS)
    })

    screen.getByText('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    expect(describedByText(region)).toBe('正在加载编辑器、语言服务和你的课堂进度，通常只需要几秒。 如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    expect(describedByText(status)).toBe('正在加载编辑器、语言服务和你的课堂进度，通常只需要几秒。')
    const reload = screen.getByRole('link', { name: '刷新页面' })
    expect(reload.getAttribute('href')).toBe('/zh/tour/ai?topic=cj.program.main')
    expect(describedByText(reload)).toBe('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    expect(reload.getAttribute('title')).toBe('刷新当前 AI 课堂页面；已保存的课堂进度会继续用于恢复。')
    const source = screen.getByRole('link', { name: '查看对应教程' })
    expect(source.getAttribute('href')).toBe('/zh/tour/welcome/1')
    expect(describedByText(source)).toBe('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    expect(source.getAttribute('title')).toBe('打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。')
  })

  it('uses compiled English copy for the recovery fallback shell', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/en/tour/ai?topic=cj.program.main#practice')

    render(<AIClassroomLoadingShell />, { wrapper: EnWrapper })

    const region = screen.getByRole('region', { name: 'Restoring the classroom environment' })
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(describedByText(region)).toBe('Loading the editor, language services, and your classroom progress. This usually only takes a few seconds.')
    const status = screen.getByRole('status', { name: 'Restoring the classroom environment' })
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(describedByText(status)).toBe('Loading the editor, language services, and your classroom progress. This usually only takes a few seconds.')
    expect(screen.queryByRole('link', { name: 'Refresh page' })).toBeNull()
    expect(screen.queryByText('正在恢复课堂环境')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(AI_CLASSROOM_LOADING_RECOVERY_DELAY_MS)
    })

    screen.getByText('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    expect(describedByText(region)).toBe('Loading the editor, language services, and your classroom progress. This usually only takes a few seconds. If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    expect(describedByText(status)).toBe('Loading the editor, language services, and your classroom progress. This usually only takes a few seconds.')
    const reload = screen.getByRole('link', { name: 'Refresh page' })
    expect(reload.getAttribute('href')).toBe('/en/tour/ai?topic=cj.program.main#practice')
    expect(describedByText(reload)).toBe('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    expect(reload.getAttribute('title')).toBe('Refresh the current AI Classroom page. Saved classroom progress will still be used for recovery.')
    const source = screen.getByRole('link', { name: 'View matching tour' })
    expect(source.getAttribute('href')).toBe('/en/tour/welcome/1')
    expect(describedByText(source)).toBe('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    expect(source.getAttribute('title')).toBe('Open the static tutorial content for the current concept. This will not change AI Classroom progress.')
  })
})
