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
  const { data: notes, loading } = useWorkspaceResource(repo, 'notes', () => repo.getNotes(), [repo], 'notes')

  if (loading)
    return null

  const body = notes?.body.trim() ?? ''

  if (body.length === 0) {
    return (
      <ViewEmptyState testId="notes-empty" icon={StickyNote}>
        <Trans>尚无偏好笔记。告知老师你偏好的教学方式后，将记录于此。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <article data-testid="notes-view" className="min-w-0">
      <TeachMarkdown markdown={body} />
    </article>
  )
}
