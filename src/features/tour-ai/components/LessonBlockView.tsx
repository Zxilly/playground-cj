'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LessonContentBlock, RichText } from '@/lib/ai/classroom/types'
import { RichTextView } from '@/features/tour-ai/components/RichTextView'
import { ShikiCodeBlock } from '@/features/tour-ai/components/ShikiCode'
import { classroomCardVariants, classroomFadeUpVariants, classroomStaggerVariants } from '@/features/tour-ai/components/classroom-motion'

export function LessonBlockView({ block, chapterId }: { block: LessonContentBlock, chapterId?: string }) {
  if (block.type === 'heading') {
    const HeadingTag = block.level === 3 ? motion.h3 : motion.h2
    return (
      <HeadingTag
        layout="position"
        data-chapter-id={chapterId}
        variants={classroomFadeUpVariants}
        className="text-xl font-bold tracking-normal text-tour-heading"
      >
        {block.text}
      </HeadingTag>
    )
  }
  if (block.type === 'paragraph')
    return <motion.p layout="position" variants={classroomFadeUpVariants} className="text-[15px] leading-7"><RichTextView body={block.body} /></motion.p>
  if (block.type === 'concept_card') {
    return (
      <motion.section layout variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface p-4">
        <div className="mb-1 text-xs font-semibold text-tour-link">{block.conceptId}</div>
        <h3 className="mb-2 text-base font-semibold">{block.title}</h3>
        <p className="text-sm leading-7"><RichTextView body={block.body} /></p>
      </motion.section>
    )
  }
  if (block.type === 'code_example') {
    return (
      <motion.section layout variants={classroomFadeUpVariants}>
        {block.title && <div className="mb-2 text-sm font-semibold">{block.title}</div>}
        <ShikiCodeBlock code={block.code} language={block.language} highlights={block.highlights} />
      </motion.section>
    )
  }
  if (block.type === 'callout') {
    return (
      <motion.section layout variants={classroomCardVariants} className={cn('rounded-md border border-tour-border bg-tour-surface p-4', 'text-sm leading-7')}>
        {block.title && <div className="mb-1 font-semibold">{block.title}</div>}
        <RichTextView body={block.body} />
      </motion.section>
    )
  }
  if (block.type === 'steps') {
    return (
      <motion.section layout variants={classroomFadeUpVariants}>
        {block.title && <div className="mb-2 font-semibold">{block.title}</div>}
        <ol className="list-decimal space-y-2 pl-5">
          {block.items.map(item => (
            <li key={`step:${richTextKey(item)}`} className="text-sm leading-7">
              <RichTextView body={item} />
            </li>
          ))}
        </ol>
      </motion.section>
    )
  }
  if (block.type === 'compare') {
    return (
      <motion.section layout variants={classroomStaggerVariants} className="grid gap-3 md:grid-cols-2">
        <motion.div variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface p-4">
          <div className="mb-1 font-semibold">{block.leftTitle}</div>
          <RichTextView body={block.left} />
        </motion.div>
        <motion.div variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface p-4">
          <div className="mb-1 font-semibold">{block.rightTitle}</div>
          <RichTextView body={block.right} />
        </motion.div>
      </motion.section>
    )
  }
  return null
}

function richTextKey(body: RichText): string {
  return body.map((part) => {
    if ('text' in part)
      return `text:${part.text}`
    if ('code' in part)
      return `code:${part.lang ?? part.language ?? 'cangjie'}:${part.code}`
    return `strong:${part.strong}`
  }).join('|')
}
