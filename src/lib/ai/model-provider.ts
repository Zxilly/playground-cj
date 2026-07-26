'use client'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

export type LLMProvider = 'openai-compatible' | 'anthropic'
export type LLMTransport = 'direct' | 'shared-gateway'

export interface LLMConfig {
  transport?: LLMTransport
  provider: LLMProvider
  baseURL: string
  apiKey: string
  model: string
}

export const SHARED_GATEWAY_BASE_URL = '/api/ai-gateway/v1'
export const OPENAI_COMPATIBLE_DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_LLM_BASE_URL || 'https://llm.learningman.top/v1'
export const OPENAI_COMPATIBLE_DEFAULT_MODEL = process.env.NEXT_PUBLIC_LLM_DEFAULT_MODEL || 'gpt-4o-mini'
export const ANTHROPIC_DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'
export const ANTHROPIC_DEFAULT_MODEL = process.env.NEXT_PUBLIC_ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-5'

const providers = ['openai-compatible', 'anthropic'] satisfies LLMProvider[]

function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === 'string' && providers.includes(value as LLMProvider)
}

export function providerLabel(provider: LLMProvider): string {
  return provider === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'
}

export function resolveProviderDefaults(provider: LLMProvider): LLMConfig {
  return provider === 'anthropic'
    ? {
        transport: 'direct',
        provider,
        baseURL: ANTHROPIC_DEFAULT_BASE_URL,
        apiKey: '',
        model: ANTHROPIC_DEFAULT_MODEL,
      }
    : {
        transport: 'direct',
        provider,
        baseURL: OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
        apiKey: '',
        model: OPENAI_COMPATIBLE_DEFAULT_MODEL,
      }
}

export function resolveSharedGatewayConfig(model = OPENAI_COMPATIBLE_DEFAULT_MODEL): LLMConfig {
  return {
    transport: 'shared-gateway',
    provider: 'openai-compatible',
    baseURL: SHARED_GATEWAY_BASE_URL,
    apiKey: '',
    model: model.trim(),
  }
}

export function switchProvider(current: LLMConfig, provider: LLMProvider): LLMConfig {
  if (current.provider === provider && current.transport !== 'shared-gateway')
    return { ...current, transport: 'direct' }
  return resolveProviderDefaults(provider)
}

export function normaliseLLMConfig(input: Partial<LLMConfig>): LLMConfig {
  if (input.transport === 'shared-gateway')
    return resolveSharedGatewayConfig(input.model)

  const provider = isLLMProvider(input.provider) ? input.provider : 'openai-compatible'
  const defaults = resolveProviderDefaults(provider)
  return {
    transport: 'direct',
    provider,
    baseURL: input.baseURL === undefined ? defaults.baseURL : input.baseURL.trim(),
    apiKey: input.apiKey ?? '',
    model: input.model === undefined ? defaults.model : input.model.trim(),
  }
}

export function isLLMConfigReady(config: Partial<LLMConfig>): boolean {
  const next = normaliseLLMConfig(config)
  if (next.transport === 'shared-gateway')
    return Boolean(next.model)
  return Boolean(next.baseURL && next.apiKey && next.model)
}

/**
 * A custom config still needs a service address and a model to be usable. The
 * API Key is intentionally excluded: the settings dialog treats a blank key as
 * "fall back to shared quota", so the key requirement is the caller's call (the
 * onboarding wizard adds it via {@link isLLMConfigReady}).
 */
export function isUserConfigIncomplete(config: LLMConfig): boolean {
  return config.baseURL.trim().length === 0 || config.model.trim().length === 0
}

export function createConfiguredModel(config: Partial<LLMConfig>, name = 'tour-llm'): LanguageModel {
  const next = normaliseLLMConfig(config)
  if (next.transport === 'shared-gateway') {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const compatible = createOpenAICompatible({
      name,
      baseURL: new URL(SHARED_GATEWAY_BASE_URL, origin).toString(),
    })
    return compatible(next.model)
  }
  if (next.provider === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: next.apiKey,
      baseURL: next.baseURL,
    })
    return anthropic(next.model)
  }

  const compatible = createOpenAICompatible({
    name,
    apiKey: next.apiKey,
    baseURL: next.baseURL,
  })
  return compatible(next.model)
}
