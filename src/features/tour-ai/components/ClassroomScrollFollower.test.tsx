import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassroomScrollFollower } from './ClassroomScrollFollower'
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

function describedByText(element: Element): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids.map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')
}

describe('classroom scroll follower', () => {
  afterEach(() => cleanup())

  it('keeps the new-content shortcut descriptive without exposing its icon', () => {
    const onClick = vi.fn()
    render(<ClassroomScrollFollower visible onClick={onClick} />, { wrapper: Wrapper })

    const button = screen.getByRole('button', { name: '滚动到最新内容' })
    expect(describedByText(button)).toBe('跳到课堂流底部查看新生成内容，不会改变学习进度。')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(button.className).toContain('right-4')
    expect(button.className).not.toContain('left-1/2')

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    const status = screen.getByTestId('classroom-scroll-follower-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('已跳到最新课堂内容。')
  })

  it('uses compiled English copy for the new-content shortcut', () => {
    const onClick = vi.fn()
    render(<ClassroomScrollFollower visible onClick={onClick} />, { wrapper: EnWrapper })

    const button = screen.getByRole('button', { name: 'Scroll to latest content' })
    expect(describedByText(button)).toBe('Jump to the bottom of the classroom stream to view newly generated content. This will not change learning progress.')

    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('classroom-scroll-follower-status').textContent).toBe('Jumped to the latest classroom content.')
    expect(screen.queryByText('跳到课堂流底部查看新生成内容，不会改变学习进度。')).toBeNull()
  })

  it('does not render the shortcut while the learner is already at the latest content', () => {
    render(<ClassroomScrollFollower visible={false} onClick={vi.fn()} />, { wrapper: Wrapper })

    expect(screen.queryByRole('button', { name: '滚动到最新内容' })).toBeNull()
    expect(screen.queryByTestId('classroom-scroll-follower-status')).toBeNull()
  })
})
