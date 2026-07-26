'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CoreContentBlock, CourseContentPack } from '@/lib/teach/classroom/content-packs'
import { TeachMarkdown } from '@/features/teach/components/blocks/TeachMarkdown'
import { highlightCangjie } from '@/lib/shiki/cangjie-highlighter'
import { cn } from '@/lib/utils'
import { useRootDarkMode } from '@/lib/theme/useRootDarkMode'

function CodeBlock({ block }: { block: Extract<CoreContentBlock, { type: 'code_sample' }> }) {
  const [highlight, setHighlight] = useState<{
    key: string
    html: string
  } | null>(null)
  const dark = useRootDarkMode()
  const highlightKey = `${dark ? 'dark' : 'light'}\0${block.code}`

  useEffect(() => {
    let active = true
    void highlightCangjie(block.code, { dark }).then((value) => {
      if (active)
        setHighlight({ key: highlightKey, html: value })
    })
    return () => {
      active = false
    }
  }, [block.code, dark, highlightKey])

  const html = highlight?.key === highlightKey ? highlight.html : null

  return (
    <figure className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
      <figcaption className="border-b border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        Cangjie
      </figcaption>
      {html
        ? (
            <div
              className="teach-shiki overflow-x-auto p-3 text-xs leading-6 [&_pre]:!bg-transparent [&_pre]:font-mono"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        : (
            <pre className="overflow-x-auto p-3 text-xs leading-6">
              <code>{block.code}</code>
            </pre>
          )}
      {block.explanation && (
        <div className="border-t border-border/60 px-3 py-2 text-sm text-muted-foreground">
          <TeachMarkdown markdown={block.explanation} source="validated" />
        </div>
      )}
    </figure>
  )
}

export function CoreContent({
  block,
  exposure,
  showSource = true,
}: {
  block: CoreContentBlock
  exposure?: 'seen' | 'skipped' | 'unseen'
  showSource?: boolean
}) {
  return (
    <article
      data-core-content-id={block.id}
      className={cn(
        'space-y-3 rounded-lg border border-border bg-card p-4',
        exposure === 'unseen' && 'border-dashed opacity-75',
      )}
    >
      {exposure && (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {exposure}
        </p>
      )}
      {block.type === 'prose'
        ? <TeachMarkdown markdown={block.markdown} source="validated" />
        : <CodeBlock block={block} />}
      {showSource && (
        <ul aria-label="Source References" className="space-y-1 border-t border-border/60 pt-2">
          {block.sourceReferences.map(source => (
            <li key={`${source.sourceId}:${source.ref}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ExternalLink aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              <span>
                {source.title}
                {' · '}
                {source.ref}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function ContentReferenceGroup({
  blockIds,
  pack,
}: {
  blockIds: string[]
  pack: CourseContentPack
}) {
  const blocks = new Map(pack.blocks.map(block => [block.id, block]))
  return (
    <div className="space-y-3">
      {blockIds.map((blockId) => {
        const block = blocks.get(blockId)
        return block
          ? <CoreContent key={blockId} block={block} showSource />
          : (
              <p key={blockId} role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                Missing historical Core Content Block:
                {' '}
                {blockId}
              </p>
            )
      })}
    </div>
  )
}
