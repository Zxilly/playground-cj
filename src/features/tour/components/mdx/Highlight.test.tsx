import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Highlight } from '@/features/tour/components/mdx/Highlight'

describe('highlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('adds and removes the highlight class on mount, hover, and timeout', () => {
    render(
      <div>
        <button type="button" data-tour-highlight="run">Run</button>
        <Highlight target="run">run button</Highlight>
      </div>,
    )

    const target = screen.getByRole('button', { name: 'Run' })
    const trigger = screen.getByText('run button')

    expect(target.classList.contains('tour-highlight-pulse')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(target.classList.contains('tour-highlight-pulse')).toBe(false)

    fireEvent.mouseEnter(trigger)
    expect(target.classList.contains('tour-highlight-pulse')).toBe(true)

    fireEvent.mouseLeave(trigger)
    expect(target.classList.contains('tour-highlight-pulse')).toBe(false)
  })
})
