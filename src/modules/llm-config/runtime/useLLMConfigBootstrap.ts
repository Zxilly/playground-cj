'use client'

import { useEffect, useRef, useState } from 'react'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { fetchSharedGatewayMetadata } from '@/modules/llm-config/runtime/shared-gateway-client'

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
  const config = useLLMConfig()
  const keySource = useLLMConfigStore(s => s.keySource)
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const applyAutoConfig = useLLMConfigStore(s => s.applyAutoConfig)
  const setAutoQuota = useLLMConfigStore(s => s.setAutoQuota)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const hasRequestedAutoConfigRef = useRef(false)

  useEffect(() => {
    if (keySource !== 'auto' || !autoQuota?.exhausted)
      return

    const delay = Math.max(0, autoQuota.nextResetAt - Date.now())
    // The initial bootstrap below already refreshes an expired persisted config.
    // Only schedule another request when quota becomes overdue after that first
    // request has run.
    if (delay === 0 && !hasRequestedAutoConfigRef.current)
      return

    const id = window.setTimeout(
      () => setRefreshGeneration(generation => generation + 1),
      delay,
    )
    return () => window.clearTimeout(id)
  }, [autoQuota?.exhausted, autoQuota?.nextResetAt, keySource])

  useEffect(() => {
    if (keySource !== 'auto')
      return
    let cancelled = false
    hasRequestedAutoConfigRef.current = true
    fetchSharedGatewayMetadata()
      .then((data) => {
        if (cancelled)
          return
        setAutoQuota(data.quota)
        applyAutoConfig({ model: data.model })
        setError(undefined)
        setLoaded(true)
      })
      .catch((e: Error) => {
        if (!cancelled && reportErrors)
          setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [keySource, refreshGeneration, applyAutoConfig, setAutoQuota, reportErrors])

  if (keySource !== 'auto')
    return { status: 'ready' }
  if (error)
    return { status: 'error', error }
  if (loaded && autoQuota !== null && config.transport === 'shared-gateway')
    return { status: 'ready' }
  return { status: 'loading' }
}
