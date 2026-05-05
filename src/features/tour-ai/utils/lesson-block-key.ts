import type { LessonContentBlock } from '@/lib/ai/classroom/types'
import { richTextPlainText } from '@/features/tour-ai/utils/classroom-text'

export function lessonBlockKey(block: LessonContentBlock): string {
  if (block.type === 'heading')
    return `heading:${block.text}`
  if (block.type === 'paragraph')
    return `paragraph:${richTextPlainText(block.body)}`
  if (block.type === 'concept_card')
    return `concept:${block.conceptId}:${block.title}`
  if (block.type === 'code_example')
    return `code:${block.title ?? ''}:${block.code.slice(0, 80)}`
  if (block.type === 'callout')
    return `callout:${block.tone}:${block.title ?? ''}:${richTextPlainText(block.body)}`
  if (block.type === 'steps')
    return `steps:${block.title ?? ''}:${block.items.map(richTextPlainText).join('|')}`
  if (block.type === 'compare')
    return `compare:${block.leftTitle}:${block.rightTitle}`
  return `quiz:${block.conceptId}:${richTextPlainText(block.prompt)}`
}
