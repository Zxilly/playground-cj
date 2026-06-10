import { describe, expect, it, vi } from 'vitest'
import {
  deriveLiveScrollWatermarkIndex,
  findVisibleIndexForBlockKey,
  findVisibleIndexForExerciseId,
  focusLatestLiveStreamItem,
  focusLiveChapterAnchor,
  focusLiveExerciseAnchor,
  isPinnedToLiveScrollBottom,
  measureLiveScrollViewport,
  restoreLiveScrollPosition,
  scrollLiveViewportToBlockKey,
  scrollLiveViewportToBottom,
  scrollLiveViewportToExerciseId,
  scrollLiveViewportToMarker,
} from './classroom-live-scroll-surface-model'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { lessonBlockDomId } from '@/lib/ai/classroom/selectors'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { ScrollRailMarker } from '@/features/tour-ai/utils/scroll-rail-markers'
import { projectClassroomLiveViewSurface } from '@/lib/ai/classroom/view-projections'

function sessionWithHeadings(): ClassroomSession {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.program.main',
    blockIds: ['cj.program.main.heading'],
    now: 1,
  })
  session = classroomReducer(session, {
    type: 'APPEND_BRIDGE_NOTE',
    conceptIds: ['cj.program.main'],
    body: 'bridge',
    now: 2,
  })
  return classroomReducer(session, {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading'],
    now: 3,
  })
}

function sessionWithExercise(): ClassroomSession {
  return classroomReducer(sessionWithHeadings(), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '输出 Cangjie。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 4,
  })
}

function fakeViewport(overrides: Partial<HTMLDivElement> = {}) {
  const viewport = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
    querySelector: vi.fn(() => null),
    scrollTo: vi.fn(({ top }: ScrollToOptions) => {
      if (typeof top === 'number')
        viewport.scrollTop = top
    }),
    ...overrides,
  } as unknown as HTMLDivElement
  return viewport
}

