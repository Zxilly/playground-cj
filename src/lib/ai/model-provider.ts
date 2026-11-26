'use client'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

export type LLMProvider = 'openai-compatible' | 'anthropic'
export type LLMTransport = 'direct' | 'shared-gateway'
export type LLMProviderPresetId = 'openai' | 'deepseek' | 'anthropic' | 'custom'

export interface LLMProviderPreset {
  readonly id: LLMProviderPresetId
  readonly label: string | null
  readonly provider: LLMProvider
  readonly baseURL: string
  readonly defaultModel: string
}

export interface LLMConfig {
  transport?: LLMTransport
  provider: LLMProvider
  baseURL: string
  apiKey: string
  model: string
}

export const SHARED_GATEWAY_BASE_URL = '/api/ai-gateway/v1'
// Never default user-supplied keys to a third-party proxy domain or model. Only
// prefill when explicitly configured via NEXT_PUBLIC_LLM_BASE_URL /
// NEXT_PUBLIC_LLM_MODEL; otherwise leave blank so the user explicitly chooses
// an official preset or enters their own endpoint and model.
export const OPENAI_COMPATIBLE_DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_LLM_BASE_URL?.trim() || ''
export const OPENAI_COMPATIBLE_DEFAULT_MODEL = process.env.NEXT_PUBLIC_LLM_MODEL?.trim() || ''
export const SHARED_GATEWAY_DEFAULT_MODEL = process.env.NEXT_PUBLIC_LLM_DEFAULT_MODEL?.trim() || 'gpt-4o-mini'
export const ANTHROPIC_DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com/v1'
export const ANTHROPIC_DEFAULT_MODEL = process.env.NEXT_PUBLIC_ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-5'

export const LLM_PROVIDER_PRESETS: readonly LLMProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    provider: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    provider: 'anthropic',
    baseURL: ANTHROPIC_DEFAULT_BASE_URL,
    defaultModel: ANTHROPIC_DEFAULT_MODEL,
  },
  {
    id: 'custom',
    label: null,
    provider: 'openai-compatible',
    baseURL: '',
    defaultModel: '',
  },
] as const

const providers = ['openai-compatible', 'anthropic'] satisfies LLMProvider[]

function normaliseEndpointForComparison(url: string): string {
  return url.trim().replace(/\/+$/u, '').toLowerCase()
}

export function detectProviderPreset(config: Partial<LLMConfig>): LLMProviderPresetId {
  const endpoint = normaliseEndpointForComparison(config.baseURL ?? '')
  if (!endpoint)
    return 'custom'
  for (const preset of LLM_PROVIDER_PRESETS) {
    if (preset.id === 'custom')
      continue
    if (
      config.provider === preset.provider
      && endpoint === normaliseEndpointForComparison(preset.baseURL)
    ) {
      return preset.id
    }
  }
  return 'custom'
}

export function applyProviderPreset(
  current: LLMConfig,
  presetId: LLMProviderPresetId,
): LLMConfig {
  const preset = LLM_PROVIDER_PRESETS.find(candidate => candidate.id === presetId)
  if (!preset)
    return current
  const currentPreset = detectProviderPreset(current)
  if (preset.id === 'custom') {
    if (currentPreset === 'custom')
      return { ...current, transport: 'direct' }
    return {
      transport: 'direct',
      provider: 'openai-compatible',
      baseURL: '',
      apiKey: '',
      model: '',
    }
  }
  if (currentPreset === preset.id && current.transport !== 'shared-gateway')
    return { ...current, transport: 'direct' }
  const keepKey = current.transport !== 'shared-gateway'
    && current.provider === preset.provider
    && current.baseURL.trim() === ''
  return {
    transport: 'direct',
    provider: preset.provider,
    baseURL: preset.baseURL,
    apiKey: keepKey ? current.apiKey : '',
    model: preset.defaultModel,
  }
}

export type LLMConnectionTestResult
  = | { ok: true, latencyMs: number }
    | {
      ok: false
      kind: 'incomplete' | 'auth' | 'not_found' | 'rate_limit' | 'http_error' | 'timeout' | 'network'
      status?: number
    }

const CONNECTION_TEST_TIMEOUT_MS = 15_000

export async function testLLMConnection(
  config: Partial<LLMConfig>,
  signal?: AbortSignal,
): Promise<LLMConnectionTestResult> {
  const next = normaliseLLMConfig(config)
  if (next.transport === 'shared-gateway' || !isLLMConfigReady(next))
    return { ok: false, kind: 'incomplete' }

  const endpointBase = next.baseURL.replace(/\/+$/u, '')
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException('Connection test timed out', 'TimeoutError'))
  }, CONNECTION_TEST_TIMEOUT_MS)
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal

  const startedAt = Date.now()
  try {
    const response = next.provider === 'anthropic'
      ? await fetch(`${endpointBase}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': next.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: next.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: combinedSignal,
        })
      : await fetch(`${endpointBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${next.apiKey}`,
          },
          body: JSON.stringify({
            model: next.model,
            max_tokens: 1,
            stream: false,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: combinedSignal,
        })

    if (response.ok)
      return { ok: true, latencyMs: Math.max(1, Date.now() - startedAt) }
    if (response.status === 401 || response.status === 403)
      return { ok: false, kind: 'auth', status: response.status }
    if (response.status === 404)
      return { ok: false, kind: 'not_found', status: response.status }
    if (response.status === 429)
      return { ok: false, kind: 'rate_limit', status: response.status }
    return { ok: false, kind: 'http_error', status: response.status }
  }
  catch (error) {
    if (signal?.aborted)
      throw error
    if (timeoutController.signal.aborted)
      return { ok: false, kind: 'timeout' }
    return { ok: false, kind: 'network' }
  }
  finally {
    clearTimeout(timeoutId)
  }
}

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

export function resolveSharedGatewayConfig(model = SHARED_GATEWAY_DEFAULT_MODEL): LLMConfig {
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

/** A direct provider needs an absolute HTTP(S) endpoint before it can be used. */
export function isValidLLMBaseURL(value: string | undefined): boolean {
  const raw = value?.trim()
  if (!raw)
    return false
  try {
    const parsed = new URL(raw)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && Boolean(parsed.hostname)
  }
  catch {
    return false
  }
}

export function isLLMConfigReady(config: Partial<LLMConfig>): boolean {
  const next = normaliseLLMConfig(config)
  if (next.transport === 'shared-gateway')
    return Boolean(next.model)
  return Boolean(isValidLLMBaseURL(next.baseURL) && next.apiKey && next.model)
}

/**
 * A custom config still needs a service address and a model to be usable. The
 * API Key is intentionally excluded: the settings dialog treats a blank key as
 * "fall back to shared quota", so the key requirement is the caller's call (the
 * onboarding wizard adds it via {@link isLLMConfigReady}).
 */
export function isUserConfigIncomplete(config: LLMConfig): boolean {
  return !isValidLLMBaseURL(config.baseURL) || config.model.trim().length === 0
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
