'use client'

import { BookA } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { GlossaryRefBlockProps } from './block-props'
import { useGlossary } from '@/features/teach/context/useGlossary'

/**
 * Knowledge block: an inline reference to a glossary term. The definition is
 * resolved from the workspace glossary via context; an unknown term degrades to
 * a non-authoritative placeholder rather than fabricating a definition.
 */
export function GlossaryRefBlock({ block }: GlossaryRefBlockProps) {
  const { lookup } = useGlossary()
  const entry = lookup(block.term)

  if (!entry) {
    return (
      <span
        data-testid="glossary-ref-missing"
        className="inline-flex items-center gap-1 rounded border border-dashed border-border/60 px-1.5 py-0.5 text-sm text-muted-foreground"
      >
        <BookA aria-hidden="true" className="size-3.5" />
        {block.term}
        <span className="text-xs italic">
          <Trans>（暂未收入术语表）</Trans>
        </span>
      </span>
    )
  }

  return (
    <div
      data-testid="glossary-ref"
      className="my-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <BookA aria-hidden="true" className="size-4 text-primary" />
        {entry.term}
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{entry.definition}</p>
      {entry.avoid.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground/80">
          <Trans>避免混用</Trans>
          {': '}
          {entry.avoid.join(', ')}
        </p>
      )}
    </div>
  )
}
