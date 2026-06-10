'use client'

import { useCallback, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { ScrollRailMarker } from '@/features/tour-ai/utils/scroll-rail-markers'
import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { scrollRailMarkerPosition } from '@/features/tour-ai/context/classroom-live-scroll-surface-model'
import { cn } from '@/lib/utils'

// Right-edge "minimap" rail. Items in the stream are projected onto a
// vertical track by their *index ratio* (not pixel position). This is the
// right granularity for a learning timeline: lesson blocks vary wildly in
// height (a 12-line paragraph vs a 500px exercise card), so a pixel-accurate
// minimap would over-weight the visually-tall blocks at the expense of
// short-but-conceptually-important ones (headings, progress updates).
export function ClassroomScrollRail() {
  const {
    markers,
    visibleCount,
    watermarkIndex,
    lens,
    jumpToMarker,
  } = useClassroomLiveScrollSurface()
  const railRef = useRef<HTMLElement>(null)
  const [hoverMarker, setHoverMarker] = useState<ScrollRailMarker | null>(null)
  const [dragMarker, setDragMarker] = useState<ScrollRailMarker | null>(null)
  // Cursor Y inside the rail (px) while dragging; used to anchor the tooltip.
  const [pointerY, setPointerY] = useState<number | null>(null)

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
      const pos = scrollRailMarkerPosition(marker)
      const dist = Math.abs(pos - rel)
      if (dist < bestDist) {
        bestDist = dist
        best = marker
      }
    }
    return best
  }, [markers])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
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

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!railRef.current?.hasPointerCapture(e.pointerId))
      return
    setPointerY(e.clientY)
    const marker = markerAtY(e.clientY)
    setDragMarker(marker)
  }, [markerAtY])

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
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
      ? scrollRailMarkerPosition(tooltipTarget) * (railRect?.height ?? 0)
      : null

  return (
    <nav
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
      aria-label={t`课堂导航`}
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
        <div
          className={cn(
            'pointer-events-none absolute right-full mr-2 max-w-[260px] truncate rounded-md border border-tour-border bg-tour-surface px-2 py-1 text-xs shadow-md',
            dragMarker ? 'font-medium text-tour-text' : 'text-muted-foreground',
          )}
          style={{ top: tooltipTop, transform: 'translateY(-50%)' }}
        >
          {tooltipTarget.label}
        </div>
      )}
    </nav>
  )
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
  const pos = scrollRailMarkerPosition(marker) * 100
  const kind = marker.kind
  const { width, height, shape, tone } = markerStyle(kind)
  const pulsing = marker.attention === 'active_exercise'
  const markerLabel = railMarkerButtonLabel(marker)

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
      aria-label={markerLabel}
      title={markerLabel}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none',
        shape === 'dot' ? 'rounded-full' : 'rounded-sm',
        tone,
        pulsing && 'ring-2 ring-tour-accent-fg/40',
        marker.attention === 'failure_pending' && 'ring-2 ring-destructive/60',
      )}
      style={{ top: `${pos}%`, width, height }}
    />
  )
}

function railMarkerButtonLabel(marker: ScrollRailMarker): string {
  const label = marker.label
  const position = marker.visibleIndex + 1
  const count = marker.visibleCount

  if (marker.attention === 'active_exercise')
    return t`跳转到当前练习：${label}，第 ${position} / ${count} 项`

  if (marker.attention === 'failure_pending')
    return t`跳转到待处理失败：${label}，第 ${position} / ${count} 项`

  return t`跳转到${label}，第 ${position} / ${count} 项`
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
    case 'exercise':
      return { width: 8, height: 8, shape: 'dot', tone: 'bg-tour-accent-fg' }
    case 'progress_success':
      return { width: 6, height: 6, shape: 'dot', tone: 'bg-classroom-success-fg' }
    case 'progress_skip':
      return { width: 5, height: 5, shape: 'dot', tone: 'bg-muted-foreground/70' }
    case 'failure':
      return { width: 7, height: 7, shape: 'dot', tone: 'bg-destructive' }
    case 'generation_error':
      return { width: 7, height: 7, shape: 'dot', tone: 'bg-destructive/70' }
    case 'retained':
      return { width: 6, height: 6, shape: 'dot', tone: 'bg-tour-link' }
  }
}
