'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { ClassroomSessionHydrationIssue, ClassroomSessionSaveIssue } from '@/lib/ai/classroom/use-persistent-session'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { ClassroomAbortScopeProvider } from '@/features/tour-ai/context/classroom-abort-scope'
import { ClassroomActivityProvider, useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import { ClassroomSessionProvider, useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { ClassroomVirtuosoProvider } from '@/features/tour-ai/context/classroom-virtuoso-context'
import { ViewportRefProvider } from '@/features/tour-ai/context/classroom-viewport-context'
import { ClassroomLiveScrollSurfaceProvider } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { ClassroomLiveChapterIndex } from '@/features/tour-ai/components/ClassroomLiveChapterIndex'
import { ClassroomHeader } from '@/features/tour-ai/components/ClassroomHeader'
import { ClassroomLandingPage } from '@/features/tour-ai/components/ClassroomLandingPage'
import { ClassroomViewport } from '@/features/tour-ai/components/ClassroomViewport'
import { ClassroomLoadingSkeleton } from '@/features/tour-ai/components/ClassroomLoadingSkeleton'
import { ClassroomChatSidebar } from '@/features/tour-ai/components/ClassroomChatSidebar'
import { ClassroomIntentBar } from '@/features/tour-ai/components/ClassroomIntentBar'
import { ClassroomQuotaBanner } from '@/features/tour-ai/components/ClassroomQuotaBanner'
import { ClassroomScrollRail } from '@/features/tour-ai/components/ClassroomScrollRail'
import { QuotaExhaustedDialog } from '@/modules/llm-config/components/QuotaExhaustedDialog'
import { ClassroomScrollFollower } from '@/features/tour-ai/components/ClassroomScrollFollower'
import { ClassroomStream } from '@/features/tour-ai/components/ClassroomStream'
import { ClassroomReviewView } from '@/features/tour-ai/components/ClassroomReviewView'
import { LessonGenerationProgressPanel } from '@/features/tour-ai/components/LessonGenerationProgressPanel'
import { LessonGenerationErrorRetry } from '@/features/tour-ai/components/LessonGenerationErrorRetry'
import { ClassroomPersistenceBanner } from '@/features/tour-ai/components/ClassroomPersistenceBanner'
import { ClassroomStaleChatAnnotationsNotice } from '@/features/tour-ai/components/ClassroomStaleChatAnnotationsNotice'
import { resetClassroomViewportScroll, resetDocumentScroll } from '@/features/tour-ai/components/classroom-scroll-reset'
import { useLessonGenerationRuntime } from '@/features/tour-ai/runtime/useLessonGenerationRuntime'
import { deriveActiveConceptId, deriveClassroomPendingState } from '@/lib/ai/classroom/selectors'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { getStaticTourSourceHref } from '@/lib/ai/course-content/static-tour-links'
import { AI_CLASSROOM_VIEW_PANEL_IDS, AI_CLASSROOM_VIEW_TAB_IDS } from './classroom-view-tabs'

const PENDING_GENERATION_FOCUS_TARGET = '__pending_generation_focus_target__'
const CHAT_MARKER_NAMESPACE = 'chat'

interface ReviewFocusRequest {
  conceptId: string
  key: number
}

interface TourAIClassroomShellProps {
  lang: string
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  hydrationIssue: ClassroomSessionHydrationIssue | null
  saveIssue: ClassroomSessionSaveIssue | null
  onTemporarySessionUse: () => void
  onRetrySave: () => Promise<void> | void
  onResetSession: () => void
  annotationState: EditorAnnotationState
  initialTopic?: string
  initialLandingAccepted?: boolean
  initialPreviewOnly?: boolean
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
      hydrationIssue: props.hydrationIssue,
      saveIssue: props.saveIssue,
      retrySave: props.onRetrySave,
      resetSession: props.onResetSession,
      annotationState: props.annotationState,
    }),
    [props.session, props.dispatch, props.hydrated, props.hydrationIssue, props.saveIssue, props.onRetrySave, props.onResetSession, props.annotationState],
  )
  return (
    <ClassroomAbortScopeProvider>
      <ClassroomActivityProvider>
        <ClassroomSessionProvider value={sessionContextValue}>
          <ClassroomVirtuosoProvider>
            <TourAIClassroomShellInner
              lang={props.lang}
              initialTopic={props.initialTopic}
              onTemporarySessionUse={props.onTemporarySessionUse}
              initialLandingAccepted={props.initialLandingAccepted}
              initialPreviewOnly={props.initialPreviewOnly}
            />
          </ClassroomVirtuosoProvider>
        </ClassroomSessionProvider>
      </ClassroomActivityProvider>
    </ClassroomAbortScopeProvider>
  )
}

