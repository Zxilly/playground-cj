'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Shared empty/placeholder state for document views. Each view shows this when
 * its document has no content yet (no mission, no terms, no lessons, …) and
 * nudges the learner toward the teacher chat, matching the mission-first /
 * teacher-led spirit of the workspace.
 */
export function ViewEmptyState({
  testId,
  icon: Icon,
  children,
}: {
  testId: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground"
    >
      <Icon aria-hidden="true" className="size-6 text-muted-foreground/70" />
      <p className="max-w-sm leading-6">{children}</p>
    </div>
  )
}
