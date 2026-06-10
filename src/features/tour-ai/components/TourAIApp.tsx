'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Trans } from '@lingui/react/macro'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { ClassroomLandingPage } from '@/features/tour-ai/components/ClassroomLandingPage'
import { ClassroomLoadingSkeleton } from '@/features/tour-ai/components/ClassroomLoadingSkeleton'
import { ClassroomThemeProvider } from '@/features/tour-ai/context/classroom-theme-context'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useExerciseDraftStore } from '@/features/tour-ai/state/exercise-draft-store'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { getStaticTourSourceHref } from '@/lib/ai/course-content/static-tour-links'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { usePersistentClassroomSession } from '@/lib/ai/classroom/use-persistent-session'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { QuotaExhaustedDialog } from '@/modules/llm-config/components/QuotaExhaustedDialog'
import { resetDocumentScroll } from './classroom-scroll-reset'
import { currentAIClassroomHref, currentStaticTourRecoveryHref } from './classroom-loading-recovery'

interface TourAIAppProps {
  lang: string
}

type EntryMode = 'live' | 'preview'

const AI_CLASSROOM_APP_LOADING_RECOVERY_DELAY_MS = 6000

const TourAIClassroomExperience = dynamic(
  () => import('./TourAIClassroomExperience'),
  {
    ssr: false,
    loading: ClassroomExperienceLoading,
  },
)

const ChineseTourAIClassroomExperience = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(
    () => import('./TourAIClassroomExperience'),
  ),
  {
    ssr: false,
    loading: ClassroomExperienceLoading,
  },
)

// Read `?topic=<id>` once at mount and freeze it. We do not subscribe to URL
// changes because the initial classroom_opened event is only emitted on first
// entry; later URL edits would not retrigger it anyway.
function readInitialTopic(): string | undefined {
  if (typeof window === 'undefined')
    return undefined
  const raw = new URLSearchParams(window.location.search).get('topic')?.trim()
  return raw && raw.length > 0 ? raw : undefined
}

function hasClassroomSession(session: ClassroomSession): boolean {
  return session.stream.length > 0
    || session.eventQueue.length > 0
    || session.learner.evidence.length > 0
    || session.learner.reviewArtifacts.length > 0
    || Object.keys(session.learner.reviewExposures).length > 0
}

function resolveInitialTopic(initialTopic: string | undefined, lang: string) {
  if (!initialTopic) {
    return {
      topicId: undefined,
      topicTitle: undefined,
      sourceHref: undefined,
      unavailable: false,
    }
  }

  const index = getDefaultCourseContentIndex()
  const concept = index.getConcept(initialTopic)
  const defaultTrack = index.pack.tracks[0]
  const topicIsAvailable = Boolean(
    concept
    && index.validation.conceptStatuses[initialTopic] === 'validated'
    && defaultTrack?.conceptIds.includes(initialTopic),
  )

  if (!topicIsAvailable) {
    return {
      topicId: undefined,
      topicTitle: undefined,
      sourceHref: undefined,
      unavailable: true,
    }
  }

  return {
    topicId: initialTopic,
    topicTitle: concept!.title[lang === 'en' ? 'en' : 'zh'],
    sourceHref: getStaticTourSourceHref(lang, { conceptId: initialTopic }) ?? undefined,
    unavailable: false,
  }
}

