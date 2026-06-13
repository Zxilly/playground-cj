'use client'

import { BookA } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'

/**
 * The glossary view: terms the learner has *genuinely mastered*, each with its
 * definition and the phrasings to avoid (so we keep terminology precise). Reads
 * the glossary through the workspace repository. Terms enter the glossary only
 * once mastered, so an empty glossary is the expected starting state.
 */
export function GlossaryView() {
  const { repo } = useWorkspace()
  const { data: glossary, loading } = useWorkspaceResource(() => repo.getGlossary(), [repo], 'glossary')

  if (loading)
    return null

  const terms = glossary?.terms ?? []

  if (terms.length === 0) {
    return (
      <ViewEmptyState testId="glossary-empty" icon={BookA}>
        <Trans>术语表还是空的。当你真正掌握某个术语后，老师会把它收进来。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <ul data-testid="glossary-view" className="flex flex-col gap-3">
      {terms.map(term => (
        <li
          key={term.term}
          data-testid="glossary-term"
          className="rounded-md border border-border/60 bg-card/40 px-4 py-3"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BookA aria-hidden="true" className="size-4 text-primary" />
            {term.term}
            {term.group && (
              <span className="ms-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                {term.group}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{term.definition}</p>
          {term.avoid.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground/80">
              <Trans>避免混用</Trans>
              {': '}
              {term.avoid.join(', ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
