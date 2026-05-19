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
import {
  appendLessonGenerationProgress,
  EMPTY_LESSON_GENERATION_PROGRESS,
} from '@/features/tour-ai/state/lesson-generation-progress-state'
import { createLessonGenerationToolkit } from '@/features/tour-ai/agent/tools'

interface UseLessonGenerationRuntimeProps {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  /**
   * Optional topic seed (typically a conceptId, e.g. `cj.var.immutable`) that
   * gets folded into the initial `classroom_opened` event summary so the
   * lesson agent knows where to anchor the very first session. Set by the
   * `?topic=` deep-link path from the tutorial header.
   */
  initialTopic?: string
}

type LessonGenerationRunOutcome = 'completed' | 'failed' | 'skipped' | 'aborted'

export function useLessonGenerationRuntime({
  session,
  dispatch,
  hydrated,
  initialTopic,
}: UseLessonGenerationRuntimeProps) {
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const scopeSignal = useClassroomAbortScope()
  const { activity, beginGenerationRun, endGenerationRun } = useClassroomActivity()
  const generationRunning = activity.generationRunning
  const [generationProgress, setGenerationProgress] = useState(EMPTY_LESSON_GENERATION_PROGRESS)
  const hasTriggeredInitialOpenRef = useRef(false)
  const activeQueuedEventKeyRef = useRef<string | null>(null)
  const inFlightGenerationRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useLLMConfigBootstrap({ reportErrors: false })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runLessonGenerationForEvent = useCallback(async (
    event: ClassroomEvent,
    consumeQueuedEvent: boolean,
    runKey: string,
  ): Promise<LessonGenerationRunOutcome> => {
    if (!config.apiKey || !mountedRef.current)
      return 'skipped'
    if (inFlightGenerationRef.current !== null)
      return 'skipped'
    inFlightGenerationRef.current = runKey
    beginGenerationRun(runKey)
    setGenerationProgress({
      status: 'running',
      expanded: true,
      text: '',
      items: [],
    })
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
            // eslint-disable-next-line react/set-state-in-effect -- Progress chunks come from the agent stream callback, outside React effects.
            setGenerationProgress(state => appendLessonGenerationProgress(state, chunk))
          })
        },
      })
      if (scopeSignal.aborted || !mountedRef.current) {
        transaction.discard()
        return 'aborted'
      }
      transaction.commit(consumeQueuedEvent ? [{ type: 'CONSUME_EVENT', now: Date.now() }] : [])
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
      if (quotaExhausted) {
        // Surface the exhausted state to the store so QuotaExhaustedDialog opens
        // even when bootstrap probed a non-empty balance and the quota only ran
        // out during this run. User-key keySource stays untouched — that key is
        // not ours to gate, the raw error message will tell the user it's empty.
        const store = useLLMConfigStore.getState()
        if (store.keySource === 'auto') {
          const nextResetAt = store.autoQuota?.nextResetAt ?? nextResetAtMs(Date.now())
          store.setAutoQuota({ nextResetAt, exhausted: true })
        }
      }
      const errorMessage = quotaExhausted
        ? t`AI 额度不足`
        : error instanceof Error ? error.message : String(error)
      dispatch({
        type: 'LESSON_GENERATION_FAILED',
        error: errorMessage,
        now: Date.now(),
      })
      setGenerationProgress(state => appendLessonGenerationProgress({
        ...state,
        status: 'failed',
        expanded: true,
      }, t`\n失败：${errorMessage}`))
      return 'failed'
    }
    finally {
      if (inFlightGenerationRef.current === runKey)
        inFlightGenerationRef.current = null
      endGenerationRun(runKey)
    }
  }, [beginGenerationRun, bridge, config, dispatch, endGenerationRun, scopeSignal])

  useEffect(() => {
    if (hasTriggeredInitialOpenRef.current)
      return
    if (!hydrated || !config.apiKey)
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
    void runLessonGenerationForEvent({
      type: 'classroom_opened',
      createdAt: Date.now(),
      summary,
    }, false, 'initial:classroom_opened')
  }, [config.apiKey, hydrated, initialTopic, runLessonGenerationForEvent, session.eventQueue.length, session.stream.length])

  const runQueuedLessonGenerationEvent = useCallback((next: ClassroomEvent | undefined) => {
    if (!next || generationRunning)
      return
    const key = `${next.type}:${next.createdAt}`
    if (activeQueuedEventKeyRef.current === key)
      return
    activeQueuedEventKeyRef.current = key
    void runLessonGenerationForEvent(next, true, key).then((outcome) => {
      if ((outcome === 'completed' || outcome === 'skipped' || outcome === 'aborted') && activeQueuedEventKeyRef.current === key)
        activeQueuedEventKeyRef.current = null
    })
  }, [generationRunning, runLessonGenerationForEvent])

  useEffect(() => {
    runQueuedLessonGenerationEvent(session.eventQueue[0])
  }, [runQueuedLessonGenerationEvent, session.eventQueue])

  const retryQueuedGenerationEvent = useCallback(() => {
    activeQueuedEventKeyRef.current = null
    runQueuedLessonGenerationEvent(session.eventQueue[0])
  }, [runQueuedLessonGenerationEvent, session.eventQueue])

  const toggleGenerationProgress = useCallback(() => {
    setGenerationProgress(state => ({ ...state, expanded: !state.expanded }))
  }, [])

  return {
    generationRunning,
    generationProgress,
    waitingForApiKey: hydrated && session.eventQueue.length > 0 && !config.apiKey,
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
  }
}
