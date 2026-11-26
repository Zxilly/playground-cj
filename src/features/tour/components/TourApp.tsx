'use client'

import { createContext, Suspense, use, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useGroupRef } from 'react-resizable-panels'
import { History, X } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { TourLayout } from './TourLayout'
import { TourSidebar } from './TourSidebar'
import { TourHeader } from './TourHeader'
import { TourContent } from './TourContent'
import { TourNavigation } from './TourNavigation'
import { TourEditorLoading } from './TourEditorLoading'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { fontFamily, uiFontFamily } from '@/app/font'
import { useMedia } from 'react-use'
import type { FlatSection, TourChapterSlim } from '@/tour/types'
import { getPlaygroundHref, getTourAIHref, getTourPath } from '@/lib/siteHref'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { useTourNavigation } from '@/features/tour/hooks/useTourNavigation'
import { loadEditorRuntime } from '@/lib/monaco/load-editor-runtime'
import { useHydrated } from '@/hooks/useHydrated'
import { lessonDescription, PLAYGROUND_ORIGIN, TOUR_ORIGIN } from '@/lib/seo'
import { buildTourSectionKey, useTourProgressStore } from '@/stores/tourProgress'
import type { TourLastVisited } from '@/stores/tourProgress'

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
  const { t } = useLingui()
  const isDesktop = useMedia('(min-width: 1024px)', false)
  const hydrated = useHydrated()
  const isShortMobile = useMedia('(max-width: 1023px) and (max-height: 500px)', false)
  const groupRef = useGroupRef()
  const [mobileEditorExpanded, setMobileEditorExpanded] = useState(true)
  const [resumeTarget, setResumeTarget] = useState<TourLastVisited | null>(null)
  const resumeCheckedRef = useRef(false)
  const desktopLayoutRef = useRef({ 'tour-content-panel': 38, 'tour-editor-panel': 62 })
  const mobileLayoutRef = useRef({ 'tour-content-panel': 50, 'tour-editor-panel': 50 })
  const shortMobileLayoutRef = useRef({ 'tour-content-panel': 25, 'tour-editor-panel': 75 })
  const editorHidden = !isDesktop && !mobileEditorExpanded
  const servingDomain = isTourDomain ? 'tour' : 'playground'
  const basePath = getTourPath(lang, { servingDomain })
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
    document.title = `${title} - ${t`仓颉之旅`}`
    document.querySelector('meta[name="description"]')?.setAttribute('content', lessonDescription(section, lang))
    const suffix = `/${section.chapterSlug}/${section.chapterStep}`
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${TOUR_ORIGIN}/${lang}${suffix}`)
    for (const [locale, hreflang] of [['zh', 'zh-CN'], ['en', 'en']])
      document.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`)?.setAttribute('href', `${TOUR_ORIGIN}/${locale}${suffix}`)
  }, [lang, section, t])

  useEffect(() => {
    if (!section)
      return
    const progressStore = useTourProgressStore.getState()
    const restored = progressStore.hydrate()
    const currentKey = buildTourSectionKey(section.chapterId, section.subChapterId, section.sectionId)

    if (!resumeCheckedRef.current) {
      resumeCheckedRef.current = true
      if (
        initialIndex === 0
        && restored.lastVisited
        && restored.lastVisited.sectionKey !== currentKey
        && allSections.some(
          item => buildTourSectionKey(item.chapterId, item.subChapterId, item.sectionId) === restored.lastVisited?.sectionKey,
        )
      ) {
        setResumeTarget(restored.lastVisited)
      }
    }

    progressStore.markVisited({
      sectionKey: currentKey,
      chapterId: section.chapterId,
      subChapterId: section.subChapterId,
      sectionId: section.sectionId,
      chapterSlug: section.chapterSlug,
      chapterStep: section.chapterStep,
      title: section.sectionName,
    })
  }, [allSections, initialIndex, section])

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
  const currentOrigin = hydrated
    ? window.location.origin
    : isTourDomain
      ? TOUR_ORIGIN
      : PLAYGROUND_ORIGIN
  const aiHref = getTourAIHref(lang, {
    currentOrigin,
    servingDomain,
    topic: section.chapterSlug,
  })
  const playgroundHref = getPlaygroundHref(lang, { currentOrigin })
  const resumeTitle = resumeTarget?.title?.[lang] ?? resumeTarget?.title?.zh ?? resumeTarget?.chapterSlug
  const showResumeBanner = hydrated && resumeTarget !== null && resumeTarget.sectionKey !== buildTourSectionKey(section.chapterId, section.subChapterId, section.sectionId)

  return (
    <EditorBridgeProvider lang={lang}>
      <div
        className="h-dvh"
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
          <div className="flex h-full flex-col bg-background text-foreground">
            <TourHeader lang={lang} section={section} servingDomain={servingDomain} />
            <div className="min-h-0 flex-1">
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
                  defaultSize={isDesktop ? '38%' : isShortMobile ? '25%' : '50%'}
                  minSize="25%"
                >
                  <div className="flex h-full min-h-0 flex-col">
                    {showResumeBanner && resumeTarget && (
                      <div
                        role="status"
                        className="flex shrink-0 items-center justify-between gap-2 border-b border-tour-border bg-tour-surface px-4 py-2 text-xs text-tour-text"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <History aria-hidden="true" className="size-3.5 shrink-0 text-tour-accent-fg" />
                          <span className="truncate">
                            <Trans>
                              上次读到：
                              {resumeTitle}
                            </Trans>
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              goToSection(resumeTarget.chapterId, resumeTarget.subChapterId, resumeTarget.sectionId)
                              setResumeTarget(null)
                            }}
                            className="inline-flex min-h-7 items-center rounded bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <Trans>继续学习</Trans>
                          </button>
                          <button
                            type="button"
                            aria-label={t`关闭续学提示`}
                            onClick={() => setResumeTarget(null)}
                            className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <X aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
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
                        aiHref={aiHref}
                        playgroundHref={playgroundHref}
                        onPrev={goPrev}
                        onNext={goNext}
                      />
                    )}
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle disabled={editorHidden} className={editorHidden ? 'hidden' : 'bg-tour-border/80'} />
                <ResizablePanel
                  id="tour-editor-panel"
                  defaultSize={isDesktop ? '62%' : isShortMobile ? '75%' : '50%'}
                  minSize={isDesktop ? '30%' : '25%'}
                  collapsible={!isDesktop}
                  collapsedSize="0%"
                >
                  <div id="tour-editor-content" className="h-full min-h-0 overflow-hidden" inert={editorHidden} aria-hidden={editorHidden}>
                    <EditorPreviewContext value={{ code, locale: lang }}>
                      <Suspense fallback={<TourEditorLoading code={code} locale={lang} />}>
                        {hydrated
                          ? <Editor code={code} locale={lang} sectionKey={buildTourSectionKey(section.chapterId, section.subChapterId, section.sectionId)} />
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
                aiHref={aiHref}
                playgroundHref={playgroundHref}
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
