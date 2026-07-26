import { hmrFlag, hmrSlot } from '@/lib/hmr-store'
import { describe, expect, it, vi } from 'vitest'

describe('hmr-store', () => {
  it('creates a slot once and reuses it for the same key', () => {
    const key = `slot:${crypto.randomUUID()}`
    const factory = vi.fn(() => ({ count: 1 }))

    const first = hmrSlot(key, factory)
    first.count = 2
    const second = hmrSlot(key, () => ({ count: 99 }))

    expect(second).toBe(first)
    expect(second.count).toBe(2)
    expect(factory).toHaveBeenCalledOnce()
  })

  it('keeps independent boolean flags by key', () => {
    const key = `flag:${crypto.randomUUID()}`
    const otherKey = `flag:${crypto.randomUUID()}`
    const flag = hmrFlag(key)
    const sameFlag = hmrFlag(key)
    const otherFlag = hmrFlag(otherKey)

    expect(flag.get()).toBe(false)
    flag.set(true)

    expect(sameFlag.get()).toBe(true)
    expect(otherFlag.get()).toBe(false)
  })

  it('keeps slots across module reloads', async () => {
    const key = `reload:${crypto.randomUUID()}`
    const { hmrSlot: firstHmrSlot } = await import('@/lib/hmr-store')
    const first = firstHmrSlot(key, () => ({ value: 1 }))

    vi.resetModules()
    const { hmrSlot: reloadedHmrSlot } = await import('@/lib/hmr-store')
    const second = reloadedHmrSlot(key, () => ({ value: 2 }))

    expect(second).toBe(first)
    expect(second.value).toBe(1)
  })
})
