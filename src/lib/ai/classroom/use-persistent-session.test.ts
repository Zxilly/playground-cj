import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialClassroomSession } from './reducer'
import { usePersistentClassroomSession } from './use-persistent-session'
import type { ClassroomSession } from './types'

const loadClassroomSessionMock = vi.hoisted(() => vi.fn())
const enqueueMock = vi.hoisted(() => vi.fn())
const flushMock = vi.hoisted(() => vi.fn())
const cancelMock = vi.hoisted(() => vi.fn())

vi.mock('./persistence', () => ({
  loadClassroomSession: loadClassroomSessionMock,
  createClassroomPersistenceQueue: vi.fn(() => ({
    enqueue: enqueueMock,
    flush: flushMock,
    cancel: cancelMock,
  })),
}))

describe('usePersistentClassroomSession', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    loadClassroomSessionMock.mockReset()
    enqueueMock.mockReset()
    flushMock.mockReset()
    flushMock.mockResolvedValue(undefined)
    cancelMock.mockReset()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
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
      latest?.dispatch({ type: 'SET_LEARNING_NOTES', notes: 'Focus on loops', now: 2 })
    })

    expect(latest?.hydrated).toBe(true)
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      learner: expect.objectContaining({ learningNotes: 'Focus on loops' }),
    }))
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
    expect(latest?.session.sessionSummary).toContain('zh')
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
    const flushOrder = flushMock.mock.invocationCallOrder[0]
    const cancelOrder = cancelMock.mock.invocationCallOrder[0]
    expect(flushOrder).toBeLessThan(cancelOrder)
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
