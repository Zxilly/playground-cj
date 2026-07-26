import { describe, expect, it, vi } from 'vitest'
import { LanguageServiceLeaseManager } from './language-service-lease-manager'

describe('languageServiceLeaseManager', () => {
  it('starts once for multiple editors and stops only after the last release', async () => {
    const start = vi.fn(async () => {})
    const disposeClient = vi.fn(async () => {})
    const stop = vi.fn(async () => {})
    const manager = new LanguageServiceLeaseManager({ start, disposeClient, stop })

    const releaseFirst = manager.acquire()
    const releaseSecond = manager.acquire()
    await manager.settled()
    expect(start).toHaveBeenCalledOnce()

    await releaseFirst()
    expect(start).toHaveBeenCalledOnce()
    expect(disposeClient).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()

    await releaseSecond()
    expect(disposeClient).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })
})
