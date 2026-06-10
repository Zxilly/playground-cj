'use client'

import { cn } from '@/lib/utils'
import type { LessonContentBlock, RichText } from '@/lib/ai/classroom/types'
import { MarkdownBody } from '@/features/tour-ai/components/MarkdownBody'
import { RichTextView } from '@/features/tour-ai/components/RichTextView'
import { ShikiCodeBlock } from '@/features/tour-ai/components/ShikiCode'

export function LessonBlockView({ block, chapterId }: { block: LessonContentBlock, chapterId?: string }) {
  if (block.type === 'heading') {
    const HeadingTag = block.level === 3 ? 'h3' : 'h2'
    return (
      <HeadingTag
        data-chapter-id={chapterId}
        tabIndex={chapterId ? -1 : undefined}
        className="text-xl font-bold tracking-normal text-tour-heading focus:outline-none focus:ring-2 focus:ring-tour-link/35 focus:ring-offset-2 focus:ring-offset-tour-bg"
      >
        {block.text}
      </HeadingTag>
    )
  }
  if (block.type === 'paragraph') {
    return (
      <div>
        <MarkdownBody body={block.body} />
      </div>
    )
  }
  if (block.type === 'concept_card') {
    return (
      <section className="rounded-md border border-tour-border bg-tour-surface p-4">
        <h3 className="mb-2 text-base font-semibold">{block.title}</h3>
        <MarkdownBody body={block.body} className="text-sm" />
      </section>
    )
  }
  if (block.type === 'code_example') {
    return (
      <section>
        {block.title && <div className="mb-2 text-sm font-semibold">{block.title}</div>}
        <ShikiCodeBlock code={block.code} language={block.language} highlights={block.highlights} />
      </section>
    )
  }
  if (block.type === 'callout') {
    return (
      <section className={cn('rounded-md border border-tour-border bg-tour-surface p-4')}>
        {block.title && <div className="mb-1 font-semibold">{block.title}</div>}
        <MarkdownBody body={block.body} className="text-sm" />
      </section>
    )
  }
  if (block.type === 'steps') {
    return (
      <section>
        {block.title && <div className="mb-2 font-semibold">{block.title}</div>}
        <ol className="list-decimal space-y-2 pl-5">
          {block.items.map(item => (
            <li key={`step:${richTextKey(item)}`} className="text-sm leading-7">
              <RichTextView body={item} />
            </li>
          ))}
        </ol>
      </section>
    )
  }
  if (block.type === 'compare') {
    return (
      <section className="grid gap-3 md:grid-cols-2">
        <CompareSide title={block.leftTitle} body={block.left} />
        <CompareSide title={block.rightTitle} body={block.right} />
      </section>
    )
  }
  return null
}

function CompareSide({ title, body }: { title: string, body: RichText }) {
  // Compare is mostly used for "X in language A vs language B" side-by-side
  // code views. When the AI sends the side as a single {code} part we render
  // it as a block — RichTextView's inline rendering would collapse the
  // newlines into spaces and drop syntax highlighting visual weight.
  const first = body[0]
  const onlyCode = body.length === 1 && first && first.type === 'code' ? first : null
  return (
    <div className="rounded-md border border-tour-border bg-tour-surface p-4">
      <div className="mb-2 font-semibold">{title}</div>
      {onlyCode
        ? <ShikiCodeBlock code={onlyCode.code} language={onlyCode.lang} />
        : <RichTextView body={body} />}
    </div>
  )
}

function richTextKey(body: RichText): string {
  return body.map((part) => {
    if (part.type === 'text')
      return `text:${part.text}`
    if (part.type === 'code')
      return `code:${part.lang ?? 'cangjie'}:${part.code}`
    return `strong:${part.text}`
  }).join('|')
}
