import type { ReactNode } from 'react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassroomStaleChatAnnotationsNotice } from './ClassroomStaleChatAnnotationsNotice'
import { messages as enMessages } from '@/locales/en/messages.mjs'

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
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

describe('classroomStaleChatAnnotationsNotice', () => {
  afterEach(() => {
    cleanup()
  })

  it('stays hidden when no stale chat annotations exist', () => {
    render(<ClassroomStaleChatAnnotationsNotice staleCount={0} onClear={vi.fn()} />, { wrapper: Wrapper })

    expect(screen.queryByTestId('classroom-stale-chat-annotations-notice')).toBeNull()
  })

  it('explains stale chat code markers and clears them explicitly', () => {
    const onClear = vi.fn()
    const { rerender } = render(<ClassroomStaleChatAnnotationsNotice staleCount={2} onClear={onClear} />, { wrapper: Wrapper })

    const notice = screen.getByTestId('classroom-stale-chat-annotations-notice')
    expect(notice).toBe(screen.getByRole('region', { name: '聊天里的代码提示可能不是最新的。' }))
    expect(notice.getAttribute('aria-describedby')).toBeTruthy()
    screen.getByText('聊天里的代码提示可能不是最新的。')
    screen.getByText('代码已变化，2 个聊天标记不再匹配当前位置。清除后可让聊天重新标注。')
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toContain('2 个聊天标记不再匹配当前位置')

    const clear = screen.getByRole('button', { name: '清除旧标记' })
    expect(clear.className).toContain('w-full')
    expect(clear.className).toContain('sm:w-auto')
    expect(clear.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(describedByText(clear)).toContain('2 个聊天标记不再匹配当前位置')
    expect(clear.getAttribute('title')).toBe('只清除 2 个失效的聊天代码标记；不会删除聊天内容、改动代码或改变学习进度。清除后聊天可以重新标注当前位置。')

    fireEvent.click(clear)

    expect(onClear).toHaveBeenCalledTimes(1)
    rerender(<ClassroomStaleChatAnnotationsNotice staleCount={0} onClear={onClear} />)

    const cleared = screen.getByTestId('classroom-stale-chat-annotations-cleared')
    expect(cleared).toBe(screen.getByRole('status'))
    expect(cleared.getAttribute('aria-live')).toBe('polite')
    expect(cleared.getAttribute('aria-atomic')).toBe('true')
    expect(cleared.textContent).toBe('已清除 2 个旧聊天代码标记。聊天内容、代码和学习进度都没有改变。')
    expect(cleared.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(cleared)
  })

  it('uses compiled English copy for stale chat code marker cleanup', () => {
    const onClear = vi.fn()
    const { rerender } = render(<ClassroomStaleChatAnnotationsNotice staleCount={3} onClear={onClear} />, { wrapper: EnWrapper })

    const notice = screen.getByTestId('classroom-stale-chat-annotations-notice')
    expect(notice).toBe(screen.getByRole('region', { name: 'Code hints in chat may be out of date.' }))
    screen.getByText('Code hints in chat may be out of date.')
    screen.getByText('Code has changed, and 3 chat marker(s) no longer match the current location. Clear them so chat can annotate the current location again.')
    const clear = screen.getByRole('button', { name: 'Clear old markers' })
    expect(describedByText(clear)).toContain('3 chat marker(s) no longer match the current location')
    expect(clear.getAttribute('title')).toBe('Only clear 3 stale chat code marker(s). This will not delete chat content, edit code, or change learning progress. After clearing, chat can annotate the current location again.')

    fireEvent.click(clear)

    expect(onClear).toHaveBeenCalledTimes(1)
    rerender(<ClassroomStaleChatAnnotationsNotice staleCount={0} onClear={onClear} />)
    expect(screen.getByTestId('classroom-stale-chat-annotations-cleared').textContent)
      .toBe('Cleared 3 old chat code marker(s). Chat content, code, and learning progress were not changed.')
    expect(screen.queryByText('聊天里的代码提示可能不是最新的。')).toBeNull()
  })
})
