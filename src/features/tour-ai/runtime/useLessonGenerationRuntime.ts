'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlatSection } from '@/tour/types'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { createClassroomTransaction } from '@/lib/ai/classroom/transaction'
import type { ClassroomEvent, ClassroomSession } from '@/lib/ai/classroom/types'
import { runLessonAuthorStep } from '@/lib/ai/lesson-author-runner'
import { useLLMConfig } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import {
  appendLessonAuthorProgress,
  EMPTY_AUTHOR_PROGRESS,
} from '@/features/tour-ai/state/lesson-author-progress-state'
import { createLessonAuthorToolkit } from '@/features/tour-ai/agent/tools'
import { textFor } from '@/features/tour-ai/utils/classroom-text'

interface UseLessonAuthorRuntimeProps {
  lang: string
  currentSection: FlatSection | undefined
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
}

export function useLessonAuthorRuntime({
  lang,
  currentSection,
  session,
  dispatch,
  hydrated,
}: UseLessonAuthorRuntimeProps) {
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const [authorRunning, setAuthorRunning] = useState(false)
  const [authorProgress, setAuthorProgress] = useState(EMPTY_AUTHOR_PROGRESS)
  const appendAuthorProgressRef = useRef<(chunk: string) => void>(() => {})
  const hasTriggeredInitialPageOpenRef = useRef(false)
  const activeQueuedEventKeyRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const activeAuthorAbortRef = useRef<AbortController | null>(null)

  useLLMConfigBootstrap({ reportErrors: false })

  appendAuthorProgressRef.current = (chunk: string) => {
    setAuthorProgress(state => appendLessonAuthorProgress(state, chunk))
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      activeAuthorAbortRef.current?.abort()
      activeAuthorAbortRef.current = null
    }
  }, [])

  const runLessonAuthorForEvent = useCallback(async (event: ClassroomEvent, consumeQueuedEvent: boolean): Promise<boolean> => {
    if (!config.apiKey || authorRunning || !mountedRef.current)
      return false
    const abortController = new AbortController()
    activeAuthorAbortRef.current = abortController
    setAuthorRunning(true)
    setAuthorProgress({
      status: 'running',
      expanded: true,
      text: '',
    })
    dispatch({ type: 'LESSON_AUTHOR_STARTED', now: Date.now() })
    const transaction = createClassroomTransaction(bridge)
    try {
      const transactionBridge = transaction.bridge
      await runLessonAuthorStep({
        config,
        toolkit: createLessonAuthorToolkit(transactionBridge),
        bridge: transactionBridge,
        event,
        abortSignal: abortController.signal,
        onProgress: (chunk) => {
          if (abortController.signal.aborted || !mountedRef.current)
            return
          queueMicrotask(() => {
            if (abortController.signal.aborted || !mountedRef.current)
              return
            appendAuthorProgressRef.current(chunk)
          })
        },
      })
      if (abortController.signal.aborted || !mountedRef.current) {
        transaction.discard()
        return false
      }
      transaction.commit(consumeQueuedEvent ? [{ type: 'CONSUME_EVENT', now: Date.now() }] : [])
      setAuthorProgress(state => ({
        ...state,
        status: 'completed',
        expanded: false,
      }))
      return true
    }
    catch (error) {
      transaction.discard()
      if (abortController.signal.aborted || !mountedRef.current)
        return false
      dispatch({
        type: 'LESSON_AUTHOR_FAILED',
        error: (error as Error).message,
        now: Date.now(),
      })
      setAuthorProgress(state => appendLessonAuthorProgress({
        ...state,
        status: 'failed',
        expanded: true,
      }, `\n失败：${(error as Error).message}`))
      return false
    }
    finally {
      if (activeAuthorAbortRef.current === abortController)
        activeAuthorAbortRef.current = null
      if (mountedRef.current)
        setAuthorRunning(false)
    }
  }, [authorRunning, bridge, config, dispatch])

  useEffect(() => {
    if (hasTriggeredInitialPageOpenRef.current || !hydrated || !currentSection || !config.apiKey || session.stream.length > 0 || session.eventQueue.length > 0)
      return
    hasTriggeredInitialPageOpenRef.current = true
    void runLessonAuthorForEvent({
      type: 'page_opened',
      createdAt: Date.now(),
      summary: `Opened ${textFor(lang, currentSection.sectionName)}.`,
    }, false)
  }, [config.apiKey, currentSection, hydrated, lang, runLessonAuthorForEvent, session.eventQueue.length, session.stream.length])

  const runQueuedLessonAuthorEvent = useCallback((next: ClassroomEvent | undefined) => {
    if (!next || authorRunning)
      return
    const key = `${next.type}:${next.createdAt}`
    if (activeQueuedEventKeyRef.current === key)
      return
    activeQueuedEventKeyRef.current = key
    void runLessonAuthorForEvent(next, true).then((completed) => {
      if (completed && activeQueuedEventKeyRef.current === key)
        activeQueuedEventKeyRef.current = null
    })
  }, [authorRunning, runLessonAuthorForEvent])

  useEffect(() => {
    runQueuedLessonAuthorEvent(session.eventQueue[0])
  }, [runQueuedLessonAuthorEvent, session.eventQueue])

  const retryQueuedAuthorEvent = useCallback(() => {
    activeQueuedEventKeyRef.current = null
    runQueuedLessonAuthorEvent(session.eventQueue[0])
  }, [runQueuedLessonAuthorEvent, session.eventQueue])

  const toggleAuthorProgress = useCallback(() => {
    setAuthorProgress(state => ({ ...state, expanded: !state.expanded }))
  }, [])

  return {
    authorRunning,
    authorProgress,
    retryQueuedAuthorEvent,
    toggleAuthorProgress,
  }
}
