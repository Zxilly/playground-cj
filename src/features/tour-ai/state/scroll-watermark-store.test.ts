import { beforeEach, describe, expect, it } from 'vitest'
import { useScrollWatermarkStore } from './scroll-watermark-store'

describe('useScrollWatermarkStore', () => {
  beforeEach(() => {
    useScrollWatermarkStore.setState({ watermarks: {} })
  })

  it('stores a new watermark for a fresh lang', () => {
    useScrollWatermarkStore.getState().setWatermark('zh', 5)
    expect(useScrollWatermarkStore.getState().watermarks.zh).toBe(5)
  })

  it('only advances — lower or equal indices are silently dropped (no scroll-back snap)', () => {
    const s = useScrollWatermarkStore.getState()
    s.setWatermark('zh', 10)
    s.setWatermark('zh', 10)
    s.setWatermark('zh', 3)
    expect(useScrollWatermarkStore.getState().watermarks.zh).toBe(10)
  })

  it('tracks watermarks independently per lang', () => {
    const s = useScrollWatermarkStore.getState()
    s.setWatermark('zh', 7)
    s.setWatermark('en', 2)
    expect(useScrollWatermarkStore.getState().watermarks).toMatchObject({ zh: 7, en: 2 })
  })

  it('clearWatermark removes the entry', () => {
    const s = useScrollWatermarkStore.getState()
    s.setWatermark('zh', 4)
    s.clearWatermark('zh')
    expect(useScrollWatermarkStore.getState().watermarks).not.toHaveProperty('zh')
  })

  it('clearWatermark on a missing lang is a no-op (returns same reference)', () => {
    const before = useScrollWatermarkStore.getState().watermarks
    useScrollWatermarkStore.getState().clearWatermark('zz-missing')
    const after = useScrollWatermarkStore.getState().watermarks
    expect(after).toBe(before)
  })

  it('clearAll removes all language watermarks for a classroom reset', () => {
    const s = useScrollWatermarkStore.getState()
    s.setWatermark('zh', 7)
    s.setWatermark('en', 2)

    s.clearAll()

    expect(useScrollWatermarkStore.getState().watermarks).toEqual({})
  })
})
