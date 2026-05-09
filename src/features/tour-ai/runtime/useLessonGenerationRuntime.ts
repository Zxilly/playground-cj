'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import type { FlatSection } from '@/tour/types'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { useClassroomAbortScope } from '@/features/tour-ai/context/classroom-abort-scope'
import { useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { createClassroomTransaction } from '@/lib/ai/classroom/transaction'
import type { ClassroomEvent, ClassroomSession } from '@/lib/ai/classroom/types'
import { runLessonGenerationStep } from '@/lib/ai/lesson-generation-runner'
import { useLLMConfig } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import {
  appendLessonGenerationProgress,
  EMPTY_LESSON_GENERATION_PROGRESS,
} from '@/features/tour-ai/state/lesson-generation-progress-state'
import { createLessonGenerationToolkit } from '@/features/tour-ai/agent/tools'
import { textFor } from '@/features/tour-ai/utils/classroom-text'

interface UseLessonGenerationRuntimeProps {
  lang: string
  currentSection: FlatSection | undefined
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
}

export function useLessonGenerationRuntime({
  lang,
  currentSection,
  session,
  dispatch,
  hydrated,
}: UseLessonGenerationRuntimeProps) {
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const scopeSignal = useClassroomAbortScope()
  const { activity, setGenerationRunning } = useClassroomActivity()
  const generationRunning = activity.generationRunning
  const [generationProgress, setGenerationProgress] = useState(EMPTY_LESSON_GENERATION_PROGRESS)
  const hasTriggeredInitialPageOpenRef = useRef(false)
  const activeQueuedEventKeyRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useLLMConfigBootstrap({ reportErrors: false })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runLessonGenerationForEvent = useCallback(async (event: ClassroomEvent, consumeQueuedEvent: boolean): Promise<boolean> => {
    if (!config.apiKey || generationRunning || !mountedRef.current)
      return false
    const localController = new AbortController()
    const mergedSignal = AbortSignal.any([scopeSignal, localController.signal])
    setGenerationRunning(true)
    setGenerationProgress({
      status: 'running',
      expanded: true,
      text: '',
    })
    const transaction = createClassroomTransaction(bridge)
    try {
      const transactionBridge = transaction.bridge
      await runLessonGenerationStep({
        config,
        toolkit: createLessonGenerationToolkit(transactionBridge),
        bridge: transactionBridge,
        event,
        abortSignal: mergedSignal,
        onProgress: (chunk) => {
          queueMicrotask(() => {
            if (mergedSignal.aborted || !mountedRef.current)
              return
            setGenerationProgress(state => appendLessonGenerationProgress(state, chunk))
          })
        },
      })
      if (mergedSignal.aborted || !mountedRef.current) {
        transaction.discard()
        return false
      }
      transaction.commit(consumeQueuedEvent ? [{ type: 'CONSUME_EVENT', now: Date.now() }] : [])
      setGenerationProgress(state => ({
        ...state,
        status: 'completed',
        expanded: false,
      }))
      return true
    }
    catch (error) {
      transaction.discard()
      if (mergedSignal.aborted || !mountedRef.current)
        return false
      const errorMessage = error instanceof Error ? error.message : String(error)
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
      return false
    }
    finally {
      setGenerationRunning(false)
    }
  }, [generationRunning, bridge, config, dispatch, scopeSignal, setGenerationRunning])

  useEffect(() => {
    if (hasTriggeredInitialPageOpenRef.current || !hydrated || !currentSection || !config.apiKey || session.stream.length > 0 || session.eventQueue.length > 0)
      return
    hasTriggeredInitialPageOpenRef.current = true
    void runLessonGenerationForEvent({
      type: 'page_opened',
      createdAt: Date.now(),
      summary: `Opened ${textFor(lang, currentSection.sectionName)}.`,
    }, false)
  }, [config.apiKey, currentSection, hydrated, lang, runLessonGenerationForEvent, session.eventQueue.length, session.stream.length])

  const runQueuedLessonGenerationEvent = useCallback((next: ClassroomEvent | undefined) => {
    if (!next || generationRunning)
      return
    const key = `${next.type}:${next.createdAt}`
    if (activeQueuedEventKeyRef.current === key)
      return
    activeQueuedEventKeyRef.current = key
    void runLessonGenerationForEvent(next, true).then((completed) => {
      if (completed && activeQueuedEventKeyRef.current === key)
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
    retryQueuedGenerationEvent,
    toggleGenerationProgress,
  }
}
