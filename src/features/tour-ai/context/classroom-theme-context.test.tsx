import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomThemeProvider, useClassroomTheme } from './classroom-theme-context'

let fakeMatches = false
let storage: Map<string, string>

beforeEach(() => {
  fakeMatches = false
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem(k: string) {
      return storage.get(k) ?? null
    },
    setItem(k: string, v: string) {
      storage.set(k, v)
    },
    removeItem(k: string) {
      storage.delete(k)
    },
  })
  vi.stubGlobal('window', {
    localStorage: globalThis.localStorage,
    matchMedia: () => ({
      get matches() {
        return fakeMatches
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <ClassroomThemeProvider>{children}</ClassroomThemeProvider>
}

describe('classroomThemeProvider', () => {
  it('reads initial mode from localStorage', () => {
    storage.set('classroom-theme-mode', 'dark')
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })

  it('defaults to auto when localStorage empty', () => {
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    expect(result.current.mode).toBe('auto')
  })

  it('applies dark class to html when resolved=dark', () => {
    storage.set('classroom-theme-mode', 'dark')
    renderHook(() => useClassroomTheme(), { wrapper })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes dark class from html when switched to light', () => {
    storage.set('classroom-theme-mode', 'dark')
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    act(() => result.current.setMode('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setMode writes to localStorage', () => {
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    expect(storage.get('classroom-theme-mode')).toBe('dark')
  })

  it('resolved follows systemDark when mode=auto', () => {
    fakeMatches = true
    const { result } = renderHook(() => useClassroomTheme(), { wrapper })
    expect(result.current.mode).toBe('auto')
    expect(result.current.resolved).toBe('dark')
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useClassroomTheme())).toThrow(/ClassroomThemeProvider/)
  })
})
