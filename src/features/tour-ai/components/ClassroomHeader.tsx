'use client'

import { useMemo } from 'react'
import { MessageCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { deriveLatestHeading } from '@/lib/ai/classroom/selectors'
import type { ClassroomPhase } from '@/lib/ai/classroom/types'
import { ClassroomThemeToggle } from '@/features/tour-ai/components/ClassroomThemeToggle'

interface ClassroomHeaderProps {
  onOpenChat: () => void
  /** Slot for ClassroomChapterIndex; wired up in Task 7.3. */
  chapterIndex?: React.ReactNode
}

export function ClassroomHeader({ onOpenChat, chapterIndex }: ClassroomHeaderProps) {
  const { session } = useClassroomSession()
  const latestHeading = useMemo(() => deriveLatestHeading(session), [session])
  return (
    <header
      data-testid="ai-classroom-header"
      className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border bg-tour-surface px-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-tour-accent-fg font-mono text-xs font-bold text-white">仓</div>
        <div className="truncate text-sm font-semibold text-tour-text"><Trans>AI 课堂</Trans></div>
        {latestHeading && (
          <span className="truncate text-xs text-muted-foreground">
            ·
            {' '}
            {latestHeading}
          </span>
        )}
        <PhaseBadge phase={session.phase} />
      </div>
      <div className="flex items-center gap-1">
        {chapterIndex}
        <ClassroomThemeToggle />
        <button
          type="button"
          aria-label={t`打开聊天`}
          onClick={onOpenChat}
          className="inline-flex items-center gap-2 rounded-md border border-tour-border bg-tour-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-tour-bg"
        >
          <MessageCircle className="size-4" />
          <Trans>聊天</Trans>
        </button>
      </div>
    </header>
  )
}

function PhaseBadge({ phase }: { phase: ClassroomPhase }) {
  const label = phase === 'orient'
    ? t`导向`
    : phase === 'teach'
      ? t`讲解`
      : t`练习`
  return (
    <span
      data-testid="classroom-phase"
      className="rounded border border-tour-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
    >
      {label}
    </span>
  )
}
