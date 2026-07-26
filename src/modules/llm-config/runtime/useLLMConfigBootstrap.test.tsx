import type { ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveProviderDefaults, SHARED_GATEWAY_BASE_URL } from '@/lib/ai/model-provider'
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

function sharedMetadata({
  model = 'auto-model',
  nextResetAt = 1_700_000_000_000,
  perPeriod = 1_000_000,
  available = 1_000_000,
  exhausted = false,
}: {
  model?: string
  nextResetAt?: number
  perPeriod?: number
  available?: number
  exhausted?: boolean
} = {}) {
  return {
    transport: 'shared-gateway',
    model,
    quota: { nextResetAt, perPeriod, available, exhausted },
  }
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

  it('fetches and applies shared gateway metadata without storing a browser key', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sharedMetadata({ available: 249_900 })))

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('loading')

    await waitFor(() => {
      expect(useLLMConfigStore.getState().config).toMatchObject({
        transport: 'shared-gateway',
        baseURL: SHARED_GATEWAY_BASE_URL,
        apiKey: '',
        model: 'auto-model',
      })
    })
    expect(result.current.status).toBe('ready')
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai-gateway/metadata', { method: 'GET' })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().autoQuota).toEqual({
        nextResetAt: 1_700_000_000_000,
        exhausted: false,
        perPeriod: 1_000_000,
        available: 249_900,
      })
    })
  })

  it('refreshes server-managed config when a persisted automatic key already exists', async () => {
    useLLMConfigStore.setState({
      config: {
        ...resolveProviderDefaults('openai-compatible'),
        baseURL: 'https://old-llm.test',
        apiKey: 'persisted-auto-key',
        model: 'mimo-v2.5-pro',
      },
      keySource: 'auto',
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sharedMetadata({ model: 'deepseek-v4-flash' })))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().config).toMatchObject({
        transport: 'shared-gateway',
        baseURL: SHARED_GATEWAY_BASE_URL,
        apiKey: '',
        model: 'deepseek-v4-flash',
      })
    })
    expect(fetch).toHaveBeenCalledWith('/api/ai-gateway/metadata', { method: 'GET' })
  })

  it('stores the per-period daily budget from the shared gateway metadata response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sharedMetadata()))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().autoQuota).toEqual({
        nextResetAt: 1_700_000_000_000,
        exhausted: false,
        perPeriod: 1_000_000,
        available: 1_000_000,
      })
    })
  })

  it('marks autoQuota as exhausted when the usage probe reports zero available', async () => {
    const nextResetAt = Date.now() + 60_000
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sharedMetadata({
        nextResetAt,
        available: 0,
        exhausted: true,
      })))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      const quota = useLLMConfigStore.getState().autoQuota
      expect(quota?.exhausted).toBe(true)
      expect(quota?.nextResetAt).toBe(nextResetAt)
    })
  })

  it('refreshes shared gateway metadata when an exhausted quota reset moment has already passed', async () => {
    useLLMConfigStore.setState({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1, perPeriod: 1_000_000, available: 0 },
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sharedMetadata({
        nextResetAt: 2_000,
        available: 250_000,
      })))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(useLLMConfigStore.getState().config).toMatchObject({
        transport: 'shared-gateway',
        apiKey: '',
      })
    })
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai-gateway/metadata', { method: 'GET' })
    expect(useLLMConfigStore.getState().autoQuota).toEqual({
      nextResetAt: 2_000,
      exhausted: false,
      perPeriod: 1_000_000,
      available: 250_000,
    })
  })

  it('schedules a shared quota refresh when the reset moment arrives while the page stays open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    useLLMConfigStore.setState({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_500, perPeriod: 1_000_000, available: 0 },
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sharedMetadata({
        nextResetAt: 1_500,
        available: 0,
        exhausted: true,
      })))
      .mockResolvedValueOnce(jsonResponse(sharedMetadata({
        nextResetAt: 2_000,
        available: 250_000,
      })))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/ai-gateway/metadata', { method: 'GET' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    vi.useRealTimers()
    await waitFor(() => {
      expect(useLLMConfigStore.getState().autoQuota).toMatchObject({
        nextResetAt: 2_000,
        exhausted: false,
      })
    })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/ai-gateway/metadata', { method: 'GET' })
  })

  it('reports fetch errors when shared gateway bootstrap fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { status: 503 }))

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'error',
        error: 'Shared gateway metadata request failed: HTTP 503',
      })
    })
    expect(useLLMConfigStore.getState().autoQuota).toBeNull()
  })

  it('does not fetch when the user has configured their own key', () => {
    useLLMConfigStore.setState({
      config: {
        ...resolveProviderDefaults('openai-compatible'),
        apiKey: 'user-key',
      },
      keySource: 'user',
    })

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('ready')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns ready without fetching when the user-key source has no key yet', () => {
    useLLMConfigStore.setState({
      config: resolveProviderDefaults('openai-compatible'),
      keySource: 'user',
    })

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('ready')
    expect(fetch).not.toHaveBeenCalled()
  })
})
