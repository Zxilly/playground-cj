import type { VirtuosoHandle } from 'react-virtuoso'
import type { ScrollRailMarker } from '@/features/tour-ai/utils/scroll-rail-markers'
import type { ClassroomLiveViewSurface } from '@/lib/ai/classroom/view-projections'

export const LIVE_SCROLL_PIN_THRESHOLD_PX = 96

export interface LiveScrollLens {
  top: number
  height: number
}

export interface LiveScrollViewportMeasurement {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  maxScrollTop: number
  bottomDistance: number
  scrollRatio: number
  viewportRatio: number
  lensTopPct: number
  lensHeightPct: number
  bottomRatio: number
}

type ViewportMetricsSource = Pick<HTMLDivElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>
type VirtuosoScroller = Pick<VirtuosoHandle, 'scrollToIndex'>
type LiveScrollBehavior = 'auto' | 'smooth'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function measureLiveScrollViewport(source: ViewportMetricsSource): LiveScrollViewportMeasurement {
  const maxScrollTop = Math.max(0, source.scrollHeight - source.clientHeight)
  const scrollRatio = maxScrollTop > 0
    ? clamp(source.scrollTop / maxScrollTop, 0, 1)
    : 0
  const viewportRatio = source.scrollHeight > 0
    ? clamp(source.clientHeight / source.scrollHeight, 0, 1)
    : 1
  const lensTopPct = clamp(scrollRatio * (1 - viewportRatio), 0, 1 - viewportRatio)
  const bottomRatio = source.scrollHeight > 0
    ? clamp((source.scrollTop + source.clientHeight) / source.scrollHeight, 0, 1)
    : 1

  return {
    scrollTop: source.scrollTop,
    scrollHeight: source.scrollHeight,
    clientHeight: source.clientHeight,
    maxScrollTop,
    bottomDistance: Math.max(0, source.scrollHeight - source.scrollTop - source.clientHeight),
    scrollRatio,
    viewportRatio,
    lensTopPct,
    lensHeightPct: viewportRatio,
    bottomRatio,
  }
}

export function isPinnedToLiveScrollBottom(
  measurement: Pick<LiveScrollViewportMeasurement, 'bottomDistance'>,
  thresholdPx = LIVE_SCROLL_PIN_THRESHOLD_PX,
): boolean {
  return measurement.bottomDistance <= thresholdPx
}

export function deriveLiveScrollWatermarkIndex(
  measurement: Pick<LiveScrollViewportMeasurement, 'bottomRatio'>,
  visibleCount: number,
): number | null {
  if (visibleCount <= 0)
    return null
  return Math.min(visibleCount - 1, Math.floor(measurement.bottomRatio * visibleCount))
}

export function scrollRailMarkerPosition(marker: Pick<ScrollRailMarker, 'visibleIndex' | 'visibleCount'>): number {
  if (marker.visibleCount <= 1)
    return 0
  return marker.visibleIndex / (marker.visibleCount - 1)
}

export function findVisibleIndexForBlockKey(surface: ClassroomLiveViewSurface, blockKey: string): number | null {
  return surface.blockTargetsByKey.get(blockKey)?.visibleIndex ?? null
}

export function findVisibleIndexForExerciseId(surface: ClassroomLiveViewSurface, exerciseId: string): number | null {
  return surface.exerciseTargetsById.get(exerciseId)?.visibleIndex ?? null
}

export function scrollLiveViewportToVisibleIndex({
  viewport,
  virtuoso,
  visibleIndex,
  visibleCount,
  behavior = 'smooth',
}: {
  viewport: HTMLDivElement
  virtuoso: VirtuosoScroller | null
  visibleIndex: number
  visibleCount: number
  behavior?: LiveScrollBehavior
}): boolean {
  if (visibleCount <= 0)
    return false

  const targetIndex = clamp(visibleIndex, 0, visibleCount - 1)
  if (virtuoso) {
    virtuoso.scrollToIndex({ index: targetIndex, align: 'start', behavior })
    return true
  }

  if (visibleCount <= 1) {
    setViewportScrollTop(viewport, 0, behavior)
    return true
  }

  const ratio = targetIndex / (visibleCount - 1)
  setViewportScrollTop(viewport, ratio * (viewport.scrollHeight - viewport.clientHeight), behavior)
  return true
}

export function scrollLiveViewportToBottom({
  viewport,
  virtuoso,
  visibleCount,
  behavior = 'smooth',
}: {
  viewport: HTMLDivElement
  virtuoso: VirtuosoScroller | null
  visibleCount: number
  behavior?: LiveScrollBehavior
}): boolean {
  if (virtuoso && visibleCount > 0) {
    virtuoso.scrollToIndex({ index: visibleCount - 1, align: 'end', behavior })
    return true
  }

  setViewportScrollTop(viewport, viewport.scrollHeight, behavior)
  return true
}

export function focusLatestLiveStreamItem(viewport: HTMLDivElement): boolean {
  const items = viewport.querySelectorAll<HTMLElement>('[data-live-stream-item-id]')
  const latest = items[items.length - 1]
  if (!latest)
    return false
  latest.focus({ preventScroll: true })
  return true
}

