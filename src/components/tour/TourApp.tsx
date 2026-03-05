'use client'

import { TourLayout } from './TourLayout'
import { TourSidebar } from './TourSidebar'
import { TourHeader } from './TourHeader'
import { TourContent } from './TourContent'
import { TourEditor } from './TourEditor'
import { TourNavigation } from './TourNavigation'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { isDarkMode } from '@/lib/utils'
import { useMedia } from 'react-use'
import { useCallback, useMemo, useState } from 'react'
import type { TourChapterSlim, FlatSection } from '@/tour/types'
import { getTourBasePath } from '@/hooks/useTourHref'

interface TourAppProps {
  lang: string
  tourData: TourChapterSlim[]
  allSections: FlatSection[]
  initialIndex: number
  isTourDomain: boolean
}

export default function TourApp({ lang, tourData, allSections, initialIndex, isTourDomain }: TourAppProps) {
  const isDesktop = useMedia('(min-width: 1024px)')
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const basePath = getTourBasePath(lang, isTourDomain)

  const section = allSections[currentIndex]

  const navigate = useCallback((index: number) => {
    const target = allSections[index]
    setCurrentIndex(index)
    const url = `${basePath}/${target.chapterId}/${target.subChapterId}/${target.sectionId}`
    window.history.pushState(null, '', url)
  }, [allSections, basePath])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) navigate(currentIndex - 1)
  }, [currentIndex, navigate])

  const goNext = useCallback(() => {
    if (currentIndex < allSections.length - 1) navigate(currentIndex + 1)
  }, [currentIndex, allSections.length, navigate])

  const goToSection = useCallback((chapterId: string, subChapterId: string, sectionId: string) => {
    const idx = allSections.findIndex(
      s => s.chapterId === chapterId && s.subChapterId === subChapterId && s.sectionId === sectionId,
    )
    if (idx !== -1) navigate(idx)
  }, [allSections, navigate])

  const sidebarNav = useMemo(() => ({
    currentChapter: section.chapterId,
    currentSubChapter: section.subChapterId,
    currentSection: section.sectionId,
    onNavigate: goToSection,
  }), [section.chapterId, section.subChapterId, section.sectionId, goToSection])

  const navProps = useMemo(() => ({
    lang,
    hasPrev: currentIndex > 0,
    hasNext: currentIndex < allSections.length - 1,
    onPrev: goPrev,
    onNext: goNext,
    currentIndex,
    total: allSections.length,
  }), [lang, currentIndex, allSections.length, goPrev, goNext])

  return (
    <div className={`h-screen ${isDarkMode() ? 'dark' : ''}`}>
      <TourLayout
        sidebar={
          <TourSidebar
            lang={lang}
            tourData={tourData}
            {...sidebarNav}
          />
        }
      >
        <div className="flex flex-col h-full bg-background text-foreground">
          <TourHeader lang={lang} section={section} />
          <div className="flex-1 min-h-0">
            {isDesktop
              ? (
                  <ResizablePanelGroup orientation="horizontal" className="h-full">
                    <ResizablePanel defaultSize={38} minSize={25}>
                      <div className="flex flex-col h-full">
                        <div className="flex-1 min-h-0">
                          <TourContent lang={lang} section={section} />
                        </div>
                        <TourNavigation {...navProps} />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={62} minSize={30}>
                      <TourEditor code={section.code} locale={lang} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                )
              : (
                  <div className="flex flex-col h-full overflow-auto">
                    <TourContent lang={lang} section={section} />
                    <TourNavigation {...navProps} />
                    <div className="h-[50vh] shrink-0 border-t border-border">
                      <TourEditor code={section.code} locale={lang} />
                    </div>
                  </div>
                )}
          </div>
        </div>
      </TourLayout>
    </div>
  )
}
