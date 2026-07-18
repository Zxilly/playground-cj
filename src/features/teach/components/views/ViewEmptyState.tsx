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
      className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground"
    >
      <span className="grid size-10 place-items-center rounded-md border border-border text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="max-w-md text-pretty leading-6">{children}</p>
    </div>
  )
}
