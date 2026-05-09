import { render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ClassroomAbortScopeProvider,
  useClassroomAbortScope,
} from './classroom-abort-scope'

describe('ClassroomAbortScopeProvider', () => {
  it('provides a non-aborted signal while mounted', () => {
    const { result } = renderHook(() => useClassroomAbortScope(), {
      wrapper: ({ children }) => <ClassroomAbortScopeProvider>{children}</ClassroomAbortScopeProvider>,
    })
    expect(result.current.aborted).toBe(false)
  })

  it('aborts the signal on unmount', () => {
    let captured: AbortSignal | null = null
    function Probe() {
      captured = useClassroomAbortScope()
      return null
    }
    const { unmount } = render(
      <ClassroomAbortScopeProvider>
        <Probe />
      </ClassroomAbortScopeProvider>,
    )
    expect(captured!.aborted).toBe(false)
    unmount()
    expect(captured!.aborted).toBe(true)
  })

  it('isolates separate provider instances', () => {
    let aSignal: AbortSignal | null = null
    let bSignal: AbortSignal | null = null
    function ProbeA() { aSignal = useClassroomAbortScope(); return null }
    function ProbeB() { bSignal = useClassroomAbortScope(); return null }

    const a = render(<ClassroomAbortScopeProvider><ProbeA /></ClassroomAbortScopeProvider>)
    render(<ClassroomAbortScopeProvider><ProbeB /></ClassroomAbortScopeProvider>)

    a.unmount()
    expect(aSignal!.aborted).toBe(true)
    expect(bSignal!.aborted).toBe(false)
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useClassroomAbortScope())).toThrowError(
      /ClassroomAbortScopeProvider/,
    )
  })
})
