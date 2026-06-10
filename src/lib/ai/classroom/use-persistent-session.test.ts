import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialClassroomSession } from './reducer'
import { CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS, usePersistentClassroomSession } from './use-persistent-session'
import type { ClassroomSession } from './types'

const reactActGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true

const loadClassroomSessionMock = vi.hoisted(() => vi.fn())
const clearClassroomSessionMock = vi.hoisted(() => vi.fn())
const enqueueMock = vi.hoisted(() => vi.fn())
const flushMock = vi.hoisted(() => vi.fn())
const cancelMock = vi.hoisted(() => vi.fn())
const queueOptionsRef = vi.hoisted(() => ({ current: null as null | {
  onSaveFailed?: (error: unknown) => void
  onSaveSucceeded?: () => void
} }))

vi.mock('./persistence', () => ({
  loadClassroomSession: loadClassroomSessionMock,
  clearClassroomSession: clearClassroomSessionMock,
  createClassroomPersistenceQueue: vi.fn((options?: unknown) => {
    queueOptionsRef.current = typeof options === 'object' && options != null
      ? options as typeof queueOptionsRef.current
      : null
    return {
      enqueue: enqueueMock,
      flush: flushMock,
      cancel: cancelMock,
    }
  }),
}))

describe('usePersistentClassroomSession', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    loadClassroomSessionMock.mockReset()
    clearClassroomSessionMock.mockReset()
    clearClassroomSessionMock.mockResolvedValue(undefined)
    enqueueMock.mockReset()
    flushMock.mockReset()
    flushMock.mockResolvedValue(undefined)
    cancelMock.mockReset()
    queueOptionsRef.current = null
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('hydrates with the persisted session when one exists', async () => {
    const persisted = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      phase: 'teach',
      sessionSummary: 'Persisted lesson',
    } satisfies ClassroomSession
    loadClassroomSessionMock.mockResolvedValueOnce(persisted)
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
      await flushPromises()
    })

    expect(loadClassroomSessionMock).toHaveBeenCalledWith('zh')
    expect(latest?.hydrated).toBe(true)
    expect(latest?.session).toBe(persisted)
  })

  it('does not persist dispatches before hydration, then persists later updates', async () => {
    loadClassroomSessionMock.mockResolvedValueOnce(null)
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    act(() => {
      root.render(createElement(Harness, {
        lang: 'en',
        onRender: value => latest = value,
      }))
    })
    act(() => {
      latest?.dispatch({ type: 'SET_PHASE', phase: 'teach', now: 1 })
    })

    expect(enqueueMock).not.toHaveBeenCalled()

    await act(async () => {
      await flushPromises()
    })
    act(() => {
      latest?.dispatch({
        type: 'SAVE_REVIEW_ARTIFACT',
        artifact: {
          kind: 'clarification',
          conceptId: 'cj.io.println',
          title: 'Print',
          body: 'Use println.',
          summary: 'println reminder',
          evidenceIds: [],
        },
        now: 2,
      })
    })

    expect(latest?.hydrated).toBe(true)
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      learner: expect.objectContaining({
        reviewArtifacts: [expect.objectContaining({ conceptId: 'cj.io.println' })],
      }),
    }))
  })

  it('does not persist hydrated dispatches that leave the session unchanged', async () => {
    loadClassroomSessionMock.mockResolvedValueOnce(null)
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'en',
        onRender: value => latest = value,
      }))
      await flushPromises()
    })

    act(() => {
      latest?.dispatch({ type: 'EXERCISE_SKIP', now: 2 })
    })

    expect(latest?.hydrated).toBe(true)
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('falls back to a fresh session and warns when hydration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadClassroomSessionMock.mockRejectedValueOnce(new Error('idb unavailable'))
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
      await flushPromises()
    })

    expect(warn).toHaveBeenCalledWith('[AI Classroom] Failed to hydrate session', expect.any(Error))
    expect(latest?.hydrated).toBe(true)
    expect(latest?.hydrationIssue).toBe('failed')
    expect(latest?.session.sessionSummary).toContain('zh')
    warn.mockRestore()
  })

  it('recovers a late persisted session after timeout when the temporary classroom was untouched', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let resolveHydration: ((session: ClassroomSession) => void) | undefined
    const persisted = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      phase: 'teach',
      sessionSummary: 'Late persisted lesson',
    } satisfies ClassroomSession
    loadClassroomSessionMock.mockImplementationOnce(() => new Promise<ClassroomSession>((resolve) => {
      resolveHydration = resolve
    }))
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    act(() => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
    })

    expect(latest?.hydrated).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS)
      await flushMicrotasks()
    })

    expect(warn).toHaveBeenCalledWith('[AI Classroom] Timed out while hydrating session')
    expect(latest?.hydrated).toBe(true)
    expect(latest?.hydrationIssue).toBe('timeout')
    expect(latest?.session.sessionSummary).not.toBe('Late persisted lesson')

    await act(async () => {
      resolveHydration?.(persisted)
      await flushMicrotasks()
    })

    expect(latest?.hydrationIssue).toBeNull()
    expect(latest?.session.sessionSummary).toBe('Late persisted lesson')
    warn.mockRestore()
  })

  it('does not overwrite a temporary classroom when late hydration arrives after learner edits', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let resolveHydration: ((session: ClassroomSession) => void) | undefined
    const persisted = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      phase: 'teach',
      sessionSummary: 'Late persisted lesson',
    } satisfies ClassroomSession
    loadClassroomSessionMock.mockImplementationOnce(() => new Promise<ClassroomSession>((resolve) => {
      resolveHydration = resolve
    }))
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    act(() => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
    })

    await act(async () => {
      vi.advanceTimersByTime(CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS)
      await flushMicrotasks()
    })

    act(() => {
      latest?.dispatch({ type: 'SET_PHASE', phase: 'practice', now: 2 })
    })

    await act(async () => {
      resolveHydration?.(persisted)
      await flushMicrotasks()
    })

    expect(latest?.hydrationIssue).toBe('timeout')
    expect(latest?.session.phase).toBe('practice')
    expect(latest?.session.sessionSummary).not.toBe('Late persisted lesson')
    warn.mockRestore()
  })

  it('clears the temporary hydration warning once the edited classroom is saved', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let resolveHydration: ((session: ClassroomSession) => void) | undefined
    const persisted = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      phase: 'teach',
      sessionSummary: 'Late persisted lesson',
    } satisfies ClassroomSession
    loadClassroomSessionMock.mockImplementationOnce(() => new Promise<ClassroomSession>((resolve) => {
      resolveHydration = resolve
    }))
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    act(() => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
    })

    await act(async () => {
      vi.advanceTimersByTime(CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS)
      await flushMicrotasks()
    })

    expect(latest?.hydrationIssue).toBe('timeout')

    act(() => {
      latest?.dispatch({ type: 'SET_PHASE', phase: 'practice', now: 2 })
    })

    expect(enqueueMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      queueOptionsRef.current?.onSaveSucceeded?.()
      await flushMicrotasks()
    })

    expect(latest?.hydrationIssue).toBeNull()
    expect(latest?.saveIssue).toBeNull()

    await act(async () => {
      resolveHydration?.(persisted)
      await flushMicrotasks()
    })

    expect(latest?.hydrationIssue).toBeNull()
    expect(latest?.session.phase).toBe('practice')
    expect(latest?.session.sessionSummary).not.toBe('Late persisted lesson')
    warn.mockRestore()
  })

  it('does not overwrite a temporary classroom after the learner enters it before any dispatch', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let resolveHydration: ((session: ClassroomSession) => void) | undefined
    const persisted = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      phase: 'teach',
      sessionSummary: 'Late persisted lesson',
    } satisfies ClassroomSession
    loadClassroomSessionMock.mockImplementationOnce(() => new Promise<ClassroomSession>((resolve) => {
      resolveHydration = resolve
    }))
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    act(() => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
    })

    await act(async () => {
      vi.advanceTimersByTime(CLASSROOM_SESSION_HYDRATION_TIMEOUT_MS)
      await flushMicrotasks()
    })

    act(() => {
      latest?.markTemporarySessionInUse()
    })

    await act(async () => {
      resolveHydration?.(persisted)
      await flushMicrotasks()
    })

    expect(latest?.hydrationIssue).toBe('timeout')
    expect(latest?.session.sessionSummary).not.toBe('Late persisted lesson')
    warn.mockRestore()
  })

  it('flushes pending writes before cancelling on lang change cleanup', async () => {
    loadClassroomSessionMock.mockResolvedValue(null)

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: () => {},
      }))
      await flushPromises()
    })

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'en',
        onRender: () => {},
      }))
      await flushPromises()
    })

    expect(flushMock).toHaveBeenCalled()
    expect(cancelMock).toHaveBeenCalled()
    expect(flushMock.mock.invocationCallOrder[0]).toBeLessThan(cancelMock.mock.invocationCallOrder[0])
  })

  it('surfaces save failures and retries saving the current hydrated session', async () => {
    loadClassroomSessionMock.mockResolvedValueOnce(null)
    enqueueMock.mockResolvedValue(undefined)
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
      await flushPromises()
    })

    act(() => {
      latest?.dispatch({
        type: 'SAVE_REVIEW_ARTIFACT',
        artifact: {
          kind: 'clarification',
          conceptId: 'cj.io.println',
          title: 'Print',
          body: 'Use println.',
          summary: 'println reminder',
          evidenceIds: [],
        },
        now: 2,
      })
    })

    expect(enqueueMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      queueOptionsRef.current?.onSaveFailed?.(new Error('idb full'))
      await flushMicrotasks()
    })

    expect(latest?.saveIssue).toBe('failed')

    let retry: Promise<void> | undefined
    act(() => {
      retry = latest?.retrySave()
    })

    expect(enqueueMock).toHaveBeenCalledTimes(2)
    expect(enqueueMock).toHaveBeenLastCalledWith(expect.objectContaining({
      learner: expect.objectContaining({
        reviewArtifacts: [expect.objectContaining({ conceptId: 'cj.io.println' })],
      }),
    }))
    await expect(retry).resolves.toBeUndefined()

    await act(async () => {
      queueOptionsRef.current?.onSaveSucceeded?.()
      await flushMicrotasks()
    })

    expect(latest?.saveIssue).toBeNull()
  })

  it('resets the hydrated classroom and clears the persisted record', async () => {
    const persisted = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      phase: 'teach',
      sessionSummary: 'Persisted lesson',
    } satisfies ClassroomSession
    loadClassroomSessionMock.mockResolvedValueOnce(persisted)
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
      await flushPromises()
    })

    expect(latest?.session.sessionSummary).toBe('Persisted lesson')

    act(() => {
      latest?.resetSession()
    })

    expect(cancelMock).toHaveBeenCalled()
    expect(clearClassroomSessionMock).toHaveBeenCalledWith('zh')
    expect(latest?.hydrated).toBe(true)
    expect(latest?.hydrationIssue).toBeNull()
    expect(latest?.saveIssue).toBeNull()
    expect(latest?.session.sessionSummary).not.toBe('Persisted lesson')
    expect(latest?.session.stream).toEqual([])
  })

  it('surfaces a clear issue when resetting cannot clear the persisted record', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    clearClassroomSessionMock.mockRejectedValueOnce(new Error('idb locked'))
    enqueueMock.mockResolvedValue(undefined)
    loadClassroomSessionMock.mockResolvedValueOnce(null)
    let latest: ReturnType<typeof usePersistentClassroomSession> | undefined

    await act(async () => {
      root.render(createElement(Harness, {
        lang: 'zh',
        onRender: value => latest = value,
      }))
      await flushPromises()
    })

    act(() => {
      latest?.resetSession()
    })
    await act(async () => {
      await flushMicrotasks()
    })

    expect(warn).toHaveBeenCalledWith('[AI Classroom] Failed to clear persisted session', expect.any(Error))
    expect(latest?.saveIssue).toBe('clear_failed')

    let retry: Promise<void> | undefined
    act(() => {
      retry = latest?.retrySave()
    })

    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      stream: [],
    }))
    await expect(retry).resolves.toBeUndefined()

    await act(async () => {
      queueOptionsRef.current?.onSaveSucceeded?.()
      await flushMicrotasks()
    })

    expect(latest?.saveIssue).toBeNull()
    warn.mockRestore()
  })
})

function Harness({
  lang,
  onRender,
}: {
  lang: string
  onRender: (value: ReturnType<typeof usePersistentClassroomSession>) => void
}) {
  const value = usePersistentClassroomSession({ lang })
  onRender(value)
  return null
}

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function flushMicrotasks() {
  return Promise.resolve()
}
