import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode, RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomLiveScrollSurfaceProvider } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { ClassroomSessionProvider } from '@/features/tour-ai/context/classroom-session-context'
import { ClassroomVirtuosoProvider } from '@/features/tour-ai/context/classroom-virtuoso-context'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
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
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    scrollTo: vi.fn(({ top }: ScrollToOptions) => {
      if (typeof top === 'number')
        el.scrollTop = top
    }),
    _fire(evt: string) {
      for (const cb of listeners.get(evt) ?? []) cb({} as Event)
    },
    _setScroll(top: number) {
      el.scrollTop = top
    },
  } as unknown as FakeViewport
  return el
}

function sessionWithBridgeNotes(count: number): ClassroomSession {
  let session = createInitialClassroomSession({ lang: 'zh' })
  for (let i = 0; i < count; i++) {
    session = classroomReducer(session, {
      type: 'APPEND_BRIDGE_NOTE',
      conceptIds: ['cj.program.main'],
      body: `note ${i}`,
      now: i + 1,
    })
  }
  return session
}

function renderFollower(fakeEl: FakeViewport, initialSession: ClassroomSession) {
  let session = initialSession
  const ref = { current: fakeEl } as RefObject<HTMLDivElement | null>
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      ClassroomSessionProvider,
      {
        value: {
          session,
          dispatch: () => {},
          hydrated: true,
          hydrationIssue: null,
          saveIssue: null,
          retrySave: () => {},
          resetSession: () => {},
          annotationState: createEditorAnnotationState(),
        },
        children: createElement(
          ClassroomVirtuosoProvider,
          { children: createElement(
            ClassroomLiveScrollSurfaceProvider,
            { viewportRef: ref, lang: 'zh', hydrated: true, children },
          ) },
        ),
      },
    )

  const rendered = renderHook(() => useScrollFollower(), { wrapper })
  return {
    ...rendered,
    setSession(nextSession: ClassroomSession) {
      session = nextSession
      rendered.rerender()
    },
  }
}

describe('useScrollFollower', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', undefined)
    useScrollWatermarkStore.setState({ watermarks: {} })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts pinned and unpins when scrolled away from bottom', () => {
    const fakeEl = makeFakeViewport({ scrollTop: 0, scrollHeight: 1000, clientHeight: 600 })
    const { result } = renderFollower(fakeEl, sessionWithBridgeNotes(1))
    expect(result.current.pinned).toBe(true)
    act(() => {
      fakeEl._setScroll(50)
      fakeEl._fire('scroll')
    })
    expect(result.current.pinned).toBe(false)
  })

  it('marks newContentBelow when the stream grows while unpinned', () => {
    const fakeEl = makeFakeViewport({ scrollTop: 50, scrollHeight: 1000, clientHeight: 600 })
    const rendered = renderFollower(fakeEl, sessionWithBridgeNotes(1))
    act(() => {
      fakeEl._setScroll(50)
      fakeEl._fire('scroll')
    })
    expect(rendered.result.current.pinned).toBe(false)

    act(() => rendered.setSession(sessionWithBridgeNotes(2)))

    expect(rendered.result.current.newContentBelow).toBe(true)
    expect(rendered.result.current.visible).toBe(true)
  })

  it('scrollToBottom clears the shortcut and focuses the latest rendered stream item', () => {
    const fakeEl = makeFakeViewport({ scrollHeight: 1000 })
    const latest = { focus: vi.fn() } as unknown as HTMLElement
    vi.mocked(fakeEl.querySelectorAll).mockReturnValue([latest] as unknown as NodeListOf<HTMLElement>)
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const rendered = renderFollower(fakeEl, sessionWithBridgeNotes(1))
    act(() => {
      fakeEl._setScroll(50)
      fakeEl._fire('scroll')
    })
    act(() => rendered.setSession(sessionWithBridgeNotes(2)))
    expect(rendered.result.current.visible).toBe(true)
    vi.mocked(fakeEl.scrollTo).mockClear()

    act(() => rendered.result.current.scrollToBottom())

    expect(fakeEl.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
    expect(rendered.result.current.visible).toBe(false)
    expect(latest.focus).toHaveBeenCalledWith({ preventScroll: true })
    raf.mockRestore()
  })
})
