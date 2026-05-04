'use client'

import { TourLayout } from './TourLayout'
import { TourSidebar } from './TourSidebar'
import { TourHeader } from './TourHeader'
import { TourContent } from './TourContent'
import { TourEditor } from './TourEditor'
import { TourNavigation } from './TourNavigation'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { isDarkMode } from '@/lib/utils'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { useMedia } from 'react-use'
import { useCallback, useEffect, useState } from 'react'
import type { FlatSection, TourChapterSlim } from '@/tour/types'
import { getTourPath } from '@/lib/siteHref'
import { TourBridgeProvider } from './EditorBridgeContext'

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
  const basePath = getTourPath(lang, { servingDomain: isTourDomain ? 'tour' : 'playground' })

  const section = allSections[currentIndex]

  const navigate = useCallback((index: number) => {
    const target = allSections[index]
    if (!target)
      return
    setCurrentIndex(index)
    window.history.pushState(null, '', `${basePath}/${target.chapterSlug}/${target.chapterStep}`)
  }, [allSections, basePath])

  const goPrev = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx <= 0)
        return idx
      const target = allSections[idx - 1]
      if (target)
        window.history.pushState(null, '', `${basePath}/${target.chapterSlug}/${target.chapterStep}`)
      return idx - 1
    })
  }, [allSections, basePath])

  const goNext = useCallback(() => {
    setCurrentIndex((idx) => {
      if (idx >= allSections.length - 1)
        return idx
      const target = allSections[idx + 1]
      if (target)
        window.history.pushState(null, '', `${basePath}/${target.chapterSlug}/${target.chapterStep}`)
      return idx + 1
    })
  }, [allSections, basePath])

  const goToSection = useCallback((chapterId: string, subChapterId: string, sectionId: string) => {
    const idx = allSections.findIndex(
      s => s.chapterId === chapterId && s.subChapterId === subChapterId && s.sectionId === sectionId,
    )
    if (idx !== -1)
      navigate(idx)
  }, [allSections, navigate])

  useEffect(() => {
    const isInsideTourEditor = (e: KeyboardEvent): boolean => {
      for (const node of e.composedPath()) {
        if (node instanceof Element && node.hasAttribute('data-tour-editor-root'))
          return true
      }
      return false
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'PageDown' && e.key !== 'PageUp')
        return
      if (isInsideTourEditor(e))
        return
      if (e.key === 'PageDown') {
        e.preventDefault()
        goNext()
      }
      else {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev])

  if (!section)
    return null

  const code = section.code[lang] || section.code.zh || ''

  return (
    <TourBridgeProvider lang={lang}>
      <div
        className={`h-screen ${isDarkMode() ? 'dark' : ''}`}
        style={{
          'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
          '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
        } as React.CSSProperties}
      >
        <TourLayout
          sidebar={(
            <TourSidebar
              lang={lang}
              tourData={tourData}
              currentChapter={section.chapterId}
              currentSubChapter={section.subChapterId}
              currentSection={section.sectionId}
              onNavigate={goToSection}
            />
          )}
        >
          <div className="flex flex-col h-full bg-background text-foreground">
            <TourHeader lang={lang} section={section} />
            <div className="flex-1 min-h-0 pt-1">
              {isDesktop
                ? (
                    <ResizablePanelGroup orientation="horizontal" className="h-full">
                      <ResizablePanel defaultSize={38} minSize={25}>
                        <div className="flex flex-col h-full">
                          <div className="flex-1 min-h-0">
                            <TourContent lang={lang} section={section} />
                          </div>
                          <TourNavigation
                            lang={lang}
                            currentIndex={currentIndex}
                            total={allSections.length}
                            onPrev={goPrev}
                            onNext={goNext}
                          />
                        </div>
                      </ResizablePanel>
                      <ResizableHandle withHandle className="bg-tour-border/80" />
                      <ResizablePanel defaultSize={62} minSize={30}>
                        <TourEditor code={code} locale={lang} />
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  )
                : (
                    <div className="flex flex-col h-full overflow-auto">
                      <TourContent lang={lang} section={section} />
                      <TourNavigation
                        lang={lang}
                        currentIndex={currentIndex}
                        total={allSections.length}
                        onPrev={goPrev}
                        onNext={goNext}
                      />
                      <div className="h-[50vh] shrink-0 border-t border-border">
                        <TourEditor code={code} locale={lang} />
                      </div>
                    </div>
                  )}
            </div>
          </div>
        </TourLayout>
      </div>
    </TourBridgeProvider>
  )
}
