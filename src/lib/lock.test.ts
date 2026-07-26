import { isBusy, remoteLock } from '@/lib/lock'
import { describe, expect, it } from 'vitest'

describe('remoteLock', () => {
  it('reports busy only while the run lock is held', async () => {
    let release!: () => void
    const pending = remoteLock.acquire('run', () => new Promise<void>((resolve) => {
      release = resolve
    }))

    expect(isBusy()).toBe(true)

    release()
    await pending

    expect(isBusy()).toBe(false)
  })

  it('ignores locks held for other keys', async () => {
    let release!: () => void
    const pending = remoteLock.acquire('format', () => new Promise<void>((resolve) => {
      release = resolve
    }))

    expect(isBusy()).toBe(false)

    release()
    await pending
  })
})
