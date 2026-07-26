'use client'

import { useEffect, useState } from 'react'
import { fetchSharedGatewayMetadata } from '@/modules/llm-config/runtime/shared-gateway-client'

export interface SharedQuota {
  /** Today's remaining share of the period budget as a 0–100 percentage, or null until known. */
  percent: number | null
  /** True while the live probe is in flight, so the caller can show a spinner in place. */
  loading: boolean
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Live "today's remaining" share of the server-managed quota bucket.
 *
 * Independent of {@link useLLMConfigBootstrap}, so opening the wizard refreshes
 * the display even after the initial gateway metadata has loaded. `loading` lets
 * the caller render a spinner in the meter's spot rather than shifting layout.
 * Display-only — failures resolve to `{ percent: null, loading: false }`.
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
        const data = await fetchSharedGatewayMetadata()
        percent = clampPercent((data.quota.available / data.quota.perPeriod) * 100)
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
