import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspaceResource } from './use-workspace-resource'

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useWorkspaceResource', () => {
  it('loads data and clears the loading flag', async () => {
    const owner = {}
    const { result } = renderHook(() => useWorkspaceResource(owner, 'doc', async () => 'doc', []))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('doc')
  })

  it('degrades to an empty document and clears loading when the read rejects', async () => {
    // #3: a rejected read must not wedge `loading` on forever (which would lock
    // the mission gate) or leak an unhandled rejection.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const owner = {}
    const { result } = renderHook(() =>
      useWorkspaceResource(owner, 'doc', async () => {
        throw new Error('boom')
      }, []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('re-runs when its own scope revision bumps', async () => {
    const load = vi.fn(async () => 'x')
    const owner = {}
    renderHook(() => useWorkspaceResource(owner, 'lessons:list', load, [], 'lessons'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    useWorkspaceStore.getState().bumpRevision('lessons')
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('does NOT re-run when an unrelated scope bumps', async () => {
    const load = vi.fn(async () => 'x')
    const owner = {}
    renderHook(() => useWorkspaceResource(owner, 'lessons:list', load, [], 'lessons'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    // A glossary write must not re-run a lessons-scoped read.
    useWorkspaceStore.getState().bumpRevision('glossary')
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('a default (all) scope read re-runs on any write', async () => {
    const load = vi.fn(async () => 'x')
    const owner = {}
    renderHook(() => useWorkspaceResource(owner, 'doc', load, []))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    useWorkspaceStore.getState().bumpRevision('glossary')
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('reuses a successful read immediately when the same resource remounts', async () => {
    const owner = {}
    const load = vi.fn(async () => 'cached doc')
    const first = renderHook(() => useWorkspaceResource(owner, 'doc', load, []))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    first.unmount()

    const second = renderHook(() => useWorkspaceResource(owner, 'doc', load, []))
    expect(second.result.current).toEqual({ data: 'cached doc', loading: false })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('shares one in-flight read between preload and visible consumers', async () => {
    let resolve!: (value: string) => void
    const load = vi.fn(() => new Promise<string>((done) => {
      resolve = done
    }))
    const owner = {}

    const first = renderHook(() => useWorkspaceResource(owner, 'doc', load, []))
    const second = renderHook(() => useWorkspaceResource(owner, 'doc', load, []))
    expect(load).toHaveBeenCalledTimes(1)

    await act(async () => resolve('shared'))
    await waitFor(() => {
      expect(first.result.current.data).toBe('shared')
      expect(second.result.current.data).toBe('shared')
    })
  })

  it('does not let an older revision overwrite a newer resource value', async () => {
    const pending: Array<(value: string) => void> = []
    const load = vi.fn(() => new Promise<string>((resolve) => {
      pending.push(resolve)
    }))
    const owner = {}
    const view = renderHook(() => useWorkspaceResource(owner, 'doc', load, [], 'notes'))

    expect(load).toHaveBeenCalledTimes(1)
    act(() => useWorkspaceStore.getState().bumpRevision('notes'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))

    await act(async () => pending[1]('new'))
    await waitFor(() => expect(view.result.current.data).toBe('new'))
    await act(async () => pending[0]('stale'))
    expect(view.result.current.data).toBe('new')

    view.unmount()
    const remount = renderHook(() => useWorkspaceResource(owner, 'doc', load, [], 'notes'))
    expect(remount.result.current.data).toBe('new')
  })
})
