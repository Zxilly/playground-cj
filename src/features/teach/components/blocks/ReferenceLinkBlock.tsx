'use client'

import { FileText } from 'lucide-react'
import type { ReferenceLinkBlockProps } from './block-props'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'

/**
 * Navigation block: an inline link to a reference document (a compressed
 * cheat-sheet). Clicking switches to the reference view and selects the target
 * via the workspace navigation context (`openReference`).
 */
export function ReferenceLinkBlock({ block }: ReferenceLinkBlockProps) {
  const { openReference } = useLessonNavigation()
  return (
    <button
      type="button"
      data-testid="reference-link"
      onClick={() => openReference(block.referenceId)}
      className="group inline-flex w-full items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-start text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-primary/5"
    >
      <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      <span className="min-w-0 flex-1 truncate">{block.label}</span>
    </button>
  )
}
