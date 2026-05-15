'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClassroomPersistenceQueue, loadClassroomSession } from './persistence'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import type { ClassroomAction } from './reducer'
import type { ClassroomSession } from './types'

interface PersistentClassroomSessionOptions {
  lang: string
}

interface PersistentClassroomSession {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
}

export function usePersistentClassroomSession({ lang }: PersistentClassroomSessionOptions): PersistentClassroomSession {
  const [state, setState] = useState(() => ({
    session: createInitialClassroomSession({ lang }),
    hydrated: false,
  }))
  const queueRef = useRef(createClassroomPersistenceQueue())

  useEffect(() => {
    let cancelled = false
    const fresh = createInitialClassroomSession({ lang })
    queueRef.current = createClassroomPersistenceQueue()
    // Reset immediately on language changes so old classroom state is never shown under the new route.
    // eslint-disable-next-line react/set-state-in-effect
    setState({ session: fresh, hydrated: false })

    loadClassroomSession(lang)
      .then((loaded) => {
        if (cancelled)
          return
        setState({
          session: loaded ?? fresh,
          hydrated: true,
        })
      })
      .catch((error) => {
        console.warn('[AI Classroom] Failed to hydrate session', error)
        if (!cancelled)
          setState({ session: fresh, hydrated: true })
      })

    return () => {
      cancelled = true
      void queueRef.current.flush().finally(() => queueRef.current.cancel())
    }
  }, [lang])

  const dispatch = useCallback<React.Dispatch<ClassroomAction>>((action) => {
    setState((current) => {
      const nextSession = classroomReducer(current.session, action)
      if (nextSession === current.session)
        return current
      if (current.hydrated)
        void queueRef.current.enqueue(nextSession)
      return {
        ...current,
        session: nextSession,
      }
    })
  }, [])

  return {
    session: state.session,
    dispatch,
    hydrated: state.hydrated,
  }
}
