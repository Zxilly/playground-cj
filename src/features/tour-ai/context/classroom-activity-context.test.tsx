import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ClassroomActivityProvider,
  useClassroomActivity,
} from './classroom-activity-context'

describe('ClassroomActivityProvider', () => {
  it('provides default activity flags as false', () => {
    const { result } = renderHook(() => useClassroomActivity(), {
      wrapper: ({ children }) => <ClassroomActivityProvider>{children}</ClassroomActivityProvider>,
    })
    expect(result.current.activity).toEqual({ generationRunning: false, runnerRunning: false })
  })

  it('updates generationRunning via setter', () => {
    const { result } = renderHook(() => useClassroomActivity(), {
      wrapper: ({ children }) => <ClassroomActivityProvider>{children}</ClassroomActivityProvider>,
    })
    act(() => result.current.setGenerationRunning(true))
    expect(result.current.activity.generationRunning).toBe(true)
    expect(result.current.activity.runnerRunning).toBe(false)
  })

  it('updates runnerRunning via setter', () => {
    const { result } = renderHook(() => useClassroomActivity(), {
      wrapper: ({ children }) => <ClassroomActivityProvider>{children}</ClassroomActivityProvider>,
    })
    act(() => result.current.setRunnerRunning(true))
    expect(result.current.activity.runnerRunning).toBe(true)
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useClassroomActivity())).toThrowError(
      /ClassroomActivityProvider/,
    )
  })
})
