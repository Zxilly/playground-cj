import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useRootDarkMode } from './useRootDarkMode'

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('useRootDarkMode', () => {
  it('tracks the actual document theme class', async () => {
    const { result } = renderHook(() => useRootDarkMode())
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
})
