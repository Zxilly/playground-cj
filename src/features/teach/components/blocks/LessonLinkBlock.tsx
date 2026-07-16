'use client'

import { ArrowRight } from 'lucide-react'
import type { LessonLinkBlockProps } from './block-props'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'

/**
 * Navigation block: an inline link to another lesson. Clicking switches the
 * central viewport to the linked lesson via the workspace navigation context
 * (`selectLesson`). Lessons can be inter-linked to weave a learning path while
 * keeping each unit short and single-takeaway.
 */
export function LessonLinkBlock({ block }: LessonLinkBlockProps) {
  const { selectLesson } = useLessonNavigation()
  return (
    <button
      type="button"
      data-testid="lesson-link"
      onClick={() => selectLesson(block.lessonId)}
      className="group inline-flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-start text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-muted"
    >
      <span className="min-w-0 flex-1 truncate">{block.label}</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  )
}
