'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import type { RefObject } from 'react'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { useClassroomVirtuosoRef } from '@/features/tour-ai/context/classroom-virtuoso-context'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'
import { deriveScrollRailMarkers, visibleStream } from '@/features/tour-ai/utils/scroll-rail-markers'
import type { ScrollRailMarker } from '@/features/tour-ai/utils/scroll-rail-markers'
import { cn } from '@/lib/utils'

interface ClassroomScrollRailProps {
  /** The scrollable element backing Virtuoso. We read its scrollTop / scrollHeight to position the lens. */
  viewportRef: RefObject<HTMLDivElement | null>
  /** Lang key into the watermark store. */
  lang: string
  /** Whether the page has finished hydrating; used to gate watermark writes. */
  hydrated: boolean
}

// Right-edge "minimap" rail. Items in the stream are projected onto a
// vertical track by their *index ratio* (not pixel position). This is the
// right granularity for a learning timeline: lesson blocks vary wildly in
// height (a 12-line paragraph vs a 500px quiz card), so a pixel-accurate
// minimap would over-weight the visually-tall blocks at the expense of
// short-but-conceptually-important ones (headings, progress updates).
export function ClassroomScrollRail({ viewportRef, lang, hydrated }: ClassroomScrollRailProps) {
  const { session } = useClassroomSession()
  const markers = useMemo(() => deriveScrollRailMarkers(session), [session])
  const visibleCount = useMemo(() => visibleStream(session).length, [session])
  const watermarkIndex = useScrollWatermarkStore(s => s.watermarks[lang] ?? -1)
  const setWatermark = useScrollWatermarkStore(s => s.setWatermark)

  const railRef = useRef<HTMLDivElement>(null)
  const [lens, setLens] = useState<{ top: number, height: number } | null>(null)
  const [hoverMarker, setHoverMarker] = useState<ScrollRailMarker | null>(null)
  const [dragMarker, setDragMarker] = useState<ScrollRailMarker | null>(null)
  // Cursor Y inside the rail (px) while dragging; used to anchor the tooltip.
  const [pointerY, setPointerY] = useState<number | null>(null)

  // Refs back the values that change frequently inside recomputeLensAndWatermark
  // so the useCallback identity stays stable across watermark advances; without
  // this, every scroll-advance would re-create the callback and force the
  // mount effect below to tear down + re-attach the scroll listener and
  // ResizeObserver, which is wasteful during active lesson generation.
  const watermarkIndexRef = useRef(watermarkIndex)
  const visibleCountRef = useRef(visibleCount)
  const hydratedRef = useRef(hydrated)
  watermarkIndexRef.current = watermarkIndex
  visibleCountRef.current = visibleCount
  hydratedRef.current = hydrated

  const recomputeLensAndWatermark = useCallback(() => {
    const el = viewportRef.current
    if (!el)
      return
    const ratio = el.scrollHeight > el.clientHeight
      ? el.scrollTop / (el.scrollHeight - el.clientHeight)
      : 0
    const heightPct = el.scrollHeight > 0
      ? Math.min(1, el.clientHeight / el.scrollHeight)
      : 1
    // The lens spans the proportional viewport, clamped so it can't run off the rail bottom.
    const topPct = Math.max(0, Math.min(1 - heightPct, ratio * (1 - heightPct)))
    // eslint-disable-next-line react/set-state-in-effect -- This callback runs from scroll listeners / RO callbacks outside React effects; the lint rule only sees its first invocation during the post-mount effect setup.
    setLens({ top: topPct * 100, height: heightPct * 100 })

    // Watermark: highest stream index that has crossed into the viewport.
    const vc = visibleCountRef.current
    if (hydratedRef.current && vc > 0) {
      const bottomRatio = Math.min(1, (el.scrollTop + el.clientHeight) / el.scrollHeight)
      const reachedIndex = Math.min(vc - 1, Math.floor(bottomRatio * vc))
      if (reachedIndex > watermarkIndexRef.current)
        setWatermark(lang, reachedIndex)
    }
  }, [lang, setWatermark, viewportRef])

  useEffect(() => {
    const el = viewportRef.current
    if (!el)
      return
    const onScroll = () => recomputeLensAndWatermark()
    el.addEventListener('scroll', onScroll, { passive: true })
    // ResizeObserver picks up cases where Virtuoso item sizes settle after
    // initial paint and the scrollHeight changes without a scroll event.
    // Guarded for envs without RO (jsdom in unit tests): the scroll listener
    // alone still handles the common cases, just not late layout settles.
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => recomputeLensAndWatermark())
      : null
    ro?.observe(el)
    // First read.
    recomputeLensAndWatermark()
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [recomputeLensAndWatermark, viewportRef])

  const virtuosoRef = useClassroomVirtuosoRef()
  const jumpToMarker = useCallback((marker: ScrollRailMarker) => {
    const viewport = viewportRef.current
    if (!viewport)
      return

    // Best path: DOM anchor when the target block is currently rendered. This
    // gives sub-block precision (specifically the heading) instead of just the
    // enclosing stream item.
    if (marker.blockKey) {
      const target = viewport.querySelector(`[data-chapter-id="${CSS.escape(marker.blockKey)}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }

    // Next best: Virtuoso `scrollToIndex` — works for items currently
    // virtualized off-screen, which the DOM `querySelector` above cannot
    // reach. visibleIndex is the index into the visible (run_result-filtered)
    // stream that Virtuoso is rendering.
    const v = virtuosoRef?.current
    if (v) {
      v.scrollToIndex({ index: marker.visibleIndex, align: 'start', behavior: 'smooth' })
      return
    }

    // Last-resort ratio jump. Inaccurate for variable-height items but at
    // least lands "approximately near" the target.
    if (marker.visibleCount <= 1)
      return
    const ratio = marker.visibleIndex / (marker.visibleCount - 1)
    const targetTop = ratio * (viewport.scrollHeight - viewport.clientHeight)
    viewport.scrollTo({ top: targetTop, behavior: 'smooth' })
  }, [viewportRef, virtuosoRef])

  // Translate a pointer Y position on the rail to the nearest marker (used by
  // the drag-scrubbing UX). Returns null when there are no markers at all.
  const markerAtY = useCallback((clientY: number): ScrollRailMarker | null => {
    const rail = railRef.current
    if (!rail || markers.length === 0)
      return null
    const rect = rail.getBoundingClientRect()
    const rel = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    let best: ScrollRailMarker | null = null
    let bestDist = Infinity
    for (const marker of markers) {
      const pos = markerPosition(marker)
      const dist = Math.abs(pos - rel)
      if (dist < bestDist) {
        bestDist = dist
        best = marker
      }
    }
    return best
  }, [markers])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Left-button only; ignore right-clicks / middle-clicks so context menus
    // and middle-scroll still work normally on the rail area.
    if (e.button !== 0)
      return
    const rail = railRef.current
    if (!rail)
      return
    rail.setPointerCapture(e.pointerId)
    setPointerY(e.clientY)
    const marker = markerAtY(e.clientY)
    setDragMarker(marker)
  }, [markerAtY])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!railRef.current?.hasPointerCapture(e.pointerId))
      return
    setPointerY(e.clientY)
    const marker = markerAtY(e.clientY)
    setDragMarker(marker)
  }, [markerAtY])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail?.hasPointerCapture(e.pointerId))
      return
    rail.releasePointerCapture(e.pointerId)
    setPointerY(null)
    const final = dragMarker
    setDragMarker(null)
    if (final)
      jumpToMarker(final)
  }, [dragMarker, jumpToMarker])

  if (visibleCount === 0)
    return null

  const watermarkPct = watermarkIndex >= 0 && visibleCount > 1
    ? (watermarkIndex / (visibleCount - 1)) * 100
    : null

  // Drag tooltip overlay anchors to the rail's right edge, level with the cursor.
  const railRect = railRef.current?.getBoundingClientRect()
  const tooltipTarget = dragMarker ?? hoverMarker
  const tooltipTop = pointerY != null && railRect
    ? pointerY - railRect.top
    : tooltipTarget
      ? markerPosition(tooltipTarget) * (railRect?.height ?? 0)
      : null

  return (
    <div
      ref={railRef}
      data-testid="classroom-scroll-rail"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'absolute right-1 top-0 hidden h-full w-5 cursor-pointer touch-none select-none md:block',
      )}
      style={{ zIndex: 5 }}
      aria-label={t`课堂内容滚动轨`}
      role="scrollbar"
      aria-orientation="vertical"
    >
      {/* Track */}
      <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-tour-border" />

      {/* Lens — current viewport range */}
      {lens && (
        <div
          className="pointer-events-none absolute left-1/2 w-3 -translate-x-1/2 rounded-sm bg-tour-accent-fg/15 ring-1 ring-tour-accent-fg/30"
          style={{ top: `${lens.top}%`, height: `${Math.max(2, lens.height)}%` }}
        />
      )}

      {/* Watermark — "read up to here" line */}
      {watermarkPct != null && (
        <div
          data-testid="classroom-scroll-rail-watermark"
          className="pointer-events-none absolute left-1/2 h-px w-4 -translate-x-1/2 bg-classroom-success-fg/70"
          style={{ top: `${watermarkPct}%` }}
          title={t`你读到这里`}
        />
      )}

      {/* Markers */}
      {markers.map(marker => (
        <RailMarker
          key={marker.id}
          marker={marker}
          onHover={setHoverMarker}
          onLeave={() => setHoverMarker(prev => (prev?.id === marker.id ? null : prev))}
          onClick={jumpToMarker}
        />
      ))}

      {/* Tooltip — used both for hover and drag-scrubbing */}
      {tooltipTarget && tooltipTop != null && (
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'pointer-events-none absolute right-full mr-2 max-w-[260px] truncate rounded-md border border-tour-border bg-tour-surface px-2 py-1 text-xs shadow-md',
            dragMarker ? 'font-medium text-tour-text' : 'text-muted-foreground',
          )}
          style={{ top: tooltipTop, transform: 'translateY(-50%)' }}
        >
          {tooltipTarget.label}
        </motion.div>
      )}
    </div>
  )
}

function markerPosition(marker: ScrollRailMarker): number {
  if (marker.visibleCount <= 1)
    return 0
  return marker.visibleIndex / (marker.visibleCount - 1)
}

function RailMarker({
  marker,
  onHover,
  onLeave,
  onClick,
}: {
  marker: ScrollRailMarker
  onHover: (m: ScrollRailMarker) => void
  onLeave: () => void
  onClick: (m: ScrollRailMarker) => void
}) {
  const pos = markerPosition(marker) * 100
  const kind = marker.kind
  const { width, height, shape, tone } = markerStyle(kind)
  const pulsing = marker.attention === 'active_quiz'

  return (
    <button
      type="button"
      data-testid={`classroom-rail-marker-${kind}`}
      data-attention={marker.attention ?? ''}
      onMouseEnter={() => onHover(marker)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(marker)}
      onBlur={onLeave}
      onClick={(e) => {
        e.stopPropagation()
        onClick(marker)
      }}
      aria-label={marker.label}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 focus:scale-110 focus:outline-none',
        shape === 'dot' ? 'rounded-full' : 'rounded-sm',
        tone,
        pulsing && 'animate-pulse ring-2 ring-tour-accent-fg/40',
        marker.attention === 'failure_pending' && 'ring-2 ring-destructive/60',
      )}
      style={{ top: `${pos}%`, width, height }}
    />
  )
}

function markerStyle(kind: ScrollRailMarker['kind']): {
  width: number
  height: number
  shape: 'tick' | 'dot'
  tone: string
} {
  switch (kind) {
    case 'heading_h2':
      return { width: 14, height: 2, shape: 'tick', tone: 'bg-tour-text' }
    case 'heading_h3':
      return { width: 8, height: 2, shape: 'tick', tone: 'bg-muted-foreground' }
    case 'quiz':
      return { width: 8, height: 8, shape: 'dot', tone: 'bg-tour-accent-fg' }
    case 'progress_success':
      return { width: 6, height: 6, shape: 'dot', tone: 'bg-classroom-success-fg' }
    case 'progress_skip':
      return { width: 5, height: 5, shape: 'dot', tone: 'bg-muted-foreground/70' }
    case 'failure':
      return { width: 7, height: 7, shape: 'dot', tone: 'bg-destructive' }
    case 'generation_error':
      return { width: 7, height: 7, shape: 'dot', tone: 'bg-destructive/70' }
  }
}
