'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { LanguageSelector } from '@/components/LanguageSelector'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import type { FlatSection } from '@/tour/types'

interface TourHeaderProps {
  lang: string
  section: FlatSection
}

export function TourHeader({ lang, section }: TourHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="!h-4" />
      <a href={`/${lang}`} className="flex items-center gap-2">
        <Image src="/icon.png" alt="Logo" width={20} height={20} />
      </a>
      <span className="text-sm text-muted-foreground truncate">
        {section.chapterName[lang] ?? section.chapterName.zh}
        {' / '}
        {section.subChapterName[lang] ?? section.subChapterName.zh}
        {' / '}
        <span className="text-foreground font-medium">
          {section.sectionName[lang] ?? section.sectionName.zh}
        </span>
      </span>
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <LanguageSelector />
        <Button variant="ghost" size="sm" asChild>
          <a href={`/${lang}`}>
            <ArrowLeft className="size-3.5" />
            Playground
          </a>
        </Button>
      </div>
    </header>
  )
}
