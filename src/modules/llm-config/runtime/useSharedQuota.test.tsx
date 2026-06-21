import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSharedQuota } from '@/modules/llm-config/runtime/useSharedQuota'

const fetchTokenUsageMock = vi.hoisted(() => vi.fn())
vi.mock('@/modules/llm-config/runtime/new-api-client', () => ({
  fetchTokenUsage: fetchTokenUsageMock,
}))

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
    fetchTokenUsageMock.mockReset()
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
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ apiKey: 'shared-key', quota: { perPeriod: 1_000_000 } }))
    fetchTokenUsageMock.mockResolvedValue({
      ok: true,
      usage: { totalGranted: 2_000_000, totalUsed: 1_750_000, totalAvailable: 250_000 },
    })

    const { result } = renderHook(() => useSharedQuota(true))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current).toEqual({ percent: 25, loading: false }))
    expect(fetch).toHaveBeenCalledWith('/api/ai-key', { method: 'GET' })
    expect(fetchTokenUsageMock).toHaveBeenCalledWith('shared-key')
  })

  it('clamps to 100 when available exceeds the period budget', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ apiKey: 'shared-key', quota: { perPeriod: 1_000_000 } }))
    fetchTokenUsageMock.mockResolvedValue({
      ok: true,
      usage: { totalGranted: 1_200_000, totalUsed: 0, totalAvailable: 1_200_000 },
    })

    const { result } = renderHook(() => useSharedQuota(true))

    await waitFor(() => expect(result.current).toEqual({ percent: 100, loading: false }))
  })

  it('resolves to no percentage (and stops loading) when the usage probe fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ apiKey: 'shared-key', quota: { perPeriod: 1_000_000 } }))
    fetchTokenUsageMock.mockResolvedValue({ ok: false, error: 'HTTP 500' })

    const { result } = renderHook(() => useSharedQuota(true))

    await waitFor(() => expect(result.current).toEqual({ percent: null, loading: false }))
  })

  it('resolves to no percentage when the key response omits perPeriod', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ apiKey: 'shared-key', quota: {} }))

    const { result } = renderHook(() => useSharedQuota(true))

    await waitFor(() => expect(result.current).toEqual({ percent: null, loading: false }))
    expect(fetchTokenUsageMock).not.toHaveBeenCalled()
  })
})
