import type { ReactNode } from 'react'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
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

  it('marks autoQuota as exhausted when the usage probe reports zero available', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        baseURL: 'https://llm.test',
        apiKey: 'auto-key',
        model: 'auto-model',
        quota: { nextResetAt: 1_700_000_000_000 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: { total_granted: 250000, total_used: 250000, total_available: 0 },
      }))

    renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      const quota = useLLMConfigStore.getState().autoQuota
      expect(quota?.exhausted).toBe(true)
      expect(quota?.nextResetAt).toBe(1_700_000_000_000)
    })
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
})
