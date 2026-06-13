import type { RetrievalItem } from './types'

const DAY_MS = 86_400_000

export type RetrievalGrade = 'again' | 'good'

/**
 * SM-2-lite scheduling. `now` is injected by the caller (pure function, no
 * `Date.now()`): a `good` grade grows the interval by the ease factor, an
 * `again` grade resets it to a single day. The next due time and the grade
 * history are derived from `now`.
 */
export function scheduleNext(item: RetrievalItem, grade: RetrievalGrade, now: number): RetrievalItem {
  let intervalDays: number
  let ease: number

  if (grade === 'good') {
    ease = Math.min(item.ease + 0.1, 3)
    intervalDays = Math.max(1, Math.round(item.intervalDays * item.ease))
  } else {
    ease = Math.max(1.3, item.ease - 0.2)
    intervalDays = 1
  }

  return {
    ...item,
    intervalDays,
    ease,
    dueAt: now + intervalDays * DAY_MS,
    history: [...item.history, { at: now, grade }],
  }
}

/** Items whose `dueAt` is at or before `now`. */
export function dueItems(items: RetrievalItem[], now: number): RetrievalItem[] {
  return items.filter((item) => item.dueAt <= now)
}
