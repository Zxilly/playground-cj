'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clearClassroomSession, createClassroomPersistenceQueue, loadClassroomSession } from './persistence'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import type { ClassroomAction } from './reducer'
import type { ClassroomSession } from './types'

interface PersistentClassroomSessionOptions {
  lang: string
}

export type ClassroomSessionHydrationIssue = 'failed' | 'timeout'
export type ClassroomSessionSaveIssue = 'failed' | 'clear_failed'

interface PersistentClassroomSession {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  hydrationIssue: ClassroomSessionHydrationIssue | null
  saveIssue: ClassroomSessionSaveIssue | null
  markTemporarySessionInUse: () => void
  retrySave: () => Promise<void>
  resetSession: () => void
}

export const CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS = 8000

export function usePersistentClassroomSession({ lang }: PersistentClassroomSessionOptions): PersistentClassroomSession {
  const [state, setState] = useState(() => ({
    session: createInitialClassroomSession({ lang }),
    hydrated: false,
    hydrationIssue: null as ClassroomSessionHydrationIssue | null,
    saveIssue: null as ClassroomSessionSaveIssue | null,
  }))
  const queueTokenRef = useRef(0)
  const queueRef = useRef<ReturnType<typeof createClassroomPersistenceQueue> | null>(null)
  const temporarySessionEditedRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const createTrackedQueue = useCallback((token: number) => createClassroomPersistenceQueue({
    onSaveFailed: () => {
      if (queueTokenRef.current !== token)
        return
      // eslint-disable-next-line react/set-state-in-effect -- Persistence callbacks report async save outcomes from the queue.
      setState(current => current.saveIssue === 'failed'
        ? current
        : { ...current, saveIssue: 'failed' })
    },
    onSaveSucceeded: () => {
      if (queueTokenRef.current !== token)
        return
      // eslint-disable-next-line react/set-state-in-effect -- Persistence callbacks report async save outcomes from the queue.
      setState(current => current.saveIssue == null && current.hydrationIssue == null
        ? current
        : { ...current, hydrationIssue: null, saveIssue: null })
    },
  }), [])

  queueRef.current ??= createTrackedQueue(queueTokenRef.current)

  useEffect(() => {
    let cancelled = false
    let settled = false
    let timedOut = false
    const fresh = createInitialClassroomSession({ lang })
    const token = queueTokenRef.current + 1
    queueTokenRef.current = token
    temporarySessionEditedRef.current = false
    const queue = createTrackedQueue(token)
    queueRef.current = queue
    // Reset immediately on language changes so old classroom state is never shown under the new route.
    // eslint-disable-next-line react/set-state-in-effect
    setState({ session: fresh, hydrated: false, hydrationIssue: null, saveIssue: null })

    const timeout = window.setTimeout(() => {
      if (cancelled || settled)
        return
      timedOut = true
      console.warn('[AI Classroom] Timed out while hydrating session')
      setState({ session: fresh, hydrated: true, hydrationIssue: 'timeout', saveIssue: null })
    }, CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS)

    loadClassroomSession(lang)
      .then((loaded) => {
        if (cancelled || settled)
          return
        settled = true
        window.clearTimeout(timeout)
        if (timedOut && temporarySessionEditedRef.current)
          return
        setState({
          session: loaded ?? fresh,
          hydrated: true,
          hydrationIssue: null,
          saveIssue: null,
        })
      })
      .catch((error) => {
        if (cancelled || settled)
          return
        settled = true
        window.clearTimeout(timeout)
        if (timedOut)
          return
        console.warn('[AI Classroom] Failed to hydrate session', error)
        setState({ session: fresh, hydrated: true, hydrationIssue: 'failed', saveIssue: null })
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      void queue.flush().finally(() => queue.cancel())
    }
  }, [createTrackedQueue, lang])

  const dispatch = useCallback<React.Dispatch<ClassroomAction>>((action) => {
    setState((current) => {
      const nextSession = classroomReducer(current.session, action)
      if (nextSession === current.session)
        return current
      if (current.hydrationIssue === 'timeout')
        temporarySessionEditedRef.current = true
      if (current.hydrated)
        void queueRef.current?.enqueue(nextSession)
      return {
        ...current,
        session: nextSession,
      }
    })
  }, [])

  const retrySave = useCallback(() => {
    const queue = queueRef.current
    const current = stateRef.current
    if (!queue || !current.hydrated)
      return Promise.resolve()

    return queue.enqueue(current.session)
  }, [])

  const markTemporarySessionInUse = useCallback(() => {
    setState((current) => {
      if (current.hydrationIssue === 'timeout')
        temporarySessionEditedRef.current = true
      return current
    })
  }, [])

  const resetSession = useCallback(() => {
    const token = queueTokenRef.current + 1
    queueTokenRef.current = token
    temporarySessionEditedRef.current = false
    queueRef.current?.cancel()
    queueRef.current = createTrackedQueue(token)
    const fresh = createInitialClassroomSession({ lang })

    setState({
      session: fresh,
      hydrated: true,
      hydrationIssue: null,
      saveIssue: null,
    })

    void clearClassroomSession(lang).catch((error) => {
      if (queueTokenRef.current !== token)
        return
      console.warn('[AI Classroom] Failed to clear persisted session', error)
      setState(current => current.saveIssue === 'clear_failed'
        ? current
        : { ...current, saveIssue: 'clear_failed' })
    })
  }, [createTrackedQueue, lang])

  return {
    session: state.session,
    dispatch,
    hydrated: state.hydrated,
    hydrationIssue: state.hydrationIssue,
    saveIssue: state.saveIssue,
    markTemporarySessionInUse,
    retrySave,
    resetSession,
  }
}
