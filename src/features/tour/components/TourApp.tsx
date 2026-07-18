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
              <ResizablePanelGroup
                orientation={isDesktop ? 'horizontal' : 'vertical'}
                className="h-full"
              >
                <ResizablePanel
                  id="tour-content-panel"
                  defaultSize={isDesktop ? 38 : 50}
                  minSize={isDesktop ? 25 : 25}
                >
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-auto">
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
                <ResizablePanel
                  id="tour-editor-panel"
                  defaultSize={isDesktop ? 62 : 50}
                  minSize={isDesktop ? 30 : 25}
                >
                  <TourEditor code={code} locale={lang} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        </TourLayout>
      </div>
    </EditorBridgeProvider>
  )
}
