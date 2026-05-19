'use client'

import type { ReactNode, RefObject } from 'react'

interface ClassroomViewportProps {
  viewportRef: RefObject<HTMLDivElement | null>
  children: ReactNode
  /**
   * Slot rendered as an absolutely-positioned sibling of the scroll viewport,
   * intended for chrome that needs to overlay the scroll area without being
   * scrolled with it (e.g. the minimap rail).
   */
  overlay?: ReactNode
}

export function ClassroomViewport({ viewportRef, children, overlay }: ClassroomViewportProps) {
  // Hide the native scrollbar — ClassroomScrollRail provides the same affordance
  // (drag-scrub, lens, click-to-jump) plus semantic markers, and rendering both
  // side-by-side looks like a visual stutter on the right edge.
  // `[&::-webkit-scrollbar]:hidden` covers Blink/WebKit; `scrollbar-width: none`
  // covers Gecko. Both are no-ops when no scrollbar would render in the first
  // place, so the rule is safe on short pages.
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={viewportRef}
        className="h-full overflow-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="mx-auto w-full max-w-[920px] px-6 py-8 pb-20">
          {children}
        </div>
      </div>
      {overlay}
    </div>
  )
}
