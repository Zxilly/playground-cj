'use client'

import { useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { cn } from '@/lib/utils'
import { ClassroomAbortScopeProvider } from '@/features/tour-ai/context/classroom-abort-scope'
import { ClassroomActivityProvider, useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import { ClassroomSessionProvider, useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { ViewportRefProvider } from '@/features/tour-ai/context/classroom-viewport-context'
import { useClassroomTheme } from '@/features/tour-ai/context/classroom-theme-context'
import { ClassroomHeader } from '@/features/tour-ai/components/ClassroomHeader'
import { ClassroomViewport } from '@/features/tour-ai/components/ClassroomViewport'
import { ClassroomLoadingSkeleton } from '@/features/tour-ai/components/ClassroomLoadingSkeleton'
import { ClassroomChatSidebar } from '@/features/tour-ai/components/ClassroomChatSidebar'
import { ClassroomScrollFollower } from '@/features/tour-ai/components/ClassroomScrollFollower'
import { ClassroomStream } from '@/features/tour-ai/components/ClassroomStream'
import { LessonGenerationProgressPanel } from '@/features/tour-ai/components/LessonGenerationProgressPanel'
import { LessonGenerationErrorRetry } from '@/features/tour-ai/components/LessonGenerationErrorRetry'
import { useScrollFollower } from '@/features/tour-ai/components/use-scroll-follower'
import { useLessonGenerationRuntime } from '@/features/tour-ai/runtime/useLessonGenerationRuntime'
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
        <ClassroomSessionProvider value={{
          session: props.session,
          dispatch: props.dispatch,
          hydrated: props.hydrated,
          annotationState: props.annotationState,
        }}
        >
          <TourAIClassroomShellInner lang={props.lang} />
        </ClassroomSessionProvider>
      </ClassroomActivityProvider>
    </ClassroomAbortScopeProvider>
  )
}

function TourAIClassroomShellInner({ lang }: { lang: string }) {
  const bridge = useAIClassroomBridge()
  const { activity } = useClassroomActivity()
  const { resolved } = useClassroomTheme()
  const { session, dispatch, hydrated, annotationState } = useClassroomSession()
  const [chatOpen, setChatOpen] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  const {
    generationProgress,
    generationRunning,
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
  } = useLessonGenerationRuntime({ session, dispatch, hydrated })

  const { newContentBelow, pinned, scrollToBottom } = useScrollFollower({
    viewportRef,
    contentLength: session.stream.length,
    hydrated,
  })

  const pendingState = deriveClassroomPendingState(session, activity)
  const isDark = resolved === 'dark'

  const inlineStyle: React.CSSProperties & Record<`--${string}`, string> = {
    'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
    '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
  }

  return (
    <div
      data-testid="ai-classroom-root"
      className={cn('ai-classroom-root h-screen', isDark && 'dark')}
      style={inlineStyle}
    >
      <ViewportRefProvider value={viewportRef}>
        <div className="flex h-full min-h-0 bg-tour-bg text-tour-text">
          <main className="relative flex min-w-0 flex-1 flex-col">
            <ClassroomHeader onOpenChat={() => setChatOpen(true)} />
            <ClassroomViewport viewportRef={viewportRef}>
              {!hydrated
                ? <ClassroomLoadingSkeleton />
                : (
                    <>
                      <ClassroomStream session={session} lang={lang} dispatch={dispatch} bridge={bridge} />
                      <LessonGenerationProgressPanel
                        progress={generationProgress}
                        visible={pendingState === 'lesson_generation' || generationRunning || generationProgress.status !== 'idle'}
                        onToggle={toggleGenerationProgress}
                      />
                      {annotationState.annotations.some(a => a.namespace === 'chat' && a.stale) && (
                        <div className="mt-3 text-xs text-classroom-warning-fg"><Trans>聊天标注已过期</Trans></div>
                      )}
                      <LessonGenerationErrorRetry session={session} onRetry={retryQueuedGenerationEvent} />
                    </>
                  )}
            </ClassroomViewport>
            <ClassroomScrollFollower visible={newContentBelow && !pinned} onClick={scrollToBottom} />
          </main>
          {chatOpen && <ClassroomChatSidebar onClose={() => setChatOpen(false)} />}
        </div>
      </ViewportRefProvider>
    </div>
  )
}
