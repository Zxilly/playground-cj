import { act, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollFollower } from './use-scroll-follower'

interface FakeViewport extends HTMLDivElement {
  _fire: (evt: string) => void
  _setScroll: (top: number) => void
}

function makeFakeViewport({ scrollTop = 0, scrollHeight = 1000, clientHeight = 600 } = {}): FakeViewport {
  const listeners = new Map<string, Set<EventListener>>()
  const el = {
    scrollTop,
    scrollHeight,
    clientHeight,
    addEventListener: vi.fn((evt: string, cb: EventListener) => {
      const set = listeners.get(evt) ?? new Set()
      set.add(cb)
      listeners.set(evt, set)
    }),
    removeEventListener: vi.fn((evt: string, cb: EventListener) => {
      listeners.get(evt)?.delete(cb)
    }),
    scrollTo: vi.fn(),
    _fire(evt: string) {
      for (const cb of listeners.get(evt) ?? []) cb({} as Event)
    },
    _setScroll(top: number) {
      el.scrollTop = top
    },
  } as unknown as FakeViewport
  return el
}

describe('useScrollFollower', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts pinned and unpins when scrolled away from bottom', () => {
    const fakeEl = makeFakeViewport({ scrollTop: 0, scrollHeight: 1000, clientHeight: 600 })
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(fakeEl)
      return useScrollFollower({ viewportRef: ref, contentLength: 0, hydrated: true })
    })
    expect(result.current.pinned).toBe(true)
    act(() => {
      fakeEl._setScroll(50)
      fakeEl._fire('scroll')
    })
    expect(result.current.pinned).toBe(false)
  })

  it('marks newContentBelow when contentLength grows while unpinned', () => {
    const fakeEl = makeFakeViewport({ scrollTop: 50, scrollHeight: 1000, clientHeight: 600 })
    const { result, rerender } = renderHook(
      ({ contentLength }) => {
        const ref = useRef<HTMLDivElement | null>(fakeEl)
        return useScrollFollower({ viewportRef: ref, contentLength, hydrated: true })
      },
      { initialProps: { contentLength: 5 } },
    )
    act(() => {
      fakeEl._fire('scroll')
    })
    expect(result.current.pinned).toBe(false)
    rerender({ contentLength: 6 })
    expect(result.current.newContentBelow).toBe(true)
  })

  it('scrollToBottom invokes viewport.scrollTo with smooth + max scroll', () => {
    const fakeEl = makeFakeViewport({ scrollHeight: 1000 })
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(fakeEl)
      return useScrollFollower({ viewportRef: ref, contentLength: 0, hydrated: true })
    })
    act(() => result.current.scrollToBottom())
    expect(fakeEl.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
  })
})
