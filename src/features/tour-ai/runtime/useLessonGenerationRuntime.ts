'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { useClassroomAbortScope } from '@/features/tour-ai/context/classroom-abort-scope'
import { useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { createClassroomTransaction } from '@/lib/ai/classroom/transaction'
import type { ClassroomEvent, ClassroomSession } from '@/lib/ai/classroom/types'
import { runLessonGenerationStep } from '@/lib/ai/lesson-generation-runner'
import { isQuotaExhaustedError } from '@/lib/ai/quota-error'
import { nextResetAtMs } from '@/lib/quota-reset'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import {
  appendLessonGenerationProgress,
  EMPTY_LESSON_GENERATION_PROGRESS,
} from '@/features/tour-ai/state/lesson-generation-progress-state'
import { createLessonGenerationToolkit } from '@/features/tour-ai/agent/tools'

interface UseLessonGenerationRuntimeProps {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  enabled?: boolean
  /**
   * Optional topic seed (typically a conceptId, e.g. `cj.var.immutable`) that
   * gets folded into the initial `classroom_opened` event summary so the
   * lesson agent knows where to anchor the very first session. Set by the
   * `?topic=` deep-link path from the tutorial header.
   */
  initialTopic?: string
}

type LessonGenerationRunOutcome = 'completed' | 'failed' | 'skipped' | 'aborted' | 'shared_quota_blocked'
export type LessonGenerationRecoveryReason = 'shared_quota_auto' | 'shared_quota_user_key'

export const LESSON_GENERATION_STALLED_AFTER_MS = 20_000

function learnerFacingErrorMessage(_error: unknown): string {
  return t`准备下一步失败。请重试。`
}

export function useLessonGenerationRuntime({
  session,
  dispatch,
  hydrated,
  enabled = true,
  initialTopic,
}: UseLessonGenerationRuntimeProps) {
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const keySource = useLLMConfigStore(s => s.keySource)
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const scopeSignal = useClassroomAbortScope()
  const { activity, beginGenerationRun, endGenerationRun } = useClassroomActivity()
  const generationRunning = activity.generationRunning
  const [generationProgress, setGenerationProgress] = useState(EMPTY_LESSON_GENERATION_PROGRESS)
  const [generationStalled, setGenerationStalled] = useState(false)
  const [generationRecoveryReason, setGenerationRecoveryReason] = useState<LessonGenerationRecoveryReason | null>(null)
  const hasTriggeredInitialOpenRef = useRef(false)
  const hasAppliedTopicEntryRef = useRef(false)
  const activeQueuedEventKeyRef = useRef<string | null>(null)
  const inFlightGenerationRef = useRef<string | null>(null)
  const sharedQuotaPendingRef = useRef(false)
  const stalledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const [failedInitialEvent, setFailedInitialEvent] = useState<ClassroomEvent | null>(null)
  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const configReady = isLLMConfigReady(config)
  const hasInitialGenerationRequest = enabled
    && hydrated
    && !hasTriggeredInitialOpenRef.current
    && failedInitialEvent == null
    && session.stream.length === 0
    && session.eventQueue.length === 0
  const hasPendingGenerationRequest = session.eventQueue.length > 0 || failedInitialEvent != null || hasInitialGenerationRequest

  useLLMConfigBootstrap({ reportErrors: false })

  const clearStalledTimer = useCallback(() => {
    if (stalledTimeoutRef.current == null)
      return
    clearTimeout(stalledTimeoutRef.current)
    stalledTimeoutRef.current = null
  }, [])

  const scheduleStalledTimer = useCallback(() => {
    clearStalledTimer()
    setGenerationStalled(false)
    stalledTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current || inFlightGenerationRef.current == null)
        return
      setGenerationStalled(true)
    }, LESSON_GENERATION_STALLED_AFTER_MS)
  }, [clearStalledTimer])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearStalledTimer()
    }
  }, [clearStalledTimer])

  useEffect(() => {
    if (!hydrated || !hasPendingGenerationRequest) {
      sharedQuotaPendingRef.current = false
      return
    }
    if (sharedQuotaExhausted)
      sharedQuotaPendingRef.current = true
  }, [hasPendingGenerationRequest, hydrated, sharedQuotaExhausted])

  const runLessonGenerationForEvent = useCallback(async (
    event: ClassroomEvent,
    consumeQueuedEvent: boolean,
    runKey: string,
  ): Promise<LessonGenerationRunOutcome> => {
    if (!configReady || sharedQuotaExhausted || !mountedRef.current)
      return 'skipped'
    if (inFlightGenerationRef.current !== null)
      return 'skipped'
    inFlightGenerationRef.current = runKey
    beginGenerationRun(runKey)
    const resumedFromSharedQuota = sharedQuotaPendingRef.current
    sharedQuotaPendingRef.current = false
    setGenerationRecoveryReason(resumedFromSharedQuota
      ? keySource === 'auto' ? 'shared_quota_auto' : 'shared_quota_user_key'
      : null)
    setGenerationProgress({
      status: 'running',
      expanded: true,
      text: '',
      items: [],
    })
    scheduleStalledTimer()
    const transaction = createClassroomTransaction(bridge)
    try {
      const transactionBridge = transaction.bridge
      await runLessonGenerationStep({
        config,
        toolkit: createLessonGenerationToolkit(transactionBridge),
        bridge: transactionBridge,
        event,
        abortSignal: scopeSignal,
        onProgress: (chunk) => {
          queueMicrotask(() => {
            if (scopeSignal.aborted || !mountedRef.current)
              return
            scheduleStalledTimer()
            // eslint-disable-next-line react/set-state-in-effect -- Progress chunks come from the agent stream callback, outside React effects.
            setGenerationProgress(state => appendLessonGenerationProgress(state, chunk, session.lang))
          })
        },
      })
      if (scopeSignal.aborted || !mountedRef.current) {
        transaction.discard()
        return 'aborted'
      }
      const recoveredAt = Date.now()
      transaction.commit([
        ...(consumeQueuedEvent ? [{ type: 'CONSUME_EVENT' as const, now: recoveredAt }] : []),
        { type: 'CLEAR_LESSON_GENERATION_ERRORS', now: recoveredAt },
      ])
      if (!consumeQueuedEvent)
        setFailedInitialEvent(null)
      setGenerationProgress(state => ({
        ...state,
        status: 'completed',
        expanded: false,
      }))
      return 'completed'
    }
    catch (error) {
      transaction.discard()
      if (scopeSignal.aborted || !mountedRef.current)
        return 'aborted'
      const quotaExhausted = isQuotaExhaustedError(error)
      let blockedBySharedQuota = false
      if (quotaExhausted) {
        // Surface the exhausted state to the store so QuotaExhaustedDialog opens
        // even when bootstrap probed a non-empty balance and the quota only ran
        // out during this run. User-key keySource stays untouched — that key is
        // not ours to gate, the raw error message will tell the user it's empty.
        const store = useLLMConfigStore.getState()
        if (store.keySource === 'auto') {
          const nextResetAt = store.autoQuota?.nextResetAt ?? nextResetAtMs(Date.now())
          store.setAutoQuota({ nextResetAt, exhausted: true })
          blockedBySharedQuota = true
        }
      }
      setGenerationRecoveryReason(null)
      const errorMessage = quotaExhausted
        ? t`AI 额度不足`
        : learnerFacingErrorMessage(error)
      dispatch({
        type: 'LESSON_GENERATION_FAILED',
        error: errorMessage,
        now: Date.now(),
      })
      if (!consumeQueuedEvent)
        setFailedInitialEvent(event)
      setGenerationProgress(state => appendLessonGenerationProgress({
        ...state,
        status: 'failed',
        expanded: true,
      }, t`\n失败：${errorMessage}`, session.lang))
      return blockedBySharedQuota ? 'shared_quota_blocked' : 'failed'
    }
    finally {
      clearStalledTimer()
      if (mountedRef.current)
        setGenerationStalled(false)
      if (inFlightGenerationRef.current === runKey)
        inFlightGenerationRef.current = null
      endGenerationRun(runKey)
    }
  }, [beginGenerationRun, bridge, clearStalledTimer, config, configReady, dispatch, endGenerationRun, keySource, scheduleStalledTimer, scopeSignal, session.lang, sharedQuotaExhausted])

  useEffect(() => {
    if (hasTriggeredInitialOpenRef.current)
      return
    if (!enabled)
      return
    if (!hydrated || !configReady || sharedQuotaExhausted)
      return
    if (session.stream.length > 0 || session.eventQueue.length > 0)
      return

    hasTriggeredInitialOpenRef.current = true
    // Deep-link from the tutorial ("learn `cj.var.immutable` with AI"): pass
    // the requested concept id through so the agent anchors the opening
    // lesson on that topic instead of a generic intro.
    const summary = initialTopic
      ? `Classroom opened. Learner requested to start with topic: ${initialTopic}`
      : 'Classroom opened.'
    const classroomOpenedEvent: ClassroomEvent = {
      type: 'classroom_opened',
      createdAt: Date.now(),
      summary,
    }
    if (initialTopic)
      classroomOpenedEvent.requestedConceptId = initialTopic
    void runLessonGenerationForEvent(classroomOpenedEvent, false, 'initial:classroom_opened')
  }, [configReady, enabled, hydrated, initialTopic, runLessonGenerationForEvent, session.eventQueue.length, session.stream.length, sharedQuotaExhausted])

  useEffect(() => {
    if (hasAppliedTopicEntryRef.current)
      return
    if (!enabled)
      return
    if (!hydrated || !initialTopic)
      return
    if (failedInitialEvent != null || session.eventQueue.length > 0)
      return
    if (session.stream.length === 0)
      return
    if (session.track.targetConceptId === initialTopic || session.currentExercise?.conceptIds.includes(initialTopic))
      return

    hasAppliedTopicEntryRef.current = true
    dispatch({
      type: 'EMIT_CHAT_INTENT',
      intent: 'change_topic',
      summary: `Learner entered AI Classroom from Static Tour topic: ${initialTopic}`,
      activeConceptId: initialTopic,
      now: Date.now(),
    })
  }, [dispatch, enabled, failedInitialEvent, hydrated, initialTopic, session.currentExercise?.conceptIds, session.eventQueue.length, session.stream.length, session.track.targetConceptId])

  const runQueuedLessonGenerationEvent = useCallback((next: ClassroomEvent | undefined) => {
    if (!enabled)
      return
    if (!next || generationRunning || sharedQuotaExhausted)
      return
    const key = `${next.type}:${next.createdAt}`
    if (activeQueuedEventKeyRef.current === key)
      return
    activeQueuedEventKeyRef.current = key
    void runLessonGenerationForEvent(next, true, key).then((outcome) => {
      if ((outcome === 'completed' || outcome === 'skipped' || outcome === 'aborted' || outcome === 'shared_quota_blocked') && activeQueuedEventKeyRef.current === key)
        activeQueuedEventKeyRef.current = null
    })
  }, [enabled, generationRunning, runLessonGenerationForEvent, sharedQuotaExhausted])

  useEffect(() => {
    runQueuedLessonGenerationEvent(session.eventQueue[0])
  }, [runQueuedLessonGenerationEvent, session.eventQueue])

  useEffect(() => {
    if (!enabled || !hydrated || !failedInitialEvent)
      return
    if (!configReady || sharedQuotaExhausted || generationRunning || session.eventQueue.length > 0)
      return
    if (!sharedQuotaPendingRef.current)
      return

    void runLessonGenerationForEvent(
      failedInitialEvent,
      false,
      `retry:shared-quota:${failedInitialEvent.type}:${Date.now()}`,
    )
  }, [configReady, enabled, failedInitialEvent, generationRunning, hydrated, runLessonGenerationForEvent, session.eventQueue.length, sharedQuotaExhausted])

  const retryQueuedGenerationEvent = useCallback(() => {
    activeQueuedEventKeyRef.current = null
    const nextQueuedEvent = session.eventQueue[0]
    if (nextQueuedEvent) {
      runQueuedLessonGenerationEvent(nextQueuedEvent)
      return
    }
    if (!failedInitialEvent || generationRunning || sharedQuotaExhausted)
      return
    void runLessonGenerationForEvent(
      failedInitialEvent,
      false,
      `retry:${failedInitialEvent.type}:${Date.now()}`,
    )
  }, [failedInitialEvent, generationRunning, runLessonGenerationForEvent, runQueuedLessonGenerationEvent, session.eventQueue, sharedQuotaExhausted])

  const toggleGenerationProgress = useCallback(() => {
    setGenerationProgress(state => ({ ...state, expanded: !state.expanded }))
  }, [])

  return {
    generationRunning,
    generationProgress,
    generationRecoveryReason,
    generationStalled,
    waitingForApiKey: hydrated && hasPendingGenerationRequest && !configReady,
    waitingForSharedQuota: hydrated && hasPendingGenerationRequest && sharedQuotaExhausted,
    hasRetryableInitialGenerationError: failedInitialEvent != null,
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
  }
}
