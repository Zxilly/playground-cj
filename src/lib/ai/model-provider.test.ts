import { describe, expect, it } from 'vitest'
import {
  ANTHROPIC_DEFAULT_BASE_URL,
  normaliseLLMConfig,
  OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
  providerLabel,
  resolveProviderDefaults,
  switchProviderPreservingKey,
} from './model-provider'

describe('model provider config', () => {
  it('keeps old persisted config compatible by defaulting to openai-compatible', () => {
    const config = normaliseLLMConfig({
      baseURL: 'https://example.test/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    })

    expect(config.provider).toBe('openai-compatible')
    expect(config.baseURL).toBe('https://example.test/v1')
    expect(config.apiKey).toBe('sk-test')
    expect(config.model).toBe('gpt-4o-mini')
  })

  it('provides protocol-specific defaults for user supplied keys', () => {
    expect(resolveProviderDefaults('openai-compatible')).toMatchObject({
      provider: 'openai-compatible',
      baseURL: OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
    })
    expect(resolveProviderDefaults('anthropic')).toMatchObject({
      provider: 'anthropic',
      baseURL: ANTHROPIC_DEFAULT_BASE_URL,
    })
  })

  it('exposes stable labels for the settings UI', () => {
    expect(providerLabel('openai-compatible')).toBe('OpenAI-compatible')
    expect(providerLabel('anthropic')).toBe('Anthropic')
  })

  it('preserves explicitly blank user supplied api base and model fields', () => {
    const config = normaliseLLMConfig({
      provider: 'anthropic',
      baseURL: '',
      apiKey: '',
      model: '',
    })

    expect(config.baseURL).toBe('')
    expect(config.model).toBe('')
  })

  it('switches provider defaults while preserving the current api key', () => {
    const switched = switchProviderPreservingKey({
      provider: 'openai-compatible',
      baseURL: 'https://openai-compatible.test/v1',
      apiKey: 'user-key',
      model: 'gpt-model',
    }, 'anthropic')

    expect(switched).toEqual({
      ...resolveProviderDefaults('anthropic'),
      apiKey: 'user-key',
    })
  })
})
