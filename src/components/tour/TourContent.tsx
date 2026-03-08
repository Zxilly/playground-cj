'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { MDXRemote } from 'next-mdx-remote'
import Markdown from 'react-markdown'
import { tourMdxComponents } from './mdx'
import type { FlatSection } from '@/tour/types'

interface TourContentProps {
  lang: string
  section: FlatSection
}

export function TourContent({ lang, section }: TourContentProps) {
  const source = section.mdxSource?.[lang] || section.mdxSource?.zh

  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6 lg:px-10 lg:py-8 bg-tour-bg">
        <h1 className="text-[1.4rem] font-bold mb-4 text-tour-heading">
          {section.sectionName[lang] ?? section.sectionName.zh}
        </h1>
        <div className="prose dark:prose-invert max-w-[750px] tour-prose">
          {source
            ? <MDXRemote {...source} components={tourMdxComponents} />
            : <Markdown>{(section.markdown[lang] || section.markdown.zh || '').replace(/^#\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])[\r\n]+/, '')}</Markdown>}
        </div>
      </div>
    </ScrollArea>
  )
}
