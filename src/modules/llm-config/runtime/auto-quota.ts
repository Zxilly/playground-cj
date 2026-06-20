import type { AutoQuotaState } from '@/stores/llmConfig'
import { fetchTokenUsage, isUsageExhausted } from './new-api-client'

const DAY_MS = 86_400_000
const BEIJING_OFFSET_MS = 8 * 3_600_000

/**
 * Epoch ms of the next daily shared-quota reset (00:00 Beijing time). Used as a
 * fallback when the authoritative reset time from `/api/ai-key` is not in the
 * store yet (e.g. a reload with a persisted shared key, where the bootstrap does
 * not re-fetch the quota window).
 */
export function nextSharedQuotaResetAt(nowMs: number): number {
  const sinceBeijingDayStart = (nowMs + BEIJING_OFFSET_MS) % DAY_MS
  return nowMs + (DAY_MS - sinceBeijingDayStart)
}

/**
 * Re-probe the shared key's usage. Returns the {@link AutoQuotaState} to store
 * when the quota is now exhausted, or null when usage is unknown or still
 * available (so the caller leaves the quota state untouched). The reset time and
 * per-period budget are preserved from {@link current} when known, otherwise
 * derived from {@link nextSharedQuotaResetAt}.
 */
export async function probeExhaustedQuota(
  apiKey: string,
  current: AutoQuotaState | null,
  nowMs: number,
): Promise<AutoQuotaState | null> {
  const usage = await fetchTokenUsage(apiKey)
  if (!usage.ok || !isUsageExhausted(usage.usage))
    return null
  return {
    nextResetAt: current?.nextResetAt ?? nextSharedQuotaResetAt(nowMs),
    perPeriod: current?.perPeriod,
    exhausted: true,
  }
}