export default function TourAIApp({ lang }: TourAIAppProps) {
  const { session, dispatch, hydrated, hydrationIssue, saveIssue, markTemporarySessionInUse, retrySave, resetSession } = usePersistentClassroomSession({ lang })
  const [initialTopic] = useState<string | undefined>(() => readInitialTopic())
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null)
  const initialTopicResolution = useMemo(() => resolveInitialTopic(initialTopic, lang), [initialTopic, lang])
  const ExperienceComponent = lang === 'zh' ? ChineseTourAIClassroomExperience : TourAIClassroomExperience
  const hasExistingClassroomSession = hasClassroomSession(session)
  const inlineStyle: React.CSSProperties & Record<`--${string}`, string> = {
    'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
    '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
  }

  const resetClassroom = useCallback(() => {
    useExerciseDraftStore.getState().clearAll()
    useCodeSuggestionStore.getState().clearAll()
    useScrollWatermarkStore.getState().clearAll()
    resetSession()
  }, [resetSession])

  const enterClassroom = useCallback((mode: EntryMode) => {
    resetDocumentScroll()
    if (mode === 'live')
      markTemporarySessionInUse()
    setEntryMode(mode)
  }, [markTemporarySessionInUse])

  return (
    <ClassroomThemeProvider>
      <div
        data-testid="ai-classroom-root"
        className="ai-classroom-root ai-classroom-viewport-root"
        style={inlineStyle}
      >
        {!hydrated
          ? <ClassroomEntryLoading />
          : entryMode == null
            ? (
                <>
                  <ClassroomLandingPage
                    hasClassroomSession={hasExistingClassroomSession}
                    topicTitle={initialTopicResolution.topicTitle}
                    topicUnavailable={initialTopicResolution.unavailable}
                    sourceHref={initialTopicResolution.sourceHref}
                    persistenceIssue={hydrationIssue}
                    saveIssue={saveIssue}
                    onRetrySave={retrySave}
                    onResetSession={resetClassroom}
                    onEnter={() => enterClassroom('live')}
                    onPreview={() => enterClassroom('preview')}
                  />
                  <LLMConfigDialog withTrigger={false} />
                  {!hasExistingClassroomSession && <QuotaExhaustedDialog />}
                </>
              )
            : (
                <ExperienceComponent
                  lang={lang}
                  session={session}
                  dispatch={dispatch}
                  hydrated={hydrated}
                  hydrationIssue={hydrationIssue}
                  saveIssue={saveIssue}
                  onTemporarySessionUse={markTemporarySessionInUse}
                  onRetrySave={retrySave}
                  onResetSession={resetClassroom}
                  initialTopic={initialTopicResolution.topicId}
                  initialLandingAccepted
                  initialPreviewOnly={entryMode === 'preview'}
                />
              )}
      </div>
    </ClassroomThemeProvider>
  )
}

export function ClassroomEntryLoading() {
  return (
    <ClassroomLoadingFrame
      title={<Trans>正在加载课堂内容</Trans>}
      description={<Trans>正在读取你的课堂记录，并准备进入学习入口。</Trans>}
    />
  )
}

export function ClassroomExperienceLoading() {
  return (
    <ClassroomLoadingFrame
      title={<Trans>正在准备课堂</Trans>}
      description={<Trans>正在加载课堂运行环境和当前课堂内容。</Trans>}
    />
  )
}

function ClassroomLoadingFrame({ title, description }: { title: ReactNode, description: ReactNode }) {
  const [showRecovery, setShowRecovery] = useState(false)
  const pageTitleId = useId()
  const loadingTitleId = useId()
  const loadingDescriptionId = useId()
  const recoveryDescriptionId = useId()
  const recoveryHref = currentAIClassroomHref()
  const staticTourRecoveryHref = currentStaticTourRecoveryHref()

  useEffect(() => {
    const timeout = window.setTimeout(setShowRecovery, AI_CLASSROOM_APP_LOADING_RECOVERY_DELAY_MS, true)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <main aria-labelledby={pageTitleId} className="flex h-full min-h-0 bg-tour-bg px-6 py-8 text-tour-text">
      <div className="mx-auto w-full max-w-[920px]">
        <div className="text-xs font-semibold uppercase text-tour-link"><Trans>课堂内容</Trans></div>
        <h1 id={pageTitleId} className="mt-1 text-2xl font-bold tracking-normal text-tour-heading"><Trans>AI 课堂</Trans></h1>
        <div className="mt-6 rounded-md border border-tour-border bg-tour-surface px-4 py-4">
          <div id={loadingTitleId} className="mb-2 text-sm font-semibold text-tour-heading">{title}</div>
          <p id={loadingDescriptionId} className="mb-4 text-xs leading-6 text-muted-foreground">{description}</p>
          <ClassroomLoadingSkeleton
            labelledBy={loadingTitleId}
            describedBy={showRecovery ? `${loadingDescriptionId} ${recoveryDescriptionId}` : loadingDescriptionId}
          />
          {showRecovery && (
            <div className="mt-4 border-t border-tour-border pt-3 text-xs leading-6 text-muted-foreground">
              <p id={recoveryDescriptionId}>
                <Trans>如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。</Trans>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={recoveryHref}
                  aria-describedby={recoveryDescriptionId}
                  className="inline-flex max-w-full rounded-md border border-tour-border bg-tour-bg px-3 py-1.5 text-xs font-semibold text-tour-heading hover:bg-tour-surface"
                >
                  <Trans>刷新页面</Trans>
                </a>
                {staticTourRecoveryHref && (
                  <a
                    href={staticTourRecoveryHref}
                    aria-describedby={recoveryDescriptionId}
                    className="inline-flex max-w-full rounded-md border border-tour-border bg-tour-bg px-3 py-1.5 text-xs font-semibold text-tour-heading hover:bg-tour-surface"
                  >
                    <Trans>查看对应教程</Trans>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
