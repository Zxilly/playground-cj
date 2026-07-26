import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSharedQuota } from '@/modules/llm-config/runtime/useSharedQuota'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return {
    ok: !init?.status || (init.status >= 200 && init.status < 300),
    status: init?.status ?? 200,
    json: async () => body,
  } as Response
}

describe('useSharedQuota', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is idle and does not fetch while inactive', () => {
    const { result } = renderHook(() => useSharedQuota(false))
    expect(result.current).toEqual({ percent: null, loading: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports loading immediately, then the computed percentage', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 2_000,
        perPeriod: 1_000_000,
        available: 250_000,
        exhausted: false,
      },
    }))

    const { result } = renderHook(() => useSharedQuota(true))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current).toEqual({ percent: 25, loading: false }))
    expect(fetch).toHaveBeenCalledWith('/api/ai-key', { method: 'GET' })
  })

  it('reports 100 when the full period budget is available', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 2_000,
        perPeriod: 1_000_000,
        available: 1_000_000,
        exhausted: false,
      },
    }))

    const { result } = renderHook(() => useSharedQuota(true))

    await waitFor(() => expect(result.current).toEqual({ percent: 100, loading: false }))
  })

  it('resolves to no percentage (and stops loading) when the usage probe fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { status: 500 }))

    const { result } = renderHook(() => useSharedQuota(true))

    await waitFor(() => expect(result.current).toEqual({ percent: null, loading: false }))
  })

  it('resolves to no percentage when the key response omits perPeriod', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {},
    }))

    const { result } = renderHook(() => useSharedQuota(true))

    await waitFor(() => expect(result.current).toEqual({ percent: null, loading: false }))
  })
})