function TourAIClassroomShellInner({
  lang,
  initialTopic,
  onTemporarySessionUse,
  initialLandingAccepted = false,
  initialPreviewOnly = false,
}: {
  lang: string
  initialTopic?: string
  onTemporarySessionUse: () => void
  initialLandingAccepted?: boolean
  initialPreviewOnly?: boolean
}) {
  const bridge = useAIClassroomBridge()
  const { activity } = useClassroomActivity()
  const { session, dispatch, hydrated, hydrationIssue, saveIssue, retrySave, resetSession, annotationState } = useClassroomSession()
  const [chatOpen, setChatOpen] = useState(false)
  const [chatScopeConceptId, setChatScopeConceptId] = useState<string | undefined>()
  const [activeView, setActiveView] = useState<'live' | 'review'>(() => initialPreviewOnly ? 'review' : 'live')
  const [reviewFocusRequest, setReviewFocusRequest] = useState<ReviewFocusRequest | null>(null)
  const [liveFocusExerciseId, setLiveFocusExerciseId] = useState<string | undefined>()
  const [liveFocusExerciseRequestKey, setLiveFocusExerciseRequestKey] = useState(0)
  const [liveFocusGenerationRequestKey, setLiveFocusGenerationRequestKey] = useState(0)
  const [liveFocusContinueRequestKey, setLiveFocusContinueRequestKey] = useState(0)
  const [previewStartConceptId, setPreviewStartConceptId] = useState<string | undefined>()
  const [reviewActiveConceptId, setReviewActiveConceptId] = useState<string | undefined>()
  const liveFocusGenerationTargetSignatureRef = useRef<string | undefined>(undefined)
  const reviewFocusRequestKeyRef = useRef(0)
  const [landingAccepted, setLandingAccepted] = useState(initialLandingAccepted)
  const [previewOnly, setPreviewOnly] = useState(initialPreviewOnly)
  const viewportRef = useRef<HTMLDivElement>(null)
  const chatReturnFocusRef = useRef<HTMLElement | null>(null)
  const chatWasOpenRef = useRef(false)

  useEffect(() => {
    if (landingAccepted)
      resetDocumentScroll()
  }, [landingAccepted])

  useEffect(() => {
    if (!chatOpen && chatWasOpenRef.current) {
      const returnFocusTarget = chatReturnFocusRef.current
      chatReturnFocusRef.current = null
      if (returnFocusTarget?.isConnected)
        returnFocusTarget.focus()
    }
    chatWasOpenRef.current = chatOpen
  }, [chatOpen])

  const hasClassroomSession = session.stream.length > 0
    || session.eventQueue.length > 0
    || session.learner.evidence.length > 0
    || session.learner.reviewArtifacts.length > 0
    || Object.keys(session.learner.reviewExposures).length > 0
  const hasReadableClassroomContent = session.currentExercise != null
    || session.stream.some(item => item.type !== 'system_event')
    || session.learner.evidence.length > 0
    || session.learner.reviewArtifacts.length > 0
    || Object.keys(session.learner.reviewExposures).length > 0
  const initialTopicResolution = useMemo(() => {
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
  }, [initialTopic, lang])

  const {
    generationProgress,
    generationRecoveryReason,
    generationRunning,
    generationSlow,
    generationStalled,
    hasRetryableInitialGenerationError,
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
    waitingForApiKey,
    waitingForSharedQuota,
  } = useLessonGenerationRuntime({
    session,
    dispatch,
    hydrated,
    enabled: landingAccepted && !previewOnly,
    initialTopic: previewStartConceptId ?? initialTopicResolution.topicId,
  })

  const pendingState = deriveClassroomPendingState(session, activity)
  const generationTargetVisible = pendingState === 'lesson_generation'
    || generationRunning
    || generationProgress.status !== 'idle'
    || waitingForApiKey
    || waitingForSharedQuota
    || hasRetryableInitialGenerationError
    || session.eventQueue.length > 0
  const generationTargetSignature = generationTargetVisible
    ? generationFocusTargetSignature(session, hasRetryableInitialGenerationError, waitingForApiKey, waitingForSharedQuota)
    : undefined
  const liveFocusGenerationRequest = resolveLiveFocusGenerationRequest(
    liveFocusGenerationRequestKey,
    generationTargetSignature,
    liveFocusGenerationTargetSignatureRef,
  )
  const continueFocusBlockedByPreparation = pendingState === 'lesson_generation'
    || generationRunning
    || waitingForApiKey
    || waitingForSharedQuota
    || session.eventQueue.length > 0
  const liveFocusContinueRequest = liveFocusContinueRequestKey > 0 && !continueFocusBlockedByPreparation
    ? liveFocusContinueRequestKey
    : undefined
  const intentBarDisabled = pendingState === 'lesson_generation' || generationRunning || waitingForApiKey || waitingForSharedQuota || hasRetryableInitialGenerationError
  const intentBarDisabledReason = waitingForSharedQuota
    ? 'shared_quota'
    : pendingState === 'lesson_generation' || generationRunning || hasRetryableInitialGenerationError ? 'lesson_generation' : undefined
  const chatDisabledReason = !previewOnly && !hasReadableClassroomContent
    ? waitingForApiKey
      ? 'api_key'
      : waitingForSharedQuota
        ? 'shared_quota'
        : 'lesson_generation'
    : undefined
  const activeConceptId = useMemo(() => deriveActiveConceptId(session) ?? undefined, [session])
  const staleChatAnnotationCount = annotationState.annotations.filter(annotation => annotation.namespace === 'chat' && annotation.stale).length
  const clearStaleChatAnnotations = () => {
    bridge.classroom?.clearChatAnnotations()
    const model = bridge.editor.getEditor()?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, CHAT_MARKER_NAMESPACE, [])
  }
  const returnToLive = ({
    focusCurrentExercise = false,
    focusGeneration = false,
    focusContinue = false,
    startConceptId,
  }: {
    focusCurrentExercise?: boolean
    focusGeneration?: boolean
    focusContinue?: boolean
    startConceptId?: string
  } = {}) => {
    const startingFromPreview = previewOnly
    if (startingFromPreview)
      onTemporarySessionUse()
    setPreviewOnly(false)
    setReviewFocusRequest(null)
    if (startingFromPreview && startConceptId)
      setPreviewStartConceptId(startConceptId)
    if (focusCurrentExercise && session.currentExercise?.status === 'active') {
      setLiveFocusExerciseId(session.currentExercise.id)
      setLiveFocusExerciseRequestKey(key => key + 1)
      setLiveFocusGenerationRequestKey(0)
      setLiveFocusContinueRequestKey(0)
      liveFocusGenerationTargetSignatureRef.current = undefined
    }
    else if (focusGeneration) {
      setLiveFocusExerciseId(undefined)
      setLiveFocusGenerationRequestKey(key => key + 1)
      setLiveFocusContinueRequestKey(0)
      liveFocusGenerationTargetSignatureRef.current = generationTargetSignature ?? PENDING_GENERATION_FOCUS_TARGET
    }
    else if (focusContinue) {
      setLiveFocusExerciseId(undefined)
      setLiveFocusGenerationRequestKey(0)
      setLiveFocusContinueRequestKey(key => key + 1)
      liveFocusGenerationTargetSignatureRef.current = undefined
    }
    else {
      setLiveFocusExerciseId(undefined)
      setLiveFocusGenerationRequestKey(0)
      setLiveFocusContinueRequestKey(0)
      liveFocusGenerationTargetSignatureRef.current = undefined
    }
    setActiveView('live')
  }
  const changeView = (view: 'live' | 'review') => {
    if (view === 'live') {
      if (previewOnly) {
        return
      }
      returnToLive()
      return
    }
    resetClassroomViewportScroll(viewportRef.current)
    setActiveView(view)
  }
  const reviewConcept = (conceptId: string) => {
    if (!previewOnly)
      setPreviewOnly(false)
    reviewFocusRequestKeyRef.current += 1
    setReviewFocusRequest({
      conceptId,
      key: reviewFocusRequestKeyRef.current,
    })
    setActiveView('review')
  }
  const updateReviewActiveConcept = useCallback((conceptId: string | undefined) => {
    setReviewActiveConceptId(conceptId)
  }, [])
  const enterLiveClassroom = () => {
    resetDocumentScroll()
    onTemporarySessionUse()
    setLandingAccepted(true)
    if (session.currentExercise?.status === 'active') {
      returnToLive({ focusCurrentExercise: true })
      return
    }
    if (!hasReadableClassroomContent) {
      returnToLive({ focusGeneration: true })
      return
    }
    returnToLive()
  }
  const previewCourseContent = () => {
    resetDocumentScroll()
    setPreviewOnly(true)
    setPreviewStartConceptId(undefined)
    setReviewActiveConceptId(undefined)
    setActiveView('review')
    setLandingAccepted(true)
  }
  const startClassroomFromPreview = () => {
    resetDocumentScroll()
    returnToLive({ focusGeneration: true, startConceptId: reviewActiveConceptId ?? initialTopicResolution.topicId })
  }
  const openChat = (conceptId?: string) => {
    if (chatDisabledReason) {
      returnToLive({ focusGeneration: true })
      return
    }
    chatReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setChatScopeConceptId(conceptId ?? activeConceptId)
    setChatOpen(true)
  }
  const setCurrentExerciseChatContext = (conceptId: string) => {
    setChatScopeConceptId(conceptId)
  }
  const closeChat = () => setChatOpen(false)

  const inlineStyle: React.CSSProperties & Record<`--${string}`, string> = {
    'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
    '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
  }
  return (
    <div
      data-testid="ai-classroom-experience-root"
      className="ai-classroom-root ai-classroom-viewport-root"
      style={inlineStyle}
    >
      {hydrated && !landingAccepted
        ? (
            <>
              <ClassroomLandingPage
                hasClassroomSession={hasClassroomSession}
                topicTitle={initialTopicResolution.topicTitle}
                topicUnavailable={initialTopicResolution.unavailable}
                sourceHref={initialTopicResolution.sourceHref}
                persistenceIssue={hydrationIssue}
                saveIssue={saveIssue}
                onRetrySave={retrySave}
                onResetSession={resetSession}
                onEnter={enterLiveClassroom}
                onPreview={previewCourseContent}
              />
              {!hasReadableClassroomContent && <QuotaExhaustedDialog />}
            </>
          )
        : (
            <ViewportRefProvider value={viewportRef}>
              <ClassroomLiveScrollSurfaceProvider viewportRef={viewportRef} lang={lang} hydrated={hydrated}>
                <div className="flex h-full min-h-0 bg-tour-bg text-tour-text">
                  <main className="relative flex min-w-0 flex-1 flex-col">
                    <ClassroomHeader
                      onOpenChat={() => openChat()}
                      chatDisabledReason={chatDisabledReason}
                      activeView={activeView}
                      onViewChange={changeView}
                      onReviewConcept={reviewConcept}
                      onReturnToCurrentExercise={() => returnToLive({ focusCurrentExercise: true })}
                      previewOnly={previewOnly}
                      onStartClassroom={startClassroomFromPreview}
                      activeConceptIdOverride={previewOnly ? reviewActiveConceptId ?? initialTopicResolution.topicId : undefined}
                      chapterIndex={activeView === 'live' ? <ClassroomLiveChapterIndex /> : null}
                    />
                    <ClassroomPersistenceBanner issue={hydrationIssue} saveIssue={saveIssue} onRetrySave={retrySave} />
                    <ClassroomQuotaBanner />
                    <ClassroomViewport
                      viewportRef={viewportRef}
                      overlay={hydrated && activeView === 'live' ? <ClassroomScrollRail /> : null}
                    >
                      {!hydrated
                        ? (
                            <div data-testid="ai-classroom-loading">
                              <ClassroomLoadingSkeleton />
                            </div>
                          )
                        : (
                            <div data-testid="ai-classroom-content">
                              {activeView === 'live'
                                ? (
                                    <section
                                      id={AI_CLASSROOM_VIEW_PANEL_IDS.live}
                                      role="tabpanel"
                                      aria-labelledby={AI_CLASSROOM_VIEW_TAB_IDS.live}
                                    >
                                      <ClassroomStream
                                        session={session}
                                        lang={lang}
                                        dispatch={dispatch}
                                        bridge={bridge}
                                        focusExerciseId={liveFocusExerciseId}
                                        focusExerciseRequestKey={liveFocusExerciseRequestKey}
                                        focusGenerationRequestKey={liveFocusGenerationRequest}
                                        focusContinueRequestKey={liveFocusContinueRequest}
                                        generationFocusBlockedReason={waitingForApiKey ? 'api_key' : waitingForSharedQuota ? 'shared_quota' : undefined}
                                        suppressGenerationErrorMarkers={generationRunning}
                                        onReviewConcept={reviewConcept}
                                        footer={(
                                          <>
                                            <LessonGenerationProgressPanel
                                              progress={generationProgress}
                                              visible={pendingState === 'lesson_generation' || generationRunning || generationProgress.status !== 'idle'}
                                              blockedReason={waitingForApiKey ? 'api_key' : waitingForSharedQuota ? 'shared_quota' : undefined}
                                              recoveryReason={generationRecoveryReason}
                                              stalled={generationStalled}
                                              slow={generationSlow}
                                              onToggle={toggleGenerationProgress}
                                            />
                                            <ClassroomStaleChatAnnotationsNotice
                                              staleCount={staleChatAnnotationCount}
                                              onClear={clearStaleChatAnnotations}
                                            />
                                            {!generationRunning && (
                                              <LessonGenerationErrorRetry
                                                session={session}
                                                retryableInitialFailure={hasRetryableInitialGenerationError}
                                                readableContentAvailable={hasReadableClassroomContent}
                                                retryBlockedReason={waitingForApiKey ? 'api_key' : waitingForSharedQuota ? 'shared_quota' : undefined}
                                                onRetry={retryQueuedGenerationEvent}
                                                onOpenReview={() => changeView('review')}
                                              />
                                            )}
                                            <ClassroomIntentBar
                                              session={session}
                                              dispatch={dispatch}
                                              disabled={intentBarDisabled}
                                              disabledReason={intentBarDisabledReason}
                                              generationFailed={generationProgress.status === 'failed' && !generationRunning}
                                            />
                                          </>
                                        )}
                                      />
                                    </section>
                                  )
                                : (
                                    <section
                                      id={AI_CLASSROOM_VIEW_PANEL_IDS.review}
                                      role="tabpanel"
                                      aria-labelledby={AI_CLASSROOM_VIEW_TAB_IDS.review}
                                    >
                                      <ClassroomReviewView
                                        session={session}
                                        dispatch={dispatch}
                                        lang={lang}
                                        focusConceptId={reviewFocusRequest?.conceptId ?? (previewOnly ? initialTopicResolution.topicId : undefined)}
                                        focusRequestKey={reviewFocusRequest?.key}
                                        previewOnly={previewOnly}
                                        lessonGenerationPending={generationRunning || waitingForApiKey || waitingForSharedQuota || hasRetryableInitialGenerationError}
                                        onOpenChat={openChat}
                                        onActiveConceptChange={previewOnly ? updateReviewActiveConcept : undefined}
                                        onReviewCheckQueued={() => {
                                          returnToLive({ focusGeneration: true })
                                        }}
                                        onReturnToLive={(options) => {
                                          returnToLive({
                                            focusCurrentExercise: options?.focus === 'current_exercise',
                                            focusGeneration: options?.focus === 'generation',
                                            focusContinue: options?.focus === 'continue',
                                            startConceptId: options?.conceptId,
                                          })
                                        }}
                                      />
                                    </section>
                                  )}
                            </div>
                          )}
                    </ClassroomViewport>
                    {activeView === 'live' && <ClassroomScrollFollower />}
                  </main>
                  {chatOpen && (
                    <ClassroomChatSidebar
                      activeConceptId={chatScopeConceptId}
                      onClose={closeChat}
                      onUseCurrentExerciseContext={setCurrentExerciseChatContext}
                    />
                  )}
                  {/* Existing sessions stay readable and reviewable under an exhausted
                      shared quota; the persistent banner explains the blocked AI work. */}
                  {!hasReadableClassroomContent && <QuotaExhaustedDialog />}
                </div>
              </ClassroomLiveScrollSurfaceProvider>
            </ViewportRefProvider>
          )}
    </div>
  )
}

function generationFocusTargetSignature(
  session: ClassroomSession,
  hasRetryableInitialGenerationError: boolean,
  waitingForApiKey: boolean,
  waitingForSharedQuota: boolean,
) {
  const queueSignature = session.eventQueue
    .map(event => `${event.type}:${event.createdAt}:${event.summary ?? ''}`)
    .join('|')
  if (queueSignature)
    return `queue:${queueSignature}`
  if (hasRetryableInitialGenerationError)
    return 'initial-generation-error'
  if (waitingForApiKey)
    return 'waiting-for-api-key'
  if (waitingForSharedQuota)
    return 'waiting-for-shared-quota'
  return 'runtime-generation'
}

function resolveLiveFocusGenerationRequest(
  requestKey: number,
  generationTargetSignature: string | undefined,
  targetSignatureRef: React.MutableRefObject<string | undefined>,
) {
  if (requestKey <= 0 || !generationTargetSignature)
    return undefined
  if (targetSignatureRef.current === PENDING_GENERATION_FOCUS_TARGET)
    targetSignatureRef.current = generationTargetSignature
  return targetSignatureRef.current === generationTargetSignature
    ? requestKey
    : undefined
}
