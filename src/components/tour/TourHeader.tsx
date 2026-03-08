'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Globe } from 'lucide-react'
import Image from 'next/image'
import { LanguagePicker } from './mdx/LanguagePicker'
import { usePathname } from 'next/navigation'
import type { FlatSection } from '@/tour/types'

interface TourHeaderProps {
  lang: string
  section: FlatSection
}

export function TourHeader({ lang, section }: TourHeaderProps) {
  const otherLang = lang === 'en' ? 'zh' : 'en'
  const otherLabel = lang === 'en' ? '中文' : 'EN'
  const pathname = usePathname()

  return (
    <header className="flex h-[50px] shrink-0 items-center gap-2 bg-gradient-to-r from-tour-teal-deep via-tour-teal to-tour-teal-end px-4 text-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
      <SidebarTrigger className="-ml-1 text-white hover:text-white hover:bg-white/10" />
      <Separator orientation="vertical" className="!h-5 !bg-white/30" />
      <a href={`/${lang}`} className="flex items-center shrink-0">
        <Image src="/icon.png" alt="Logo" width={22} height={22} />
      </a>
      <Separator orientation="vertical" className="!h-5 !bg-white/30" />
      <span className="text-[15px] text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">
        {section.chapterName[lang] ?? section.chapterName.zh}
        <span className="mx-1.5 text-white/60">/</span>
        {section.subChapterName[lang] ?? section.subChapterName.zh}
        <span className="mx-1.5 text-white/60">/</span>
        <span className="font-semibold">
          {section.sectionName[lang] ?? section.sectionName.zh}
        </span>
      </span>
      <div className="flex items-center gap-1 ml-auto shrink-0">
        <LanguagePicker />
        <Separator orientation="vertical" className="!h-5 !bg-white/30 mx-1" />
        <a
          href={`/${otherLang}${pathname?.replace(/^\/(en|zh)/, '') || ''}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-white/15 rounded transition-colors"
        >
          <Globe className="size-4" />
          {otherLabel}
        </a>
        <a
          href={`/${lang}`}
          className="inline-flex items-center px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-white/15 rounded transition-colors"
        >
          Playground
        </a>
      </div>
    </header>
  )
}
