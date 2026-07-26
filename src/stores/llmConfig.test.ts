import { describe, expect, it } from 'vitest'
import { SHARED_GATEWAY_BASE_URL } from '@/lib/ai/model-provider'
import { sanitizePersistedLLMConfig } from './llmConfig'

describe('persisted LLM configuration', () => {
  it('discards a legacy browser-persisted shared credential before the store can use it', () => {
    const config = sanitizePersistedLLMConfig({
      keySource: 'auto',
      config: {
        provider: 'openai-compatible',
        baseURL: 'https://upstream.test/v1',
        apiKey: 'legacy-shared-secret',
        model: 'server-model',
      },
    })

    expect(config).toMatchObject({
      transport: 'shared-gateway',
      baseURL: SHARED_GATEWAY_BASE_URL,
      apiKey: '',
      model: 'server-model',
    })
    expect(JSON.stringify(config)).not.toContain('legacy-shared-secret')
    expect(JSON.stringify(config)).not.toContain('https://upstream.test')
  })

  it('preserves a user-owned direct provider configuration', () => {
    const config = sanitizePersistedLLMConfig({
      keySource: 'user',
      config: {
        provider: 'anthropic',
        baseURL: 'https://anthropic.example/v1',
        apiKey: 'user-owned-key',
        model: 'claude-test',
      },
    })

    expect(config).toMatchObject({
      transport: 'direct',
      provider: 'anthropic',
      baseURL: 'https://anthropic.example/v1',
      apiKey: 'user-owned-key',
      model: 'claude-test',
    })
  })
})
