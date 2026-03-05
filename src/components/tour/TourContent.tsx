'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import Markdown from 'react-markdown'
import type { FlatSection } from '@/tour/types'

interface TourContentProps {
  lang: string
  section: FlatSection
}

export function TourContent({ lang, section }: TourContentProps) {
  const raw = section.markdown[lang] || section.markdown.zh || ''
  // Strip the first heading line (duplicated by the h1 above)
  const content = raw.replace(/^#\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])[\r\n]+/, '')

  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6 lg:px-10 lg:py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">
          {section.sectionName[lang] ?? section.sectionName.zh}
        </h1>
        <div className="prose dark:prose-invert max-w-none prose-p:leading-[1.8] prose-p:mb-4 prose-p:text-[15px] prose-headings:tracking-tight prose-h1:text-xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:mb-3 prose-code:before:content-[''] prose-code:after:content-[''] prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-pre:bg-muted/60 prose-pre:border-l-[3px] prose-pre:border-l-primary/40 prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:text-[13px] prose-strong:text-foreground prose-li:text-[15px] prose-li:leading-[1.8]">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </ScrollArea>
  )
}
