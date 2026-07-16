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
      className="flex flex-col items-center gap-3 rounded-3xl border border-border/70 bg-card/72 px-6 py-12 text-center text-sm text-muted-foreground shadow-[0_18px_55px_-42px_rgba(12,64,51,0.42)]"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-primary/9 text-primary ring-1 ring-primary/10">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="max-w-md text-pretty leading-6">{children}</p>
    </div>
  )
}
