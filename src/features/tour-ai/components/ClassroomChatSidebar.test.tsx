import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { ClassroomChatSidebar } from './ClassroomChatSidebar'

function MockTourAIChat({ activeConceptId }: { activeConceptId?: string }) {
  return (
    <div data-testid="tour-ai-chat">
      {`chat:${activeConceptId ?? 'classroom'}`}
      <button type="button" aria-label="发送消息" />
    </div>
  )
}

vi.mock('@/features/tour-ai/components/TourAIChat', () => ({
  TourAIChat: MockTourAIChat,
}))

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

function renderSidebar(onClose = vi.fn()) {
  render(<ClassroomChatSidebar activeConceptId="cj.io.println" onClose={onClose} />, { wrapper: Wrapper })
  return { onClose }
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

describe('classroom chat sidebar', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('style')
    document.body.removeAttribute('style')
  })

  it('renders as a modal dialog and focuses the close button', () => {
    renderSidebar()

    const dialog = screen.getByRole('dialog', { name: '聊天' })
    expect(dialog).toBe(screen.getByTestId('classroom-chat-sidebar'))
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(describedByText(dialog)).toBe('聊天会优先围绕当前概念作为上下文；关闭浮层不会改变课堂进度。')
    expect(screen.getByTestId('tour-ai-chat').textContent).toBe('chat:cj.io.println')
    const close = screen.getByRole('button', { name: '关闭聊天' })
    expect(describedByText(close)).toBe('聊天会优先围绕当前概念作为上下文；关闭浮层不会改变课堂进度。')
    expect(close.getAttribute('title')).toBe('关闭聊天浮层；不会改变课堂进度、当前代码或已保存的课堂记录。')
    expect(close.className).toContain('shrink-0')
    expect(close.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(document.activeElement).toBe(close)
  })

  it('uses compiled English copy for modal boundaries and close action', () => {
    render(
      <ClassroomChatSidebar activeConceptId="cj.io.println" onClose={vi.fn()} />,
      { wrapper: EnWrapper },
    )

    const dialog = screen.getByRole('dialog', { name: 'Chat' })
    expect(describedByText(dialog)).toBe(
      'Chat will prioritize the current concept as context. Closing the overlay will not change classroom progress.',
    )
    const close = screen.getByRole('button', { name: 'Close chat' })
    expect(describedByText(close)).toBe(
      'Chat will prioritize the current concept as context. Closing the overlay will not change classroom progress.',
    )
    expect(close.getAttribute('title')).toBe(
      'Close the chat overlay. This will not change classroom progress, current code, or saved classroom records.',
    )
    expect(screen.queryByText('聊天')).toBeNull()
  })

  it('locks document scrolling while the chat dialog is mounted and restores previous styles', () => {
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.overscrollBehavior = 'auto'
    document.body.style.overflow = 'clip'
    document.body.style.overscrollBehavior = 'none'

    const { unmount } = render(
      <ClassroomChatSidebar activeConceptId="cj.io.println" onClose={vi.fn()} />,
      { wrapper: Wrapper },
    )

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overscrollBehavior).toBe('contain')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.overscrollBehavior).toBe('contain')

    unmount()

    expect(document.documentElement.style.overflow).toBe('auto')
    expect(document.documentElement.style.overscrollBehavior).toBe('auto')
    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.overscrollBehavior).toBe('none')
  })

  it('closes from the overlay, close button, and Escape', () => {
    const { onClose } = renderSidebar()

    const overlay = screen.getByTestId('classroom-chat-overlay')
    expect(overlay.tagName).toBe('DIV')
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    expect(overlay.tabIndex).toBe(-1)
    expect(screen.queryByRole('button', { name: '关闭聊天浮层' })).toBeNull()
    fireEvent.click(overlay)
    fireEvent.click(screen.getByRole('button', { name: '关闭聊天' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('describes classroom-scoped chat when no concept is focused', () => {
    render(<ClassroomChatSidebar onClose={vi.fn()} />, { wrapper: Wrapper })

    const dialog = screen.getByRole('dialog', { name: '聊天' })
    expect(describedByText(dialog)).toBe('聊天会使用当前课堂内容作为上下文；关闭浮层不会改变课堂进度。')
    expect(screen.getByTestId('tour-ai-chat').textContent).toBe('chat:classroom')
  })

  it('keeps Tab focus inside the chat dialog', () => {
    renderSidebar()

    const close = screen.getByRole('button', { name: '关闭聊天' })
    const send = screen.getByRole('button', { name: '发送消息' })

    send.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(send)

    document.body.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('does not steal focus when the parent rerenders with a fresh close handler', () => {
    const firstClose = vi.fn()
    const { rerender } = render(
      <ClassroomChatSidebar activeConceptId="cj.io.println" onClose={firstClose} />,
      { wrapper: Wrapper },
    )

    const send = screen.getByRole('button', { name: '发送消息' })
    send.focus()

    const latestClose = vi.fn()
    rerender(
      <ClassroomChatSidebar activeConceptId="cj.io.println" onClose={latestClose} />,
    )

    expect(document.activeElement).toBe(send)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(firstClose).not.toHaveBeenCalled()
    expect(latestClose).toHaveBeenCalledTimes(1)
  })
})
