import { render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ClassroomAbortScopeProvider,
  useClassroomAbortScope,
} from './classroom-abort-scope'

// Module-level probe components to satisfy react/component-hook-factories rule
let capturedSignal: AbortSignal | null = null
function Probe() {
  capturedSignal = useClassroomAbortScope()
  return null
}

let capturedA: AbortSignal | null = null
let capturedB: AbortSignal | null = null
function ProbeA() {
  capturedA = useClassroomAbortScope()
  return null
}
function ProbeB() {
  capturedB = useClassroomAbortScope()
  return null
}

describe('classroomAbortScopeProvider', () => {
  it('provides a non-aborted signal while mounted', () => {
    const { result } = renderHook(() => useClassroomAbortScope(), {
      wrapper: ({ children }) => <ClassroomAbortScopeProvider>{children}</ClassroomAbortScopeProvider>,
    })
    expect(result.current.aborted).toBe(false)
  })

  it('aborts the signal on unmount', () => {
    capturedSignal = null
    const { unmount } = render(
      <ClassroomAbortScopeProvider>
        <Probe />
      </ClassroomAbortScopeProvider>,
    )
    expect(capturedSignal!.aborted).toBe(false)
    unmount()
    expect(capturedSignal!.aborted).toBe(true)
  })

  it('isolates separate provider instances', () => {
    capturedA = null
    capturedB = null
    const a = render(<ClassroomAbortScopeProvider><ProbeA /></ClassroomAbortScopeProvider>)
    render(<ClassroomAbortScopeProvider><ProbeB /></ClassroomAbortScopeProvider>)

    a.unmount()
    expect(capturedA!.aborted).toBe(true)
    expect(capturedB!.aborted).toBe(false)
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useClassroomAbortScope())).toThrowError(
      /ClassroomAbortScopeProvider/,
    )
  })
})
