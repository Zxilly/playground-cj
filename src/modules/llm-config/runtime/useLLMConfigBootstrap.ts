'use client'

import { useEffect, useState } from 'react'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'

export interface LLMConfigBootstrapState {
  status: 'loading' | 'ready' | 'error'
  error?: string
}

interface UseLLMConfigBootstrapOptions {
  reportErrors?: boolean
}

export function useLLMConfigBootstrap({
  reportErrors = true,
}: UseLLMConfigBootstrapOptions = {}): LLMConfigBootstrapState {
  const apiKey = useLLMConfig().apiKey
  const keySource = useLLMConfigStore(s => s.keySource)
  const applyAutoKey = useLLMConfigStore(s => s.applyAutoKey)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (apiKey || keySource !== 'auto')
      return
    let cancelled = false
    fetch('/api/ai-key', { method: 'GET' })
      .then(async (resp) => {
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}`)
        return resp.json() as Promise<{ baseURL: string, apiKey: string, model: string }>
      })
      .then((data) => {
        if (!cancelled)
          applyAutoKey(data)
      })
      .catch((e: Error) => {
        if (!cancelled && reportErrors)
          setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [apiKey, keySource, applyAutoKey, reportErrors])

  if (apiKey)
    return { status: 'ready' }
  if (error)
    return { status: 'error', error }
  return { status: 'loading' }
}
