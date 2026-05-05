'use client'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

export type LLMProvider = 'openai-compatible' | 'anthropic'

export interface LLMConfig {
  provider: LLMProvider
  baseURL: string
  apiKey: string
  model: string
}

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
        provider,
        baseURL: ANTHROPIC_DEFAULT_BASE_URL,
        apiKey: '',
        model: ANTHROPIC_DEFAULT_MODEL,
      }
    : {
        provider,
        baseURL: OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
        apiKey: '',
        model: OPENAI_COMPATIBLE_DEFAULT_MODEL,
      }
}

export function switchProviderPreservingKey(current: LLMConfig, provider: LLMProvider): LLMConfig {
  return {
    ...resolveProviderDefaults(provider),
    apiKey: current.apiKey,
  }
}

export function normaliseLLMConfig(input: Partial<LLMConfig>): LLMConfig {
  const provider = isLLMProvider(input.provider) ? input.provider : 'openai-compatible'
  const defaults = resolveProviderDefaults(provider)
  return {
    provider,
    baseURL: input.baseURL === undefined ? defaults.baseURL : input.baseURL.trim(),
    apiKey: input.apiKey ?? '',
    model: input.model === undefined ? defaults.model : input.model.trim(),
  }
}

export function createConfiguredModel(config: Partial<LLMConfig>, name = 'tour-llm'): LanguageModel {
  const next = normaliseLLMConfig(config)
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
