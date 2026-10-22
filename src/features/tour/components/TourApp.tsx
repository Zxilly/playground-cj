'use client'

import { lazy, Suspense } from 'react'
import { TourLayout } from './TourLayout'
import { TourSidebar } from './TourSidebar'
import { TourHeader } from './TourHeader'
import { TourContent } from './TourContent'
import { TourNavigation } from './TourNavigation'
import { TourEditorLoading } from './TourEditorLoading'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useDarkMode } from '@/lib/theme/useDarkMode'
import { fontFamily, uiFontFamily } from '@/app/font'
import { useMedia } from 'react-use'
import type { FlatSection, TourChapterSlim } from '@/tour/types'
import { getTourPath } from '@/lib/siteHref'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { useTourNavigation } from '@/features/tour/hooks/useTourNavigation'

const TourEditor = lazy(() => import('./TourEditor').then(module => ({ default: module.TourEditor })))
const ChineseTourEditor = lazy(() => import('@/lib/monaco/localization').then(
  () => import('./TourEditor').then(module => ({ default: module.TourEditor })),
))

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
  const Editor = lang === 'zh' ? ChineseTourEditor : TourEditor

  return (
    <EditorBridgeProvider lang={lang}>
      <div
        className={`h-dvh ${dark ? 'dark' : ''}`}
        style={{
          'fontFamily': uiFontFamily,
          '--tour-code-font': fontFamily,
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
                    <div className="min-h-0 flex-1">
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
                  <Suspense fallback={<TourEditorLoading code={code} locale={lang} />}>
                    <Editor code={code} locale={lang} />
                  </Suspense>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        </TourLayout>
      </div>
    </EditorBridgeProvider>
  )
}
