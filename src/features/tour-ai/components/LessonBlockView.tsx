import { cn } from '@/lib/utils'
import type { LessonContentBlock } from '@/lib/ai/classroom/types'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'
import { richTextPlainText } from '@/features/tour-ai/utils/classroom-text'
import { RichTextView } from '@/features/tour-ai/components/RichTextView'

export function LessonBlockView({ block }: { block: LessonContentBlock }) {
  if (block.type === 'heading') {
    const HeadingTag = block.level === 3 ? 'h3' : 'h2'
    return <HeadingTag className={aiClassroomStyles.text.heading}>{block.text}</HeadingTag>
  }
  if (block.type === 'paragraph')
    return <p className={aiClassroomStyles.text.paragraph}><RichTextView body={block.body} /></p>
  if (block.type === 'concept_card') {
    return (
      <section className={aiClassroomStyles.surface.card}>
        <div className={cn(aiClassroomStyles.text.status, 'mb-1')}>{block.conceptId}</div>
        <h3 className={cn(aiClassroomStyles.text.titleSmall, 'mb-2 text-base')}>{block.title}</h3>
        <p className={aiClassroomStyles.text.body}><RichTextView body={block.body} /></p>
      </section>
    )
  }
  if (block.type === 'code_example') {
    return (
      <section>
        {block.title && <div className={cn(aiClassroomStyles.text.label, 'mb-2')}>{block.title}</div>}
        <pre className={aiClassroomStyles.code.block}>{block.code}</pre>
      </section>
    )
  }
  if (block.type === 'callout') {
    return (
      <section className={cn(aiClassroomStyles.surface.card, aiClassroomStyles.text.body)}>
        {block.title && <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-1')}>{block.title}</div>}
        <RichTextView body={block.body} />
      </section>
    )
  }
  if (block.type === 'steps') {
    return (
      <section>
        {block.title && <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-2')}>{block.title}</div>}
        <ol className={aiClassroomStyles.stream.steps}>
          {block.items.map(item => (
            <li key={richTextPlainText(item)} className={aiClassroomStyles.text.body}>
              <RichTextView body={item} />
            </li>
          ))}
        </ol>
      </section>
    )
  }
  if (block.type === 'compare') {
    return (
      <section className={aiClassroomStyles.stream.twoColumn}>
        <div className={aiClassroomStyles.surface.card}>
          <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-1')}>{block.leftTitle}</div>
          <RichTextView body={block.left} />
        </div>
        <div className={aiClassroomStyles.surface.card}>
          <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-1')}>{block.rightTitle}</div>
          <RichTextView body={block.right} />
        </div>
      </section>
    )
  }
  return null
}
