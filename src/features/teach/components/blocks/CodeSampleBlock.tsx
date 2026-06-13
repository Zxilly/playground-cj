'use client'

import type { CodeSampleBlockProps } from './block-props'
import { CitationList } from './CitationList'

/**
 * Knowledge block: a read-only Cangjie code sample with an optional plain-text
 * explanation and citations. Rendered in a styled monospace block; richer
 * syntax highlighting can layer on later without changing this contract.
 */
export function CodeSampleBlock({ block }: CodeSampleBlockProps) {
  return (
    <figure data-testid="code-sample-block" className="my-1">
      <div className="overflow-hidden rounded-md border border-border/60 bg-muted/30">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-1.5 text-xs">
          <span className="font-medium lowercase text-muted-foreground">{block.language}</span>
        </div>
        <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
          <code data-testid="code-sample-code" data-language={block.language} className="font-mono">
            {block.code}
          </code>
        </pre>
      </div>
      {block.explanation != null && (
        <figcaption
          data-testid="code-sample-explanation"
          className="mt-2 text-sm leading-7 text-muted-foreground"
        >
          {block.explanation}
        </figcaption>
      )}
      <CitationList citations={block.citations ?? []} />
    </figure>
  )
}
