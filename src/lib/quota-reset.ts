// Asia/Shanghai is fixed UTC+8 (no daylight saving), so we can compute the
// next midnight in wall-clock time by shifting into and out of UTC.
export const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// Returns the next Asia/Shanghai midnight strictly after `now`, expressed as
// a UTC millisecond timestamp.
export function nextResetAtMs(now: number): number {
  const shifted = now + SHANGHAI_OFFSET_MS
  const shiftedDayStart = Math.floor(shifted / DAY_MS) * DAY_MS
  return shiftedDayStart + DAY_MS - SHANGHAI_OFFSET_MS
}
