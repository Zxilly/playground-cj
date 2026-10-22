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
    vi.restoreAllMocks()
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

  it('highlights a target that mounts after the lesson and stops observing once it appears', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const { rerender, unmount } = render(<div><Highlight target="run">run button</Highlight></div>)

    await act(async () => {
      rerender(
        <div>
          <Highlight target="run">run button</Highlight>
          <button type="button" data-tour-highlight="run">Run</button>
        </div>,
      )
    })

    const target = screen.getByRole('button', { name: 'Run' })
    expect(target.classList.contains('tour-highlight-pulse')).toBe(true)
    expect(disconnect).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(target.classList.contains('tour-highlight-pulse')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)

    fireEvent.mouseEnter(screen.getByText('run button'))
    expect(target.classList.contains('tour-highlight-pulse')).toBe(true)
    unmount()
    expect(target.classList.contains('tour-highlight-pulse')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('disconnects and clears the waiting deadline when the lesson unmounts', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const { unmount } = render(<Highlight target="run">run button</Highlight>)
    unmount()

    expect(disconnect).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    await act(async () => {
      render(<button type="button" data-tour-highlight="run">Run</button>)
    })
    expect(screen.getByRole('button', { name: 'Run' }).classList.contains('tour-highlight-pulse')).toBe(false)
  })

  it('stops waiting if a target never mounts', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    render(<Highlight target="missing">missing target</Highlight>)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(disconnect).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
