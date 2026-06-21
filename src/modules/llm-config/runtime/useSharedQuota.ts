'use client'

import { useEffect, useState } from 'react'
import { fetchTokenUsage } from '@/modules/llm-config/runtime/new-api-client'

export interface SharedQuota {
  /** Today's remaining share of the period budget as a 0–100 percentage, or null until known. */
  percent: number | null
  /** True while the live probe is in flight, so the caller can show a spinner in place. */
  loading: boolean
}

interface AiKeyQuotaResponse {
  apiKey: string
  quota?: { perPeriod?: number }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Live "today's remaining" share of the shared per-IP budget.
 *
 * Independent of {@link useLLMConfigBootstrap} (which only fetches while the key
 * is empty), so it stays fresh on returning visits where the cached key skips
 * the bootstrap. `loading` lets the caller render a spinner in the meter's spot
 * rather than popping the bar in afterwards and shifting layout. Display-only —
 * failures resolve to `{ percent: null, loading: false }` and the caller falls back.
 */
export function useSharedQuota(active: boolean): SharedQuota {
  const [state, setState] = useState<SharedQuota>(() => ({ percent: null, loading: active }))

  useEffect(() => {
    if (!active)
      return
    let cancelled = false
    void (async () => {
      setState({ percent: null, loading: true })
      let percent: number | null = null
      try {
        const resp = await fetch('/api/ai-key', { method: 'GET' })
        if (resp.ok) {
          const data = await resp.json() as AiKeyQuotaResponse
          const perPeriod = data.quota?.perPeriod
          if (perPeriod && data.apiKey) {
            const usage = await fetchTokenUsage(data.apiKey)
            if (usage.ok)
              percent = clampPercent((usage.usage.totalAvailable / perPeriod) * 100)
          }
        }
      }
      catch {
        // Display-only; leave percent null and let the caller fall back.
      }
      if (!cancelled)
        setState({ percent, loading: false })
    })()
    return () => {
      cancelled = true
    }
  }, [active])

  return active ? state : { percent: null, loading: false }
}
