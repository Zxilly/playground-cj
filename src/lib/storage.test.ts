import { readJSON, readString, removeKey, writeJSON, writeString } from '@/lib/storage'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('storage helpers', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips JSON and strings through localStorage', () => {
    writeJSON('settings', { theme: 'dark' })
    writeString('code', 'main()')

    expect(readJSON('settings', { theme: 'light' })).toEqual({ theme: 'dark' })
    expect(readString('code', 'fallback')).toBe('main()')

    removeKey('code')
    expect(readString('code', 'fallback')).toBe('fallback')
  })

  it('returns fallbacks for missing or invalid JSON values', () => {
    window.localStorage.setItem('broken', '{')

    expect(readJSON('missing', { ok: true })).toEqual({ ok: true })
    expect(readJSON('broken', { ok: false })).toEqual({ ok: false })
  })

  it('swallows localStorage failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(readJSON('json', { safe: true })).toEqual({ safe: true })
    expect(readString('text', 'safe')).toBe('safe')
    expect(() => writeJSON('json', { value: 1 })).not.toThrow()
    expect(() => writeString('text', 'value')).not.toThrow()
    expect(() => removeKey('text')).not.toThrow()
  })
})
