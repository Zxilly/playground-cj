'use client'

import type { MouseEvent, ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Code2, Sparkles, Terminal } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'

interface TourNavigationProps {
  lang?: string
  currentIndex: number
  total: number
  onPrev: () => void
  onNext: () => void
  prevHref?: string
  nextHref?: string
  aiHref?: string
  playgroundHref?: string
  editorToggle?: {
    expanded: boolean
    onToggle: () => void
  }
}

interface NavActionProps {
  href?: string
  disabled: boolean
  ariaLabel?: string
  highlightTarget: 'prev' | 'next'
  className: string
  onNavigate: () => void
  children: ReactNode
}

function NavAction({
  href,
  disabled,
  ariaLabel,
  highlightTarget,
  className,
  onNavigate,
  children,
}: NavActionProps) {
  const handleClick = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onNavigate()
  }

  if (href && !disabled) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        onClick={handleClick}
        data-tour-highlight={highlightTarget}
        className={className}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      data-tour-highlight={highlightTarget}
      className={className}
    >
      {children}
    </button>
  )
}

export function TourNavigation({
  currentIndex,
  total,
  onPrev,
  onNext,
  editorToggle,
  prevHref,
  nextHref,
  aiHref,
  playgroundHref,
}: TourNavigationProps) {
  const { t } = useLingui()
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < total - 1
  const isLastLesson = total > 0 && !hasNext
  const showCompletionCta = isLastLesson && Boolean(aiHref || playgroundHref)

  const prevLabel = t`上一页`
  const nextLabel = t`下一页`
  const lessonNumber = currentIndex + 1
  const progressLabel = t`第 ${lessonNumber} 节，共 ${total} 节`
  const aiCtaLabel = t`AI 课堂`
  const playgroundCtaLabel = 'Playground'
  const completionPrompt = t`已完成全部教程！继续实践：`
  const navAriaLabel = t`教程操作`

  if (editorToggle) {
    const toggleLabel = editorToggle.expanded ? t`收起代码` : t`展开代码`

    return (
      <nav
        aria-label={navAriaLabel}
        className="shrink-0 border-t border-tour-border bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {showCompletionCta && (
          <div className="mx-auto mb-2 flex w-full max-w-xl flex-wrap items-center justify-between gap-2 rounded-md border border-tour-border bg-tour-surface px-3 py-2 text-xs">
            <span className="font-medium text-tour-heading">{completionPrompt}</span>
            <div className="flex items-center gap-2">
              {aiHref && (
                <a
                  href={aiHref}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md bg-brand px-2.5 py-1 font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  {aiCtaLabel}
                </a>
              )}
              {playgroundHref && (
                <a
                  href={playgroundHref}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-tour-border bg-background px-2.5 py-1 font-medium text-tour-text transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Terminal aria-hidden="true" className="size-3.5" />
                  {playgroundCtaLabel}
                </a>
              )}
            </div>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-between">
            <NavAction
              href={prevHref}
              disabled={!hasPrev}
              ariaLabel={prevLabel}
              highlightTarget="prev"
              onNavigate={onPrev}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tour-text transition-colors hover:bg-tour-border/30 active:bg-tour-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tour-accent-fg disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </NavAction>
            <span aria-label={progressLabel} className="whitespace-nowrap px-1 text-xs font-medium tabular-nums text-tour-text">
              {currentIndex + 1}
              <span className="mx-1 opacity-50">/</span>
              {total}
            </span>
            <NavAction
              href={nextHref}
              disabled={!hasNext}
              ariaLabel={nextLabel}
              highlightTarget="next"
              onNavigate={onNext}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tour-text transition-colors hover:bg-tour-border/30 active:bg-tour-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tour-accent-fg disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </NavAction>
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
    <nav aria-label={navAriaLabel} className="shrink-0 border-t border-tour-border bg-background">
      {showCompletionCta && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tour-border bg-tour-surface px-6 py-2.5 text-sm">
          <span className="font-medium text-tour-heading">{completionPrompt}</span>
          <div className="flex items-center gap-2">
            {aiHref && (
              <a
                href={aiHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Sparkles aria-hidden="true" className="size-3.5" />
                {aiCtaLabel}
              </a>
            )}
            {playgroundHref && (
              <a
                href={playgroundHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-tour-border bg-background px-3 py-1.5 text-xs font-medium text-tour-text transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Terminal aria-hidden="true" className="size-3.5" />
                {playgroundCtaLabel}
              </a>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <NavAction
          href={prevHref}
          disabled={!hasPrev}
          highlightTarget="prev"
          onNavigate={onPrev}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-tour-border px-4 py-2 text-sm font-medium text-tour-text transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {prevLabel}
        </NavAction>
        <span aria-label={progressLabel} className="whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground">
          {currentIndex + 1}
          <span className="mx-1">/</span>
          {total}
        </span>
        <NavAction
          href={nextHref}
          disabled={!hasNext}
          highlightTarget="next"
          onNavigate={onNext}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-35"
        >
          {nextLabel}
          <ChevronRight aria-hidden="true" className="size-4" />
        </NavAction>
      </div>
    </nav>
  )
}
