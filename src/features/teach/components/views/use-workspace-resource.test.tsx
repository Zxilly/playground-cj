import { renderHook, waitFor } from '@testing-library/react'
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
    const { result } = renderHook(() => useWorkspaceResource(async () => 'doc', []))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('doc')
  })

  it('degrades to an empty document and clears loading when the read rejects', async () => {
    // #3: a rejected read must not wedge `loading` on forever (which would lock
    // the mission gate) or leak an unhandled rejection.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useWorkspaceResource(async () => {
        throw new Error('boom')
      }, []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('re-runs when its own scope revision bumps', async () => {
    const load = vi.fn(async () => 'x')
    renderHook(() => useWorkspaceResource(load, [], 'lessons'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    useWorkspaceStore.getState().bumpRevision('lessons')
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('does NOT re-run when an unrelated scope bumps', async () => {
    const load = vi.fn(async () => 'x')
    renderHook(() => useWorkspaceResource(load, [], 'lessons'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    // A glossary write must not re-run a lessons-scoped read.
    useWorkspaceStore.getState().bumpRevision('glossary')
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('a default (all) scope read re-runs on any write', async () => {
    const load = vi.fn(async () => 'x')
    renderHook(() => useWorkspaceResource(load, []))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    useWorkspaceStore.getState().bumpRevision('glossary')
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })
})
