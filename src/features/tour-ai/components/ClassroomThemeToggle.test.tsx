import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomThemeProvider } from '@/features/tour-ai/context/classroom-theme-context'
import { ClassroomThemeToggle } from './ClassroomThemeToggle'

beforeEach(() => {
  vi.stubGlobal('window', {
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('ClassroomThemeToggle', () => {
  it('cycles auto → light → dark → auto on clicks', () => {
    render(
      <ClassroomThemeProvider>
        <ClassroomThemeToggle />
      </ClassroomThemeProvider>,
    )
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toContain('跟随系统')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toContain('浅色')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toContain('深色')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-label')).toContain('跟随系统')
  })
})
