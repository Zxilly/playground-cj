import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDarkMode } from './useDarkMode'

interface FakeMql {
  matches: boolean
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  _trigger: (matches: boolean) => void
}

function makeFakeMql(initial: boolean): FakeMql {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const fake = {
    matches: initial,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb)),
    _trigger(matches: boolean) {
      fake.matches = matches
      for (const cb of listeners) cb({ matches } as MediaQueryListEvent)
    },
  }
  return fake
}

describe('useDarkMode', () => {
  let fakeMql: FakeMql
  beforeEach(() => {
    fakeMql = makeFakeMql(false)
    vi.stubGlobal('window', { matchMedia: vi.fn(() => fakeMql) })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns initial matches value', () => {
    fakeMql.matches = true
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(true)
  })

  it('updates when prefers-color-scheme changes', () => {
    const { result, rerender } = renderHook(() => useDarkMode())
    expect(result.current).toBe(false)
    fakeMql._trigger(true)
    rerender()
    expect(result.current).toBe(true)
  })

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useDarkMode())
    expect(fakeMql.addEventListener).toHaveBeenCalledTimes(1)
    unmount()
    expect(fakeMql.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
