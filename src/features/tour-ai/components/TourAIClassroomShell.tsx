'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { cn, isDarkMode } from '@/lib/utils'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'
import { LessonGenerationErrorRetry } from '@/features/tour-ai/components/LessonGenerationErrorRetry'
import { ClassroomStream } from '@/features/tour-ai/components/ClassroomStream'
import { LessonGenerationProgressPanel } from '@/features/tour-ai/components/LessonGenerationProgressPanel'
import { TourAIChat } from '@/features/tour-ai/components/TourAIChat'
import { useLessonGenerationRuntime } from '@/features/tour-ai/runtime/useLessonGenerationRuntime'
import { ClassroomAbortScopeProvider } from '@/features/tour-ai/context/classroom-abort-scope'
import {
  ClassroomActivityProvider,
  useClassroomActivity,
} from '@/features/tour-ai/context/classroom-activity-context'
import { deriveClassroomPendingState } from '@/lib/ai/classroom/selectors'

interface TourAIClassroomShellProps {
  lang: string
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  annotationState: EditorAnnotationState
}

export function TourAIClassroomShell(props: TourAIClassroomShellProps) {
  return (
    <ClassroomAbortScopeProvider>
      <ClassroomActivityProvider>
        <TourAIClassroomShellInner {...props} />
      </ClassroomActivityProvider>
    </ClassroomAbortScopeProvider>
  )
}

function TourAIClassroomShellInner({
  lang,
  session,
  dispatch,
  hydrated,
  annotationState,
}: TourAIClassroomShellProps) {
  const bridge = useAIClassroomBridge()
  const { activity } = useClassroomActivity()
  const [chatOpen, setChatOpen] = useState(false)
  const {
    generationProgress,
    generationRunning,
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
  } = useLessonGenerationRuntime({
    lang,
    currentSection: undefined,
    session,
    dispatch,
    hydrated,
  })

  const pendingState = deriveClassroomPendingState(session, activity)

  return (
    <div
      data-testid="ai-classroom-root"
      className={cn(aiClassroomStyles.layout.root, isDarkMode() && 'dark')}
      style={{
        'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
        '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
      } as React.CSSProperties}
    >
      <div className={aiClassroomStyles.layout.shell}>
        <main className={aiClassroomStyles.layout.main}>
          <header data-testid="ai-classroom-header" className={aiClassroomStyles.header.root}>
            <div className={aiClassroomStyles.header.content}>
              <div className={aiClassroomStyles.header.brandMark}>仓</div>
              <div className={aiClassroomStyles.header.title}><Trans>AI 课堂</Trans></div>
              <span className={aiClassroomStyles.header.subtitle}></span>
              <span data-testid="classroom-phase" className={aiClassroomStyles.badge.phase}>
                {session.phase}
              </span>
            </div>
            <button
              type="button"
              aria-label={t`打开聊天`}
              onClick={() => setChatOpen(true)}
              className={aiClassroomStyles.button.secondary}
            >
              <MessageCircle className="size-4" />
              <Trans>聊天</Trans>
            </button>
          </header>

          <div className={aiClassroomStyles.layout.viewport}>
            <div className={aiClassroomStyles.layout.content}>
              <section className={aiClassroomStyles.layout.sectionIntro}>
                <div className={aiClassroomStyles.text.eyebrow}><Trans>课堂内容</Trans></div>
                <h1 className={aiClassroomStyles.text.pageTitle}><Trans>AI 课堂</Trans></h1>
              </section>

              <ClassroomStream session={session} lang={lang} dispatch={dispatch} bridge={bridge} />

              <LessonGenerationProgressPanel
                progress={generationProgress}
                visible={pendingState === 'lesson_generation' || generationRunning || generationProgress.status !== 'idle'}
                onToggle={toggleGenerationProgress}
              />

              {annotationState.annotations.some(annotation => annotation.namespace === 'chat' && annotation.stale) && (
                <div className={cn(aiClassroomStyles.text.warning, 'mt-3')}><Trans>聊天标注已过期</Trans></div>
              )}

              <LessonGenerationErrorRetry session={session} onRetry={retryQueuedGenerationEvent} />
            </div>
          </div>
        </main>

        {chatOpen && (
          <aside className={aiClassroomStyles.layout.sidebar}>
            <div className={aiClassroomStyles.header.sidebarHeader}>
              <div className={aiClassroomStyles.text.label}><Trans>聊天</Trans></div>
              <button
                type="button"
                aria-label={t`关闭聊天`}
                onClick={() => setChatOpen(false)}
                className={aiClassroomStyles.button.icon}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className={aiClassroomStyles.layout.sidebarBody}>
              <TourAIChat />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
