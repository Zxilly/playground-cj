import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useTheme } from 'next-themes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { useDarkMode } from './useDarkMode'

interface FakeMql {
  matches: boolean
  media: string
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  _trigger: (matches: boolean) => void
}

function makeFakeMql(initial: boolean): FakeMql {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const fake: FakeMql = {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    addListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => listeners.add(cb)),
    removeListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb)),
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb)),
    _trigger(matches: boolean) {
      fake.matches = matches
      for (const cb of listeners) cb({ matches } as MediaQueryListEvent)
    },
  }
  return fake
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  return createElement(ThemeProvider, null, children)
}

describe('useDarkMode', () => {
  let fakeMql: FakeMql

  beforeEach(() => {
    fakeMql = makeFakeMql(false)
    window.localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => fakeMql),
    })
  })

  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  it('tracks root html.dark when rendered outside ThemeProvider', async () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(false)

    await act(async () => {
      document.documentElement.classList.add('dark')
      await Promise.resolve()
    })
    expect(result.current).toBe(true)

    await act(async () => {
      document.documentElement.classList.remove('dark')
      await Promise.resolve()
    })
    expect(result.current).toBe(false)
  })

  it('reacts to next-themes explicit selection and system color scheme changes', async () => {
    const { result } = renderHook(
      () => ({ dark: useDarkMode(), theme: useTheme() }),
      { wrapper: ThemeWrapper },
    )

    expect(result.current.dark).toBe(false)

    await act(async () => {
      fakeMql._trigger(true)
    })
    await waitFor(() => expect(result.current.dark).toBe(true))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await act(async () => {
      result.current.theme.setTheme('light')
    })
    await waitFor(() => expect(result.current.dark).toBe(false))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('migrates legacy classroom-theme-mode once on mount', async () => {
    window.localStorage.setItem('classroom-theme-mode', 'dark')

    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeWrapper })

    await waitFor(() => expect(result.current).toBe(true))
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(window.localStorage.getItem('classroom-theme-mode')).toBeNull()
  })
})
