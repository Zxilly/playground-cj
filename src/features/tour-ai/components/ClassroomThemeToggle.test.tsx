import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { i18n as globalI18n } from '@lingui/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomThemeProvider } from '@/features/tour-ai/context/classroom-theme-context'
import { ClassroomThemeToggle } from './ClassroomThemeToggle'
import { messages as enMessages } from '@/locales/en/messages.mjs'

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  vi.stubGlobal('window', {
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('classroomThemeToggle', () => {
  it('cycles auto → light → dark → auto on clicks', () => {
    render(
      <ClassroomThemeProvider>
        <ClassroomThemeToggle />
      </ClassroomThemeProvider>,
    )
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('shrink-0')
    expect(btn.getAttribute('aria-label')).toContain('跟随系统')
    expect(btn.getAttribute('title')).toBe('点击后切换到浅色主题。')
    expect(describedByText(btn)).toBe('点击后切换到浅色主题。')
    expect(btn.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(btn.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toContain('浅色')
    expect(describedByText(btn)).toBe('点击后切换到深色主题。')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toContain('深色')
    expect(describedByText(btn)).toBe('点击后切换到跟随系统主题。')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toContain('跟随系统')
    expect(describedByText(btn)).toBe('点击后切换到浅色主题。')
  })

  it('uses compiled English labels for the next theme', () => {
    globalI18n.load({ en: enMessages })
    globalI18n.activate('en')
    render(
      <ClassroomThemeProvider>
        <ClassroomThemeToggle />
      </ClassroomThemeProvider>,
    )

    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toBe('Theme: follow system')
    expect(btn.getAttribute('title')).toBe('Click to switch to light theme.')
    expect(describedByText(btn)).toBe('Click to switch to light theme.')
  })
})
