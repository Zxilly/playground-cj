'use client'

import { TourLayout } from './TourLayout'
import { TourSidebar } from './TourSidebar'
import { TourHeader } from './TourHeader'
import { TourContent } from './TourContent'
import { TourEditor } from './TourEditor'
import { TourNavigation } from './TourNavigation'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useDarkMode } from '@/lib/theme/useDarkMode'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { useMedia } from 'react-use'
import type { FlatSection, TourChapterSlim } from '@/tour/types'
import { getTourPath } from '@/lib/siteHref'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { useTourNavigation } from '@/features/tour/hooks/useTourNavigation'

interface TourAppProps {
  lang: string
  tourData: TourChapterSlim[]
  allSections: FlatSection[]
  initialIndex: number
  isTourDomain: boolean
}

export default function TourApp({ lang, tourData, allSections, initialIndex, isTourDomain }: TourAppProps) {
  const isDesktop = useMedia('(min-width: 1024px)')
  const dark = useDarkMode()
  const basePath = getTourPath(lang, { servingDomain: isTourDomain ? 'tour' : 'playground' })
  const {
    currentIndex,
    currentSection: section,
    goNext,
    goPrev,
    goToSection,
  } = useTourNavigation({ allSections, basePath, initialIndex })

  if (!section)
    return null

  const code = section.code[lang] || section.code.zh || ''

  return (
    <EditorBridgeProvider lang={lang}>
      <div
        className={`h-screen ${dark ? 'dark' : ''}`}
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
    </EditorBridgeProvider>
  )
}