export function scrollLiveViewportToBlockKey({
  viewport,
  virtuoso,
  surface,
  blockKey,
  behavior = 'smooth',
}: {
  viewport: HTMLDivElement
  virtuoso: VirtuosoScroller | null
  surface: ClassroomLiveViewSurface
  blockKey: string
  behavior?: LiveScrollBehavior
}): boolean {
  const target = queryChapterAnchor(viewport, blockKey)
  if (target) {
    target.scrollIntoView({ behavior, block: 'start' })
    focusChapterAnchor(target)
    return true
  }

  const visibleIndex = findVisibleIndexForBlockKey(surface, blockKey)
  if (visibleIndex == null)
    return false

  return scrollLiveViewportToVisibleIndex({
    viewport,
    virtuoso,
    visibleIndex,
    visibleCount: surface.visibleCount,
    behavior,
  })
}

export function focusLiveChapterAnchor(viewport: HTMLDivElement, blockKey: string): boolean {
  const target = queryChapterAnchor(viewport, blockKey)
  if (!target)
    return false
  focusChapterAnchor(target)
  return true
}

export function scrollLiveViewportToExerciseId({
  viewport,
  virtuoso,
  surface,
  exerciseId,
  focus = false,
  behavior = 'smooth',
}: {
  viewport: HTMLDivElement
  virtuoso: VirtuosoScroller | null
  surface: ClassroomLiveViewSurface
  exerciseId: string
  focus?: boolean
  behavior?: LiveScrollBehavior
}): boolean {
  const target = queryExerciseAnchor(viewport, exerciseId)
  if (target) {
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior, block: 'start' })
      if (focus)
        focusExerciseAnchor(target)
      return true
    }
  }

  const visibleIndex = findVisibleIndexForExerciseId(surface, exerciseId)
  if (visibleIndex == null)
    return false

  return scrollLiveViewportToVisibleIndex({
    viewport,
    virtuoso,
    visibleIndex,
    visibleCount: surface.visibleCount,
    behavior,
  })
}

export function focusLiveExerciseAnchor(viewport: HTMLDivElement, exerciseId: string): boolean {
  const target = queryExerciseAnchor(viewport, exerciseId)
  if (!target)
    return false
  focusExerciseAnchor(target)
  return true
}

export function scrollLiveViewportToMarker({
  viewport,
  virtuoso,
  surface,
  marker,
  behavior = 'smooth',
}: {
  viewport: HTMLDivElement
  virtuoso: VirtuosoScroller | null
  surface: ClassroomLiveViewSurface
  marker: ScrollRailMarker
  behavior?: LiveScrollBehavior
}): boolean {
  if (marker.blockKey && scrollLiveViewportToBlockKey({ viewport, virtuoso, surface, blockKey: marker.blockKey, behavior }))
    return true

  return scrollLiveViewportToVisibleIndex({
    viewport,
    virtuoso,
    visibleIndex: marker.visibleIndex,
    visibleCount: marker.visibleCount,
    behavior,
  })
}

export function restoreLiveScrollPosition({
  viewport,
  virtuoso,
  surface,
  watermarkIndex,
  activeExerciseId,
}: {
  viewport: HTMLDivElement
  virtuoso: VirtuosoScroller | null
  surface: ClassroomLiveViewSurface
  watermarkIndex: number
  activeExerciseId?: string | null
}): boolean {
  if (activeExerciseId && scrollLiveViewportToExerciseId({
    viewport,
    virtuoso,
    surface,
    exerciseId: activeExerciseId,
    behavior: 'auto',
  })) {
    return true
  }

  const visible = surface.visibleItems
  if (watermarkIndex >= 0 && watermarkIndex < visible.length) {
    const item = visible[watermarkIndex]
    const anchorKey = item.source.type === 'content_reference_group'
      ? item.resolvedBlocks[0]?.blockKey ?? null
      : null
    if (anchorKey) {
      const target = queryChapterAnchor(viewport, anchorKey)
      if (target) {
        target.scrollIntoView({ block: 'start' })
        return true
      }
    }
    return scrollLiveViewportToVisibleIndex({
      viewport,
      virtuoso,
      visibleIndex: watermarkIndex,
      visibleCount: visible.length,
      behavior: 'auto',
    })
  }

  setViewportScrollTop(viewport, viewport.scrollHeight, 'auto')
  return true
}

function setViewportScrollTop(viewport: HTMLDivElement, top: number, behavior: LiveScrollBehavior): void {
  if (behavior === 'smooth' && typeof viewport.scrollTo === 'function') {
    viewport.scrollTo({ top, behavior })
    return
  }
  viewport.scrollTop = top
}

function queryChapterAnchor(viewport: HTMLDivElement, blockKey: string): HTMLElement | null {
  return viewport.querySelector<HTMLElement>(`[data-chapter-id="${escapeCssSelectorString(blockKey)}"]`)
}

function queryExerciseAnchor(viewport: HTMLDivElement, exerciseId: string): HTMLElement | null {
  return viewport.querySelector<HTMLElement>(`[data-exercise-id="${escapeCssSelectorString(exerciseId)}"]`)
}

function focusChapterAnchor(target: HTMLElement): void {
  target.focus({ preventScroll: true })
}

function focusExerciseAnchor(target: HTMLElement): void {
  target.focus({ preventScroll: true })
}

function escapeCssSelectorString(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
    return CSS.escape(value)
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
