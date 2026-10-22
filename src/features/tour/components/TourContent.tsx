'use client'

import { lazy, Suspense } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MDXRemote } from 'next-mdx-remote'
import { tourMdxComponents } from './mdx'
import type { FlatSection } from '@/tour/types'

const HEADING_RE = /^#\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])[\r\n]+/
const Markdown = lazy(() => import('react-markdown'))

interface TourContentProps {
  lang: string
  section: FlatSection
}

export function TourContent({ lang, section }: TourContentProps) {
  const source = section.mdxSource?.[lang] || section.mdxSource?.zh

  return (
    <ScrollArea key={`${section.chapterId}/${section.subChapterId}/${section.sectionId}`} className="h-full bg-tour-bg">
      <div className="px-5 py-5 sm:px-8 sm:py-6 lg:px-10 lg:py-8">
        <h1 className="text-[1.4rem] font-bold mb-4 text-tour-heading">
          {section.sectionName[lang] ?? section.sectionName.zh}
        </h1>
        <div className="prose dark:prose-invert max-w-[750px] tour-prose">
          {source
            ? <MDXRemote {...source} components={tourMdxComponents} />
            : (
                <Suspense fallback={<p role="status">{lang === 'en' ? 'Loading lesson…' : '正在加载章节…'}</p>}>
                  <Markdown>{(section.markdown[lang] || section.markdown.zh || '').replace(HEADING_RE, '')}</Markdown>
                </Suspense>
              )}
        </div>
      </div>
    </ScrollArea>
  )
}
