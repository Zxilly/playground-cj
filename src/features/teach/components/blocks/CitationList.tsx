'use client'

import { BookMarked } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { Citation } from '@/lib/teach/lessons/blocks'
import { cn } from '@/lib/utils'

/**
 * Renders a block's inline citations as a compact source list. Citations point
 * at concrete entries inside a `KnowledgeSource` (e.g. the Cangjie MCP) rather
 * than external community links; we show source + ref + title so the learner
 * can trace any factual claim back to its grounded origin.
 */
export function CitationList({ citations, className }: { citations: Citation[], className?: string }) {
  if (citations.length === 0)
    return null

  return (
    <ul
      data-testid="block-citation-list"
      className={cn('mt-2 flex flex-col gap-1 border-t border-border/40 pt-2', className)}
    >
      {citations.map(citation => (
        <li
          key={`${citation.sourceId}:${citation.ref}:${citation.title}`}
          data-testid="block-citation"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <BookMarked aria-hidden="true" className="size-3 shrink-0" />
          <span className="font-medium text-foreground/80">{citation.title}</span>
          <span className="text-muted-foreground/70">
            <Trans>来源</Trans>
            {' · '}
            {citation.ref}
          </span>
        </li>
      ))}
    </ul>
  )
}
