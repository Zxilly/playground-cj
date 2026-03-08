'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TourNavigationProps {
  lang: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  currentIndex: number
  total: number
}

export function TourNavigation({ lang, hasPrev, hasNext, onPrev, onNext, currentIndex, total }: TourNavigationProps) {
  const prevLabel = lang === 'en' ? 'Previous' : String.fromCodePoint(0x4E0A, 0x4E00, 0x9875)
  const nextLabel = lang === 'en' ? 'Next' : String.fromCodePoint(0x4E0B, 0x4E00, 0x9875)

  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-tour-border bg-tour-surface">
      <button
        disabled={!hasPrev}
        onClick={onPrev}
        data-tour-highlight="prev"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-tour-border text-tour-text hover:bg-tour-border/30 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="size-4" />
        {prevLabel}
      </button>
      <span className="text-sm tabular-nums font-medium text-tour-muted">
        {currentIndex + 1}
        <span className="mx-1 text-tour-muted/50">/</span>
        {total}
      </span>
      <button
        disabled={!hasNext}
        onClick={onNext}
        data-tour-highlight="next"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-gradient-to-r from-tour-teal to-tour-teal-light text-white hover:from-tour-teal-hover hover:to-tour-teal disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {nextLabel}
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
