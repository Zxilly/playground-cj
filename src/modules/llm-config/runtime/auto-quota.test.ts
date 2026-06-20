import { afterEach, describe, expect, it, vi } from 'vitest'
import * as newApiClient from './new-api-client'
import { nextSharedQuotaResetAt, probeExhaustedQuota } from './auto-quota'

const DAY_MS = 86_400_000

afterEach(() => {
  vi.restoreAllMocks()
})

describe('nextSharedQuotaResetAt', () => {
  it('returns a moment within the next 24h that lands on a Beijing midnight', () => {
    const now = Date.UTC(2026, 5, 20, 5, 30) // arbitrary
    const reset = nextSharedQuotaResetAt(now)
    expect(reset).toBeGreaterThan(now)
    expect(reset - now).toBeLessThanOrEqual(DAY_MS)
    // Beijing midnight == 16:00 UTC the day before, so (reset + 8h) is a UTC day boundary.
    expect((reset + 8 * 3_600_000) % DAY_MS).toBe(0)
  })
})

describe('probeExhaustedQuota', () => {
  it('returns an exhausted state preserving the known reset window', async () => {
    vi.spyOn(newApiClient, 'fetchTokenUsage').mockResolvedValue({
      ok: true,
      usage: { totalGranted: 100, totalUsed: 100, totalAvailable: 0 },
    })
    const current = { nextResetAt: 1234, exhausted: false, perPeriod: 50 }
    const next = await probeExhaustedQuota('key', current, 0)
    expect(next).toEqual({ nextResetAt: 1234, perPeriod: 50, exhausted: true })
  })

  it('derives a reset time when none is known yet', async () => {
    vi.spyOn(newApiClient, 'fetchTokenUsage').mockResolvedValue({
      ok: true,
      usage: { totalGranted: 100, totalUsed: 100, totalAvailable: 0 },
    })
    const now = Date.UTC(2026, 5, 20, 5, 30)
    const next = await probeExhaustedQuota('key', null, now)
    expect(next?.exhausted).toBe(true)
    expect(next?.nextResetAt).toBe(nextSharedQuotaResetAt(now))
  })

  it('returns null while quota is still available', async () => {
    vi.spyOn(newApiClient, 'fetchTokenUsage').mockResolvedValue({
      ok: true,
      usage: { totalGranted: 100, totalUsed: 10, totalAvailable: 90 },
    })
    expect(await probeExhaustedQuota('key', null, 0)).toBeNull()
  })

  it('returns null when usage cannot be read', async () => {
    vi.spyOn(newApiClient, 'fetchTokenUsage').mockResolvedValue({ ok: false, error: 'HTTP 500' })
    expect(await probeExhaustedQuota('key', null, 0)).toBeNull()
  })
})
