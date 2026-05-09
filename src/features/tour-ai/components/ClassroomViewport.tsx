'use client'

import type { ReactNode, RefObject } from 'react'

interface ClassroomViewportProps {
  viewportRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

export function ClassroomViewport({ viewportRef, children }: ClassroomViewportProps) {
  return (
    <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-[920px] px-6 py-8 pb-20">
        {children}
      </div>
    </div>
  )
}
