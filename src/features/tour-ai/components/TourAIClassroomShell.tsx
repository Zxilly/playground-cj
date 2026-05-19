'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Trans } from '@lingui/react/macro'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { ClassroomAbortScopeProvider } from '@/features/tour-ai/context/classroom-abort-scope'
import { ClassroomActivityProvider, useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import { ClassroomSessionProvider, useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { ClassroomVirtuosoProvider } from '@/features/tour-ai/context/classroom-virtuoso-context'
import { ViewportRefProvider } from '@/features/tour-ai/context/classroom-viewport-context'
import { ClassroomChapterIndex } from '@/features/tour-ai/components/ClassroomChapterIndex'
import { ClassroomHeader } from '@/features/tour-ai/components/ClassroomHeader'
import { ClassroomViewport } from '@/features/tour-ai/components/ClassroomViewport'
import { ClassroomLoadingSkeleton } from '@/features/tour-ai/components/ClassroomLoadingSkeleton'
import { ClassroomChatSidebar } from '@/features/tour-ai/components/ClassroomChatSidebar'
import { ClassroomIntentBar } from '@/features/tour-ai/components/ClassroomIntentBar'
import { ClassroomQuotaBanner } from '@/features/tour-ai/components/ClassroomQuotaBanner'
import { ClassroomScrollRail } from '@/features/tour-ai/components/ClassroomScrollRail'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'
import { visibleStream } from '@/features/tour-ai/utils/scroll-rail-markers'
import { QuotaExhaustedDialog } from '@/modules/llm-config/components/QuotaExhaustedDialog'
import { ClassroomScrollFollower } from '@/features/tour-ai/components/ClassroomScrollFollower'
import { ClassroomStream } from '@/features/tour-ai/components/ClassroomStream'
import { LessonGenerationProgressPanel } from '@/features/tour-ai/components/LessonGenerationProgressPanel'
import { LessonGenerationErrorRetry } from '@/features/tour-ai/components/LessonGenerationErrorRetry'
import { useScrollFollower } from '@/features/tour-ai/components/use-scroll-follower'
import { useLessonGenerationRuntime } from '@/features/tour-ai/runtime/useLessonGenerationRuntime'
import { deriveClassroomPendingState, lessonBlockDomId } from '@/lib/ai/classroom/selectors'
import { classroomFadeUpVariants } from '@/features/tour-ai/components/classroom-motion'

interface TourAIClassroomShellProps {
  lang: string
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  annotationState: EditorAnnotationState
  initialTopic?: string
}

export function TourAIClassroomShell(props: TourAIClassroomShellProps) {
  // Memoize the context value so descendants that only consume `useClassroomSession`
  // don't re-render on every parent render. Without this, every dispatch causes
  // ScrollRail, ConceptPanel, etc. to re-render even when their slice didn't
  // actually change.
  const sessionContextValue = useMemo(
    () => ({
      session: props.session,
      dispatch: props.dispatch,
      hydrated: props.hydrated,
      annotationState: props.annotationState,
    }),
    [props.session, props.dispatch, props.hydrated, props.annotationState],
  )
  return (
    <ClassroomAbortScopeProvider>
      <ClassroomActivityProvider>
        <ClassroomSessionProvider value={sessionContextValue}>
          <ClassroomVirtuosoProvider>
            <TourAIClassroomShellInner lang={props.lang} initialTopic={props.initialTopic} />
          </ClassroomVirtuosoProvider>
        </ClassroomSessionProvider>
      </ClassroomActivityProvider>
    </ClassroomAbortScopeProvider>
  )
}

function TourAIClassroomShellInner({ lang, initialTopic }: { lang: string, initialTopic?: string }) {
  const bridge = useAIClassroomBridge()
  const { activity } = useClassroomActivity()
  const { session, dispatch, hydrated, annotationState } = useClassroomSession()
  const [chatOpen, setChatOpen] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  const {
    generationProgress,
    generationRunning,
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
    waitingForApiKey,
  } = useLessonGenerationRuntime({ session, dispatch, hydrated, initialTopic })

  const { newContentBelow, pinned, scrollToBottom } = useScrollFollower({
    viewportRef,
    contentLength: session.stream.length,
    hydrated,
  })

  // One-shot: when hydrate completes, restore to the learner's last
  // read-position (watermark) rather than yanking them to the bottom of a
  // potentially-long session. Falls back to bottom when no watermark exists
  // — that preserves the previous "fresh session lands at latest" behavior
  // for first-time users.
  //
  // session / watermarkIndex are intentionally NOT in the dep array — the
  // effect only fires once (gated by didHydrateScrollRef) and reads both from
  // refs / synchronous store snapshots. Listing them as deps caused the
  // effect to re-schedule on every dispatch, which was wasted work during
  // active generation.
  const sessionRef = useRef(session)
  sessionRef.current = session
  const didHydrateScrollRef = useRef(false)
  useEffect(() => {
    if (didHydrateScrollRef.current)
      return
    if (!hydrated)
      return
    const el = viewportRef.current
    if (!el)
      return
    didHydrateScrollRef.current = true
    const currentSession = sessionRef.current
    const wm = useScrollWatermarkStore.getState().watermarks[lang] ?? -1
    const visible = visibleStream(currentSession)
    if (wm >= 0 && wm < visible.length) {
      // Try to find the DOM anchor for the watermarked item; fall back to a
      // ratio jump when the item type doesn't expose a chapter-id anchor.
      const item = visible[wm]
      const anchorKey = item.type === 'lesson_blocks'
        ? lessonBlockDomId(item.id, 0)
        : null
      const target = anchorKey ? el.querySelector(`[data-chapter-id="${CSS.escape(anchorKey)}"]`) : null
      if (target) {
        target.scrollIntoView({ block: 'start' })
        return
      }
      const ratio = wm / Math.max(1, visible.length - 1)
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
      return
    }
    el.scrollTop = el.scrollHeight
  }, [hydrated, lang])

  const pendingState = deriveClassroomPendingState(session, activity)

  const inlineStyle: React.CSSProperties & Record<`--${string}`, string> = {
    'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
    '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-testid="ai-classroom-root"
        className="ai-classroom-root h-screen"
        style={inlineStyle}
      >
        <ViewportRefProvider value={viewportRef}>
          <div className="flex h-full min-h-0 bg-tour-bg text-tour-text">
            <main className="relative flex min-w-0 flex-1 flex-col">
              <ClassroomHeader
                onOpenChat={() => setChatOpen(true)}
                chapterIndex={<ClassroomChapterIndex />}
              />
              <ClassroomQuotaBanner />
              <ClassroomViewport
                viewportRef={viewportRef}
                overlay={hydrated
                  ? <ClassroomScrollRail viewportRef={viewportRef} lang={lang} hydrated={hydrated} />
                  : null}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!hydrated
                    ? (
                        <motion.div
                          key="classroom-loading"
                          data-testid="ai-classroom-loading-motion"
                          variants={classroomFadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <ClassroomLoadingSkeleton />
                        </motion.div>
                      )
                    : (
                        <motion.div
                          key="classroom-content"
                          data-testid="ai-classroom-content-motion"
                          variants={classroomFadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <ClassroomStream session={session} lang={lang} dispatch={dispatch} bridge={bridge} />
                          <LessonGenerationProgressPanel
                            progress={generationProgress}
                            visible={pendingState === 'lesson_generation' || generationRunning || generationProgress.status !== 'idle'}
                            blockedReason={waitingForApiKey ? 'api_key' : undefined}
                            onToggle={toggleGenerationProgress}
                          />
                          <AnimatePresence initial={false}>
                            {annotationState.annotations.some(a => a.namespace === 'chat' && a.stale) && (
                              <motion.div
                                key="stale-chat-annotation"
                                variants={classroomFadeUpVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="mt-3 text-xs text-classroom-warning-fg"
                              >
                                <Trans>聊天标注已过期</Trans>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <LessonGenerationErrorRetry session={session} onRetry={retryQueuedGenerationEvent} />
                          <ClassroomIntentBar
                            session={session}
                            dispatch={dispatch}
                            disabled={generationRunning || waitingForApiKey}
                          />
                        </motion.div>
                      )}
                </AnimatePresence>
              </ClassroomViewport>
              <ClassroomScrollFollower visible={newContentBelow && !pinned} onClick={scrollToBottom} />
            </main>
            <AnimatePresence>
              {chatOpen && <ClassroomChatSidebar onClose={() => setChatOpen(false)} />}
            </AnimatePresence>
            {/* Quota dialog is store-controlled — mount once at the shell so it
                surfaces on the AI page regardless of whether chat is open. */}
            <QuotaExhaustedDialog />
          </div>
        </ViewportRefProvider>
      </div>
    </MotionConfig>
  )
}
