'use client'

import type { ProseBlockProps } from './block-props'
import { TeachMarkdown } from './TeachMarkdown'
import { CitationList } from './CitationList'

/**
 * Knowledge block: a paragraph of markdown prose with optional inline
 * citations back to the grounding source.
 */
export function ProseBlock({ block }: ProseBlockProps) {
  return (
    <div data-testid="prose-block" className="text-foreground">
      <TeachMarkdown markdown={block.markdown} />
      <CitationList citations={block.citations ?? []} />
    </div>
  )
}
