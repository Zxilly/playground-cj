import { cn } from '@/lib/utils'
import type { LessonContentBlock } from '@/lib/ai/classroom/types'
import { richTextPlainText } from '@/features/tour-ai/utils/classroom-text'
import { lessonBlockKey } from '@/features/tour-ai/utils/lesson-block-key'
import { RichTextView } from '@/features/tour-ai/components/RichTextView'

export function LessonBlockView({ block }: { block: LessonContentBlock }) {
  if (block.type === 'heading') {
    const HeadingTag = block.level === 3 ? 'h3' : 'h2'
    return (
      <HeadingTag
        data-chapter-key={lessonBlockKey(block)}
        className="text-xl font-bold tracking-normal text-tour-heading"
      >
        {block.text}
      </HeadingTag>
    )
  }
  if (block.type === 'paragraph')
    return <p className="text-[15px] leading-7"><RichTextView body={block.body} /></p>
  if (block.type === 'concept_card') {
    return (
      <section className="rounded-md border border-tour-border bg-tour-surface p-4">
        <div className="mb-1 text-xs font-semibold text-tour-link">{block.conceptId}</div>
        <h3 className="mb-2 text-base font-semibold">{block.title}</h3>
        <p className="text-sm leading-7"><RichTextView body={block.body} /></p>
      </section>
    )
  }
  if (block.type === 'code_example') {
    return (
      <section>
        {block.title && <div className="mb-2 text-sm font-semibold">{block.title}</div>}
        <pre className="overflow-auto rounded-md border border-tour-border bg-tour-bg p-4 font-mono text-sm">{block.code}</pre>
      </section>
    )
  }
  if (block.type === 'callout') {
    return (
      <section className={cn('rounded-md border border-tour-border bg-tour-surface p-4', 'text-sm leading-7')}>
        {block.title && <div className="mb-1 font-semibold">{block.title}</div>}
        <RichTextView body={block.body} />
      </section>
    )
  }
  if (block.type === 'steps') {
    return (
      <section>
        {block.title && <div className="mb-2 font-semibold">{block.title}</div>}
        <ol className="list-decimal space-y-2 pl-5">
          {block.items.map(item => (
            <li key={richTextPlainText(item)} className="text-sm leading-7">
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
        <div className="rounded-md border border-tour-border bg-tour-surface p-4">
          <div className="mb-1 font-semibold">{block.leftTitle}</div>
          <RichTextView body={block.left} />
        </div>
        <div className="rounded-md border border-tour-border bg-tour-surface p-4">
          <div className="mb-1 font-semibold">{block.rightTitle}</div>
          <RichTextView body={block.right} />
        </div>
      </section>
    )
  }
  return null
}
