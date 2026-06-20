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
  quota?: { nextResetAt?: number, perPeriod?: number }
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
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const applyAutoKey = useLLMConfigStore(s => s.applyAutoKey)
  const setAutoQuota = useLLMConfigStore(s => s.setAutoQuota)
  const setSharedConfig = useLLMConfigStore(s => s.setSharedConfig)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (keySource !== 'auto' || !autoQuota?.exhausted)
      return

    const delay = autoQuota.nextResetAt - Date.now()
    if (delay <= 0) {
      setSharedConfig()
      return
    }

    const id = window.setTimeout(setSharedConfig, delay)
    return () => window.clearTimeout(id)
  }, [autoQuota?.exhausted, autoQuota?.nextResetAt, keySource, setSharedConfig])

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
        const perPeriod = data.quota?.perPeriod
        const exhausted = typeof nextResetAt === 'number'
          ? await probeAutoQuotaExhausted(data.apiKey)
          : null
        if (cancelled)
          return
        // Update quota state before applyAutoKey, since applying the key
        // changes config.apiKey which is a dependency of this effect — the
        // resulting re-run flips `cancelled` and would drop any later writes.
        if (typeof nextResetAt === 'number')
          setAutoQuota({ nextResetAt, exhausted: exhausted ?? false, perPeriod })
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
  if (keySource !== 'auto')
    return { status: 'ready' }
  if (error)
    return { status: 'error', error }
  return { status: 'loading' }
}
