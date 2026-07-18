'use client'

import { useEffect, useState } from 'react'
import type { CodeSampleBlockProps } from './block-props'
import { CitationList } from './CitationList'
import { TeachInlineMarkdown } from './TeachMarkdown'
import { highlightCangjie } from '@/lib/shiki/cangjie-highlighter'

function isDarkMode(): boolean {
  if (typeof document === 'undefined')
    return false
  return document.documentElement.classList.contains('dark')
}

/**
 * Knowledge block: a read-only Cangjie code sample with an optional plain-text
 * explanation and citations. The code is rendered as plain monospace text first,
 * then upgraded to Shiki-highlighted markup once async highlighting resolves.
 */
export function CodeSampleBlock({ block }: CodeSampleBlockProps) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void highlightCangjie(block.code, { dark: isDarkMode() }).then((result) => {
      if (!cancelled)
        setHtml(result)
    })
    return () => {
      cancelled = true
    }
  }, [block.code])

  return (
    <figure data-testid="code-sample-block" className="my-1">
      <div className="overflow-hidden rounded-md border border-border/60 bg-muted/30">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-1.5 text-xs">
          <span className="font-medium lowercase text-muted-foreground">{block.language}</span>
        </div>
        {html != null
          ? (
              <div
                data-testid="code-sample-code"
                data-language={block.language}
                className="teach-shiki overflow-x-auto p-3 text-xs leading-relaxed [&_pre]:!bg-transparent [&_pre]:font-mono"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )
          : (
              <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
                <code data-testid="code-sample-code" data-language={block.language} className="font-mono">
                  {block.code}
                </code>
              </pre>
            )}
      </div>
      {block.explanation != null && (
        <figcaption
          data-testid="code-sample-explanation"
          className="mt-2 text-sm leading-7 text-muted-foreground"
        >
          <TeachInlineMarkdown markdown={block.explanation} />
        </figcaption>
      )}
      <CitationList citations={block.citations ?? []} />
    </figure>
  )
}
