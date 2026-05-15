import type { ReactNode } from 'react'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

describe('useLLMConfigBootstrap', () => {
  beforeEach(() => {
    useLLMConfigStore.setState({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('fetches and applies an automatic key when no key is configured', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ baseURL: 'https://llm.test', apiKey: 'auto-key', model: 'auto-model' }),
    } as Response)

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    expect(result.current.status).toBe('loading')

    await waitFor(() => {
      expect(useLLMConfigStore.getState().config.apiKey).toBe('auto-key')
    })
    expect(result.current.status).toBe('ready')
    expect(fetch).toHaveBeenCalledWith('/api/ai-key', { method: 'GET' })
  })

  it('reports fetch errors when automatic key bootstrap fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response)

    const { result } = renderHook(() => useLLMConfigBootstrap(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'error', error: 'HTTP 503' })
    })
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