describe('classroom live scroll surface', () => {
  it('measures the viewport lens and bottom-follow distance from one scroll read', () => {
    const measurement = measureLiveScrollViewport({
      scrollTop: 200,
      scrollHeight: 1000,
      clientHeight: 250,
    } as HTMLDivElement)

    expect(measurement.maxScrollTop).toBe(750)
    expect(measurement.viewportRatio).toBe(0.25)
    expect(measurement.lensTopPct).toBeCloseTo(0.2)
    expect(measurement.bottomDistance).toBe(550)
    expect(isPinnedToLiveScrollBottom(measurement)).toBe(false)
    expect(deriveLiveScrollWatermarkIndex(measurement, 10)).toBe(4)
  })

  it('maps chapter block keys back to visible-stream indexes for Virtuoso fallback', () => {
    const session = sessionWithHeadings()
    const surface = projectClassroomLiveViewSurface(session)
    const secondHeading = session.stream[2]
    if (secondHeading?.type !== 'content_reference_group')
      throw new Error('expected heading stream item')

    expect(findVisibleIndexForBlockKey(surface, lessonBlockDomId(secondHeading.id, 0))).toBe(2)
    expect(findVisibleIndexForBlockKey(surface, 'missing:block')).toBeNull()
  })

  it('maps exercise ids back to visible-stream indexes for task recovery', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')

    const surface = projectClassroomLiveViewSurface(session)

    expect(findVisibleIndexForExerciseId(surface, activeExerciseId)).toBe(3)
    expect(findVisibleIndexForExerciseId(surface, 'missing:exercise')).toBeNull()
  })

  it('uses a rendered chapter anchor before virtualized fallbacks', () => {
    const session = sessionWithHeadings()
    const firstHeading = session.stream[0]
    if (firstHeading?.type !== 'content_reference_group')
      throw new Error('expected heading stream item')
    const target = { scrollIntoView: vi.fn(), focus: vi.fn() } as unknown as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
    })
    const virtuoso = { scrollToIndex: vi.fn() }

    const didScroll = scrollLiveViewportToBlockKey({
      viewport,
      virtuoso,
      surface: projectClassroomLiveViewSurface(session),
      blockKey: lessonBlockDomId(firstHeading.id, 0),
    })

    expect(didScroll).toBe(true)
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(virtuoso.scrollToIndex).not.toHaveBeenCalled()
  })

  it('focuses a rendered chapter anchor without changing scroll position', () => {
    const target = { focus: vi.fn() } as unknown as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
    })

    expect(focusLiveChapterAnchor(viewport, 'block:println')).toBe(true)
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('scrolls to the latest live item with end alignment when Virtuoso is available', () => {
    const viewport = fakeViewport()
    const virtuoso = { scrollToIndex: vi.fn() }

    expect(scrollLiveViewportToBottom({ viewport, virtuoso, visibleCount: 4 })).toBe(true)

    expect(virtuoso.scrollToIndex).toHaveBeenCalledWith({ index: 3, align: 'end', behavior: 'smooth' })
    expect(viewport.scrollTo).not.toHaveBeenCalled()
  })

  it('falls back to the viewport bottom when no virtual scroller is available', () => {
    const viewport = fakeViewport({ scrollHeight: 1200 })

    expect(scrollLiveViewportToBottom({ viewport, virtuoso: null, visibleCount: 4 })).toBe(true)

    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'smooth' })
  })

  it('focuses the latest rendered live stream item after a bottom jump', () => {
    const first = { focus: vi.fn() } as unknown as HTMLElement
    const latest = { focus: vi.fn() } as unknown as HTMLElement
    const viewport = fakeViewport({
      querySelectorAll: vi.fn(() => [first, latest] as unknown as NodeListOf<HTMLElement>),
    })

    expect(focusLatestLiveStreamItem(viewport)).toBe(true)
    expect(first.focus).not.toHaveBeenCalled()
    expect(latest.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('falls back through Virtuoso when the chapter anchor is not rendered', () => {
    const session = sessionWithHeadings()
    const secondHeading = session.stream[2]
    if (secondHeading?.type !== 'content_reference_group')
      throw new Error('expected heading stream item')
    const viewport = fakeViewport()
    const virtuoso = { scrollToIndex: vi.fn() }

    const didScroll = scrollLiveViewportToBlockKey({
      viewport,
      virtuoso,
      surface: projectClassroomLiveViewSurface(session),
      blockKey: lessonBlockDomId(secondHeading.id, 0),
    })

    expect(didScroll).toBe(true)
    expect(virtuoso.scrollToIndex).toHaveBeenCalledWith({ index: 2, align: 'start', behavior: 'smooth' })
  })

  it('uses a rendered exercise card before virtualized task fallbacks without stealing focus by default', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')
    const target = { scrollIntoView: vi.fn(), focus: vi.fn() } as unknown as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
    })
    const virtuoso = { scrollToIndex: vi.fn() }

    const didScroll = scrollLiveViewportToExerciseId({
      viewport,
      virtuoso,
      surface: projectClassroomLiveViewSurface(session),
      exerciseId: activeExerciseId,
    })

    expect(didScroll).toBe(true)
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(target.focus).not.toHaveBeenCalled()
    expect(virtuoso.scrollToIndex).not.toHaveBeenCalled()
  })

  it('focuses a rendered exercise card when task recovery requests focus', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')
    const target = { scrollIntoView: vi.fn(), focus: vi.fn() } as unknown as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
    })
    const virtuoso = { scrollToIndex: vi.fn() }

    const didScroll = scrollLiveViewportToExerciseId({
      viewport,
      virtuoso,
      surface: projectClassroomLiveViewSurface(session),
      exerciseId: activeExerciseId,
      focus: true,
    })

    expect(didScroll).toBe(true)
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(virtuoso.scrollToIndex).not.toHaveBeenCalled()
  })

  it('focuses a rendered exercise anchor without changing scroll position', () => {
    const target = { focus: vi.fn() } as unknown as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
    })

    expect(focusLiveExerciseAnchor(viewport, 'exercise:1')).toBe(true)
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('falls back when a rendered exercise card cannot scroll itself into view', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')
    const target = {} as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
    })
    const virtuoso = { scrollToIndex: vi.fn() }

    const didScroll = scrollLiveViewportToExerciseId({
      viewport,
      virtuoso,
      surface: projectClassroomLiveViewSurface(session),
      exerciseId: activeExerciseId,
    })

    expect(didScroll).toBe(true)
    expect(virtuoso.scrollToIndex).toHaveBeenCalledWith({ index: 3, align: 'start', behavior: 'smooth' })
  })

  it('falls back to scrollTop when neither the exercise card nor viewport can smooth-scroll', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')
    const target = {} as HTMLElement
    const viewport = fakeViewport({
      querySelector: vi.fn(() => target),
      scrollTo: undefined as never,
    })

    const didScroll = scrollLiveViewportToExerciseId({
      viewport,
      virtuoso: null,
      surface: projectClassroomLiveViewSurface(session),
      exerciseId: activeExerciseId,
    })

    expect(didScroll).toBe(true)
    expect(viewport.scrollTop).toBe(600)
  })

  it('falls back through Virtuoso when the active exercise card is virtualized', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')
    const viewport = fakeViewport()
    const virtuoso = { scrollToIndex: vi.fn() }

    const didScroll = scrollLiveViewportToExerciseId({
      viewport,
      virtuoso,
      surface: projectClassroomLiveViewSurface(session),
      exerciseId: activeExerciseId,
    })

    expect(didScroll).toBe(true)
    expect(virtuoso.scrollToIndex).toHaveBeenCalledWith({ index: 3, align: 'start', behavior: 'smooth' })
  })

  it('falls back to marker ratio navigation when no anchor or Virtuoso is available', () => {
    const viewport = fakeViewport()
    const marker: ScrollRailMarker = {
      id: 'marker',
      visibleIndex: 2,
      visibleCount: 5,
      kind: 'exercise',
      label: 'Exercise',
    }

    const didScroll = scrollLiveViewportToMarker({
      viewport,
      virtuoso: null,
      surface: projectClassroomLiveViewSurface(sessionWithHeadings()),
      marker,
    })

    expect(didScroll).toBe(true)
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'smooth' })
  })

  it('restores a valid watermark via Virtuoso and otherwise lands at the bottom', () => {
    const session = sessionWithHeadings()
    const viewport = fakeViewport()
    const virtuoso = { scrollToIndex: vi.fn() }

    const surface = projectClassroomLiveViewSurface(session)

    expect(restoreLiveScrollPosition({ viewport, virtuoso, surface, watermarkIndex: 2 })).toBe(true)
    expect(virtuoso.scrollToIndex).toHaveBeenCalledWith({ index: 2, align: 'start', behavior: 'auto' })

    restoreLiveScrollPosition({ viewport, virtuoso: null, surface, watermarkIndex: -1 })
    expect(viewport.scrollTop).toBe(1000)
  })

  it('restores to the active exercise before using an older reading watermark', () => {
    const session = sessionWithExercise()
    const activeExerciseId = session.currentExercise?.id
    if (!activeExerciseId)
      throw new Error('expected active exercise')
    const viewport = fakeViewport()
    const virtuoso = { scrollToIndex: vi.fn() }
    const surface = projectClassroomLiveViewSurface(session)

    expect(restoreLiveScrollPosition({
      viewport,
      virtuoso,
      surface,
      watermarkIndex: 0,
      activeExerciseId,
    })).toBe(true)

    expect(virtuoso.scrollToIndex).toHaveBeenCalledWith({ index: 3, align: 'start', behavior: 'auto' })
  })
})
