'use client'

import { ChevronDown, ChevronLeft, ChevronRight, Code2 } from 'lucide-react'

interface TourNavigationProps {
  lang: string
  currentIndex: number
  total: number
  onPrev: () => void
  onNext: () => void
  editorToggle?: {
    expanded: boolean
    onToggle: () => void
  }
}

export function TourNavigation({ lang, currentIndex, total, onPrev, onNext, editorToggle }: TourNavigationProps) {
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < total - 1

  const prevLabel = lang === 'en' ? 'Previous' : String.fromCharCode(0x4E0A, 0x4E00, 0x9875)
  const nextLabel = lang === 'en' ? 'Next' : String.fromCharCode(0x4E0B, 0x4E00, 0x9875)

  if (editorToggle) {
    const toggleLabel = lang === 'en'
      ? (editorToggle.expanded ? 'Hide code' : 'Show code')
      : (editorToggle.expanded ? '收起代码' : '展开代码')

    return (
      <nav
        aria-label={lang === 'en' ? 'Lesson controls' : '教程操作'}
        className="shrink-0 border-t border-tour-border bg-tour-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-between">
            <button
              type="button"
              aria-label={prevLabel}
              disabled={!hasPrev}
              onClick={onPrev}
              data-tour-highlight="prev"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tour-text transition-colors hover:bg-tour-border/30 active:bg-tour-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tour-accent-fg disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <span className="whitespace-nowrap px-1 text-xs font-medium tabular-nums text-tour-text">
              {currentIndex + 1}
              <span className="mx-1 opacity-50">/</span>
              {total}
            </span>
            <button
              type="button"
              aria-label={nextLabel}
              disabled={!hasNext}
              onClick={onNext}
              data-tour-highlight="next"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tour-text transition-colors hover:bg-tour-border/30 active:bg-tour-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tour-accent-fg disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-tour-border" />
          <button
            type="button"
            aria-expanded={editorToggle.expanded}
            aria-controls="tour-editor-content"
            onClick={editorToggle.onToggle}
            className="inline-flex min-h-11 w-36 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-tour-text transition-colors hover:bg-tour-border/30 active:bg-tour-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tour-accent-fg"
          >
            <Code2 aria-hidden="true" className="size-4 text-tour-accent-fg" />
            {toggleLabel}
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${editorToggle.expanded ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </nav>
    )
  }

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
