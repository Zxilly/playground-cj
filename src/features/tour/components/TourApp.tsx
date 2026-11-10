'use client'

import { createContext, Suspense, use, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useGroupRef } from 'react-resizable-panels'
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
import { loadEditorRuntime } from '@/lib/monaco/load-editor-runtime'
import { useHydrated } from '@/hooks/useHydrated'
import { lessonDescription, TOUR_ORIGIN } from '@/lib/seo'

const EditorPreviewContext = createContext({ code: '', locale: 'en' })

function PendingTourEditor() {
  const preview = use(EditorPreviewContext)
  return <TourEditorLoading {...preview} />
}

const TourEditor = dynamic(() => loadEditorRuntime(
  'en',
  () => import('./TourEditor').then(module => ({ default: module.TourEditor })),
), { ssr: false, loading: PendingTourEditor })
const ChineseTourEditor = dynamic(() => loadEditorRuntime(
  'zh',
  () => import('./TourEditor').then(module => ({ default: module.TourEditor })),
), { ssr: false, loading: PendingTourEditor })

interface TourAppProps {
  lang: string
  tourData: TourChapterSlim[]
  allSections: FlatSection[]
  initialIndex: number
  isTourDomain: boolean
}

export default function TourApp({ lang, tourData, allSections, initialIndex, isTourDomain }: TourAppProps) {
  const isDesktop = useMedia('(min-width: 1024px)', false)
  const hydrated = useHydrated()
  const isShortMobile = useMedia('(max-width: 1023px) and (max-height: 500px)', false)
  const groupRef = useGroupRef()
  const [mobileEditorExpanded, setMobileEditorExpanded] = useState(true)
  const desktopLayoutRef = useRef({ 'tour-content-panel': 38, 'tour-editor-panel': 62 })
  const mobileLayoutRef = useRef({ 'tour-content-panel': 50, 'tour-editor-panel': 50 })
  const shortMobileLayoutRef = useRef({ 'tour-content-panel': 25, 'tour-editor-panel': 75 })
  const editorHidden = !isDesktop && !mobileEditorExpanded
  const dark = useDarkMode()
  const basePath = getTourPath(lang, { servingDomain: isTourDomain ? 'tour' : 'playground' })
  const {
    currentIndex,
    currentSection: section,
    goNext,
    goPrev,
    goToSection,
  } = useTourNavigation({ allSections, basePath, initialIndex })

  useEffect(() => {
    if (!section)
      return
    const title = section.sectionName[lang] ?? section.sectionName.zh
    document.title = `${title} - ${lang === 'en' ? 'Cangjie Tour' : '仓颉之旅'}`
    document.querySelector('meta[name="description"]')?.setAttribute('content', lessonDescription(section, lang))
    const suffix = `/${section.chapterSlug}/${section.chapterStep}`
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${TOUR_ORIGIN}/${lang}${suffix}`)
    for (const [locale, hreflang] of [['zh', 'zh-CN'], ['en', 'en']])
      document.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`)?.setAttribute('href', `${TOUR_ORIGIN}/${locale}${suffix}`)
  }, [lang, section])

  useEffect(() => {
    // Resize the existing panels: collapsing must retain the editor model,
    // undo history and output. Keep each viewport's expanded layout separately.
    groupRef.current?.setLayout(isDesktop
      ? desktopLayoutRef.current
      : mobileEditorExpanded
        ? isShortMobile ? shortMobileLayoutRef.current : mobileLayoutRef.current
        : { 'tour-content-panel': 100, 'tour-editor-panel': 0 })
  }, [groupRef, isDesktop, isShortMobile, mobileEditorExpanded])

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
              sectionHref={(chapterId, subChapterId, sectionId) => {
                const target = allSections.find(s => s.chapterId === chapterId && s.subChapterId === subChapterId && s.sectionId === sectionId)
                return target ? `${basePath}/${target.chapterSlug}/${target.chapterStep}` : basePath
              }}
            />
          )}
        >
          <div className="flex flex-col h-full bg-background text-foreground">
            <TourHeader lang={lang} section={section} servingDomain={isTourDomain ? 'tour' : 'playground'} />
            <div className="flex-1 min-h-0">
              <ResizablePanelGroup
                groupRef={groupRef}
                orientation={isDesktop ? 'horizontal' : 'vertical'}
                className="h-full"
                onLayoutChanged={(layout, { isUserInteraction }) => {
                  if (!isUserInteraction)
                    return
                  const next = {
                    'tour-content-panel': layout['tour-content-panel'],
                    'tour-editor-panel': layout['tour-editor-panel'],
                  }
                  if (isDesktop) {
                    desktopLayoutRef.current = next
                  }
                  else {
                    const expanded = next['tour-editor-panel'] > 0
                    if (expanded) {
                      if (isShortMobile)
                        shortMobileLayoutRef.current = next
                      else
                        mobileLayoutRef.current = next
                    }
                    setMobileEditorExpanded(expanded)
                  }
                }}
              >
                <ResizablePanel
                  id="tour-content-panel"
                  defaultSize={isDesktop ? 38 : isShortMobile ? 25 : 50}
                  minSize={isDesktop ? 25 : '25%'}
                >
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1">
                      <TourContent lang={lang} section={section} />
                    </div>
                    {isDesktop && (
                      <TourNavigation
                        lang={lang}
                        currentIndex={currentIndex}
                        total={allSections.length}
                        prevHref={allSections[currentIndex - 1] && `${basePath}/${allSections[currentIndex - 1].chapterSlug}/${allSections[currentIndex - 1].chapterStep}`}
                        nextHref={allSections[currentIndex + 1] && `${basePath}/${allSections[currentIndex + 1].chapterSlug}/${allSections[currentIndex + 1].chapterStep}`}
                        onPrev={goPrev}
                        onNext={goNext}
                      />
                    )}
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle disabled={editorHidden} className={editorHidden ? 'hidden' : 'bg-tour-border/80'} />
                <ResizablePanel
                  id="tour-editor-panel"
                  defaultSize={isDesktop ? 62 : isShortMobile ? 75 : 50}
                  minSize={isDesktop ? 30 : '25%'}
                  collapsible={!isDesktop}
                  collapsedSize="0%"
                >
                  <div id="tour-editor-content" className="h-full min-h-0 overflow-hidden" inert={editorHidden} aria-hidden={editorHidden}>
                    <EditorPreviewContext value={{ code, locale: lang }}>
                      <Suspense fallback={<TourEditorLoading code={code} locale={lang} />}>
                        {hydrated
                          ? <Editor code={code} locale={lang} sectionKey={`${section.chapterId}/${section.subChapterId}/${section.sectionId}`} />
                          : <TourEditorLoading code={code} locale={lang} />}
                      </Suspense>
                    </EditorPreviewContext>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
            {!isDesktop && (
              <TourNavigation
                lang={lang}
                currentIndex={currentIndex}
                total={allSections.length}
                prevHref={allSections[currentIndex - 1] && `${basePath}/${allSections[currentIndex - 1].chapterSlug}/${allSections[currentIndex - 1].chapterStep}`}
                nextHref={allSections[currentIndex + 1] && `${basePath}/${allSections[currentIndex + 1].chapterSlug}/${allSections[currentIndex + 1].chapterStep}`}
                onPrev={goPrev}
                onNext={goNext}
                editorToggle={{
                  expanded: mobileEditorExpanded,
                  onToggle: () => setMobileEditorExpanded(expanded => !expanded),
                }}
              />
            )}
          </div>
        </TourLayout>
      </div>
    </EditorBridgeProvider>
  )
}
