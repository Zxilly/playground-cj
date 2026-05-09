import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomThemeProvider, useClassroomTheme } from './classroom-theme-context'

let fakeMatches = false
beforeEach(() => {
  fakeMatches = false
  vi.stubGlobal('window', {
    matchMedia: () => ({
      get matches() { return fakeMatches },
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <ClassroomThemeProvider>{children}</ClassroomThemeProvider>
}

describe('classroomThemeProvider', () => {
  it('defaults to mode=auto, resolved follows systemDark', () => {
    fakeMatches = true
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    expect(result.current.mode).toBe('auto')
    expect(result.current.resolved).toBe('dark')
  })

  it('setMode("light") forces light regardless of systemDark', () => {
    fakeMatches = true
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    act(() => result.current.setMode('light'))
    expect(result.current.mode).toBe('light')
    expect(result.current.resolved).toBe('light')
  })

  it('setMode("dark") forces dark regardless of systemDark', () => {
    fakeMatches = false
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    expect(result.current.resolved).toBe('dark')
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useClassroomTheme())).toThrow(/ClassroomThemeProvider/)
  })
})
