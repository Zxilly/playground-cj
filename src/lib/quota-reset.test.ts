import { describe, expect, it } from 'vitest'
import { nextResetAtMs, SHANGHAI_OFFSET_MS } from '@/lib/quota-reset'

// Shanghai is UTC+8 with no DST, so a UTC instant at HH:00 corresponds to
// (HH + 8) % 24 wall-clock in Shanghai.
const DAY_MS = 24 * 60 * 60 * 1000

describe('nextResetAtMs', () => {
  it('returns the next Shanghai midnight as a UTC timestamp', () => {
    // 2026-05-17T10:00:00Z == 2026-05-17 18:00 Shanghai
    // Next Shanghai midnight: 2026-05-18 00:00 Shanghai == 2026-05-17T16:00:00Z
    const now = Date.UTC(2026, 4, 17, 10, 0, 0)
    const expected = Date.UTC(2026, 4, 17, 16, 0, 0)
    expect(nextResetAtMs(now)).toBe(expected)
  })

  it('handles UTC instants that fall before Shanghai midnight', () => {
    // 2026-05-17T15:30:00Z == 2026-05-17 23:30 Shanghai
    // Next Shanghai midnight: 2026-05-18 00:00 Shanghai == 2026-05-17T16:00:00Z
    const now = Date.UTC(2026, 4, 17, 15, 30, 0)
    const expected = Date.UTC(2026, 4, 17, 16, 0, 0)
    expect(nextResetAtMs(now)).toBe(expected)
  })

  it('rolls into the next day when current UTC is past Shanghai midnight', () => {
    // 2026-05-17T16:30:00Z == 2026-05-18 00:30 Shanghai
    // Next Shanghai midnight: 2026-05-19 00:00 Shanghai == 2026-05-18T16:00:00Z
    const now = Date.UTC(2026, 4, 17, 16, 30, 0)
    const expected = Date.UTC(2026, 4, 18, 16, 0, 0)
    expect(nextResetAtMs(now)).toBe(expected)
  })

  it('returns a strict future timestamp at exactly Shanghai midnight', () => {
    // Exactly Shanghai midnight: floor() lands on the same shifted day start,
    // so the result should be the *next* day, not the current one.
    const shanghaiMidnight = Date.UTC(2026, 4, 17, 16, 0, 0)
    expect(nextResetAtMs(shanghaiMidnight)).toBe(shanghaiMidnight + DAY_MS)
  })

  it('keeps a fixed +8h offset from the resulting UTC instant', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0)
    const result = nextResetAtMs(now)
    expect((result + SHANGHAI_OFFSET_MS) % DAY_MS).toBe(0)
    expect(result).toBeGreaterThan(now)
  })

  it('crosses a year boundary correctly', () => {
    // 2025-12-31T15:30:00Z == 2025-12-31 23:30 Shanghai
    // Next Shanghai midnight: 2026-01-01 00:00 Shanghai == 2025-12-31T16:00:00Z
    const now = Date.UTC(2025, 11, 31, 15, 30, 0)
    const expected = Date.UTC(2025, 11, 31, 16, 0, 0)
    expect(nextResetAtMs(now)).toBe(expected)
  })
})
