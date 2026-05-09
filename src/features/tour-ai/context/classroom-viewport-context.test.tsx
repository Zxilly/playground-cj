import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { ViewportRefProvider, useViewportRef } from './classroom-viewport-context'

describe('viewportRefContext', () => {
  it('exposes the provided ref', () => {
    const ref = createRef<HTMLDivElement>()
    function wrapper({ children }: { children: React.ReactNode }) {
      return <ViewportRefProvider value={ref}>{children}</ViewportRefProvider>
    }
    const { result } = renderHook(() => useViewportRef(), { wrapper })
    expect(result.current).toBe(ref)
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useViewportRef())).toThrow(/ViewportRefProvider/)
  })
})
