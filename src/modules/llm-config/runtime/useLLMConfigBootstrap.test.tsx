import type { ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return {
    ok: !init?.status || (init.status >= 200 && init.status < 300),
    status: init?.status ?? 200,
    json: async () => body,
  } as Response
}

describe('useLLMConfigBootstrap', () => {
  beforeEach(() => {
    useLLMConfigStore.setState({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: null,
      settingsDialogOpen: false,
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('fetches and applies an automatic key when no key is configured', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        baseURL: 'https://llm.test',
        apiKey: 'auto-key',
        model: 'auto-model',
        quota: { nextResetAt: 1_700_000_000_000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: { total_granted: 250000, total_used: 100, total_available: 249900 },
      }))

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('loading')

    await waitFor(() => {
      expect(useLLMConfigStore.getState().config.apiKey).toBe('auto-key')
    })
    expect(result.current.status).toBe('ready')
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai-key', { method: 'GET' })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().autoQuota).toEqual({
        nextResetAt: 1_700_000_000_000,
        exhausted: false,
      })
    })
  })

  it('stores the per-period daily budget from the ai-key response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        baseURL: 'https://llm.test',
        apiKey: 'auto-key',
        model: 'auto-model',
        quota: { nextResetAt: 1_700_000_000_000, perPeriod: 1_000_000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: { total_granted: 2_093_700, total_used: 1_093_700, total_available: 1_000_000 },
      }))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().autoQuota).toEqual({
        nextResetAt: 1_700_000_000_000,
        exhausted: false,
        perPeriod: 1_000_000,
      })
    })
  })

  it('marks autoQuota as exhausted when the usage probe reports zero available', async () => {
    const nextResetAt = Date.now() + 60_000
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        baseURL: 'https://llm.test',
        apiKey: 'auto-key',
        model: 'auto-model',
        quota: { nextResetAt },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: { total_granted: 250000, total_used: 250000, total_available: 0 },
      }))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      const quota = useLLMConfigStore.getState().autoQuota
      expect(quota?.exhausted).toBe(true)
      expect(quota?.nextResetAt).toBe(nextResetAt)
    })
  })

  it('refreshes the automatic key when an exhausted quota reset moment has already passed', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'stale-auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1 },
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        baseURL: 'https://llm.test',
        apiKey: 'fresh-auto-key',
        model: 'auto-model',
        quota: { nextResetAt: 2_000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: { total_granted: 250000, total_used: 0, total_available: 250000 },
      }))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().config.apiKey).toBe('fresh-auto-key')
    })
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai-key', { method: 'GET' })
    expect(useLLMConfigStore.getState().autoQuota).toEqual({
      nextResetAt: 2_000,
      exhausted: false,
    })
  })

  it('schedules a shared quota refresh when the reset moment arrives while the page stays open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'stale-auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_500 },
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        baseURL: 'https://llm.test',
        apiKey: 'fresh-auto-key',
        model: 'auto-model',
        quota: { nextResetAt: 2_000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: { total_granted: 250000, total_used: 0, total_available: 250000 },
      }))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(fetch).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    vi.useRealTimers()
    await waitFor(() => {
      expect(useLLMConfigStore.getState().config.apiKey).toBe('fresh-auto-key')
    })
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai-key', { method: 'GET' })
  })

  it('reports fetch errors when automatic key bootstrap fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { status: 503 }))

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', error: 'HTTP 503' })
    })
    expect(useLLMConfigStore.getState().autoQuota).toBeNull()
  })

  it('does not fetch when the user has configured their own key', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'user-key' },
      keySource: 'user',
    })

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('ready')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ready without fetching when the user-key source has no key yet', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: '' },
      keySource: 'user',
    })

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('ready')
    expect(fetch).not.toHaveBeenCalled()
  })
})
