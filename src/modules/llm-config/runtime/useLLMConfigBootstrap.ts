'use client'

import { useEffect, useState } from 'react'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { fetchTokenUsage, isUsageExhausted } from '@/modules/llm-config/runtime/new-api-client'

export interface LLMConfigBootstrapState {
  status: 'loading' | 'ready' | 'error'
  error?: string
}

interface UseLLMConfigBootstrapOptions {
  reportErrors?: boolean
}

interface AiKeyResponse {
  baseURL: string
  apiKey: string
  model: string
  quota?: { nextResetAt?: number }
}

async function probeAutoQuotaExhausted(apiKey: string): Promise<boolean | null> {
  const result = await fetchTokenUsage(apiKey)
  if (!result.ok || result.usage.totalGranted <= 0)
    return null
  return isUsageExhausted(result.usage)
}

export function useLLMConfigBootstrap({
  reportErrors = true,
}: UseLLMConfigBootstrapOptions = {}): LLMConfigBootstrapState {
  const apiKey = useLLMConfig().apiKey
  const keySource = useLLMConfigStore(s => s.keySource)
  const applyAutoKey = useLLMConfigStore(s => s.applyAutoKey)
  const setAutoQuota = useLLMConfigStore(s => s.setAutoQuota)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (apiKey || keySource !== 'auto')
      return
    let cancelled = false
    fetch('/api/ai-key', { method: 'GET' })
      .then(async (resp) => {
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}`)
        return resp.json() as Promise<AiKeyResponse>
      })
      .then(async (data) => {
        if (cancelled)
          return
        const nextResetAt = data.quota?.nextResetAt
        const exhausted = typeof nextResetAt === 'number'
          ? await probeAutoQuotaExhausted(data.apiKey)
          : null
        if (cancelled)
          return
        // Update quota state before applyAutoKey, since applying the key
        // changes config.apiKey which is a dependency of this effect — the
        // resulting re-run flips `cancelled` and would drop any later writes.
        if (typeof nextResetAt === 'number')
          setAutoQuota({ nextResetAt, exhausted: exhausted ?? false })
        applyAutoKey(data)
      })
      .catch((e: Error) => {
        if (!cancelled && reportErrors)
          setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [apiKey, keySource, applyAutoKey, setAutoQuota, reportErrors])

  if (apiKey)
    return { status: 'ready' }
  if (error)
    return { status: 'error', error }
  return { status: 'loading' }
}
