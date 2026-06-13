import { describe, expect, it } from 'vitest'
import { dueItems, scheduleNext } from './scheduler'

const base = {
  id: 'r1',
  lessonId: '0001',
  blockId: 'b1',
  kind: 'quiz' as const,
  dueAt: 0,
  intervalDays: 1,
  ease: 2.5,
  history: [],
}

describe('scheduler', () => {
  it('good grade grows interval', () => {
    const next = scheduleNext(base, 'good', 1000)
    expect(next.intervalDays).toBeGreaterThan(base.intervalDays)
    expect(next.dueAt).toBeGreaterThan(1000)
    expect(next.history.at(-1)?.grade).toBe('good')
  })
  it('again grade resets interval to 1 day', () => {
    const next = scheduleNext({ ...base, intervalDays: 10 }, 'again', 1000)
    expect(next.intervalDays).toBe(1)
  })
  it('dueItems filters by now', () => {
    const items = [{ ...base, dueAt: 500 }, { ...base, id: 'r2', dueAt: 5000 }]
    expect(dueItems(items, 1000).map(i => i.id)).toEqual(['r1'])
  })
})
