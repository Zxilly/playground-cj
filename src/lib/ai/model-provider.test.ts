import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANTHROPIC_DEFAULT_BASE_URL,
  createConfiguredModel,
  isLLMConfigReady,
  normaliseLLMConfig,
  OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
  resolveProviderDefaults,
  switchProviderPreservingKey,
} from './model-provider'

const openAIModelMock = vi.hoisted(() => vi.fn(model => ({ provider: 'openai-compatible', model })))
const anthropicModelMock = vi.hoisted(() => vi.fn(model => ({ provider: 'anthropic', model })))
const createOpenAICompatibleMock = vi.hoisted(() => vi.fn(() => openAIModelMock))
const createAnthropicMock = vi.hoisted(() => vi.fn(() => anthropicModelMock))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: createAnthropicMock,
}))

describe('model provider config', () => {
  beforeEach(() => {
    openAIModelMock.mockClear()
    anthropicModelMock.mockClear()
    createOpenAICompatibleMock.mockClear()
    createAnthropicMock.mockClear()
  })

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

  it('reports readiness only when endpoint, key, and model are all present', () => {
    expect(isLLMConfigReady({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'user-key',
      model: 'gpt-test',
    })).toBe(true)
    expect(isLLMConfigReady({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'user-key',
      model: '',
    })).toBe(false)
    expect(isLLMConfigReady({
      provider: 'openai-compatible',
      baseURL: '',
      apiKey: 'user-key',
      model: 'gpt-test',
    })).toBe(false)
    expect(isLLMConfigReady({ apiKey: '' })).toBe(false)
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

  it('creates an OpenAI-compatible model with the configured endpoint and model name', () => {
    const model = createConfiguredModel({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'user-key',
      model: 'gpt-test',
    }, 'classroom-chat')

    expect(createOpenAICompatibleMock).toHaveBeenCalledWith({
      name: 'classroom-chat',
      apiKey: 'user-key',
      baseURL: 'https://api.example.test/v1',
    })
    expect(openAIModelMock).toHaveBeenCalledWith('gpt-test')
    expect(model).toEqual({ provider: 'openai-compatible', model: 'gpt-test' })
  })

  it('creates an Anthropic model without passing the OpenAI-compatible provider name', () => {
    const model = createConfiguredModel({
      provider: 'anthropic',
      baseURL: 'https://anthropic.example.test/v1',
      apiKey: 'anthropic-key',
      model: 'claude-test',
    }, 'ignored-name')

    expect(createAnthropicMock).toHaveBeenCalledWith({
      apiKey: 'anthropic-key',
      baseURL: 'https://anthropic.example.test/v1',
    })
    expect(anthropicModelMock).toHaveBeenCalledWith('claude-test')
    expect(createOpenAICompatibleMock).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'ignored-name' }))
    expect(model).toEqual({ provider: 'anthropic', model: 'claude-test' })
  })
})
