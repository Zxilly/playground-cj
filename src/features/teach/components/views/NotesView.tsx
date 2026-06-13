'use client'

import { StickyNote } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { TeachMarkdown } from '@/features/teach/components/blocks/TeachMarkdown'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'

/**
 * The notes view: the learner's free-form teaching-preference notes (how they
 * like to be taught). Rendered as markdown via {@link TeachMarkdown}. Reads the
 * notes through the workspace repository; a blank body shows an empty state.
 */
export function NotesView() {
  const { repo } = useWorkspace()
  const { data: notes, loading } = useWorkspaceResource(() => repo.getNotes(), [repo])

  if (loading)
    return null

  const body = notes?.body.trim() ?? ''

  if (body.length === 0) {
    return (
      <ViewEmptyState testId="notes-empty" icon={StickyNote}>
        <Trans>还没有偏好笔记。告诉老师你喜欢怎样的教学方式，会记录在这里。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <article data-testid="notes-view" className="rounded-md border border-border/60 bg-card/40 px-4 py-3">
      <TeachMarkdown markdown={body} />
    </article>
  )
}
