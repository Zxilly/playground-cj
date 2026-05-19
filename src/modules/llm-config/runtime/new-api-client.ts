export const NEW_API_BASE_URL = (
  process.env.NEXT_PUBLIC_NEW_API_BASE_URL || 'https://llm.learningman.top'
).replace(/\/$/, '')

export interface TokenUsage {
  totalGranted: number
  totalUsed: number
  totalAvailable: number
}

export type FetchTokenUsageResult
  = | { ok: true, usage: TokenUsage }
    | { ok: false, error: string }

export async function fetchTokenUsage(apiKey: string): Promise<FetchTokenUsageResult> {
  try {
    const resp = await fetch(`${NEW_API_BASE_URL}/api/usage/token/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!resp.ok)
      return { ok: false, error: `HTTP ${resp.status}` }
    const json = await resp.json() as { data?: { total_granted?: number, total_used?: number, total_available?: number } }
    const data = json.data ?? {}
    return {
      ok: true,
      usage: {
        totalGranted: data.total_granted ?? 0,
        totalUsed: data.total_used ?? 0,
        totalAvailable: data.total_available ?? 0,
      },
    }
  }
  catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function isUsageExhausted(usage: TokenUsage): boolean {
  return usage.totalGranted > 0 && usage.totalAvailable <= 0
}
