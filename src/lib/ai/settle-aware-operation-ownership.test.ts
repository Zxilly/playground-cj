import { describe, expect, it, vi } from 'vitest'
import { createSettleAwareOperationOwnership } from './settle-aware-operation-ownership'

describe('settle-aware operation ownership', () => {
  it('releases synchronously and exactly once when no operation is pending', async () => {
    const release = vi.fn()
    const ownership = createSettleAwareOperationOwnership(release)

    const settlement = ownership.finish()

    expect(release).toHaveBeenCalledOnce()
    expect(ownership.finish()).toBe(settlement)
    await expect(settlement).resolves.toBeUndefined()
    expect(release).toHaveBeenCalledOnce()
  })

  it('stops waiting on abort but retains ownership until the raw operation settles', async () => {
    let settleRaw!: (value: string) => void
    const raw = new Promise<string>((resolve) => {
      settleRaw = resolve
    })
    const release = vi.fn()
    const ownership = createSettleAwareOperationOwnership(release)
    const controller = new AbortController()
    const waiting = ownership.wait(raw, controller.signal)

    controller.abort(new DOMException('deadline', 'TimeoutError'))
    const settlement = ownership.finish()

    await expect(waiting).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(release).not.toHaveBeenCalled()

    settleRaw('late result')
    await expect(settlement).resolves.toBeUndefined()
    expect(release).toHaveBeenCalledOnce()
  })

  it('observes raw rejection and releases once after every operation settles', async () => {
    let rejectFirst!: (reason: unknown) => void
    let settleSecond!: () => void
    const first = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject
    })
    const second = new Promise<void>((resolve) => {
      settleSecond = resolve
    })
    const release = vi.fn()
    const ownership = createSettleAwareOperationOwnership(release)

    const observedFirst = ownership.observe(first)
    const observedSecond = ownership.observe(second)
    const settlement = ownership.finish()
    rejectFirst(new Error('late failure'))

    await expect(observedFirst).resolves.toBeUndefined()
    expect(release).not.toHaveBeenCalled()

    settleSecond()
    await expect(observedSecond).resolves.toBeUndefined()
    await expect(settlement).resolves.toBeUndefined()
    expect(release).toHaveBeenCalledOnce()
    expect(ownership.finish()).toBe(settlement)
  })

  it('allows an owned operation to hand off ownership while draining', async () => {
    let settleParent!: () => void
    let settleChild!: () => void
    const parent = new Promise<void>((resolve) => {
      settleParent = resolve
    })
    const child = new Promise<void>((resolve) => {
      settleChild = resolve
    })
    const release = vi.fn()
    const ownership = createSettleAwareOperationOwnership(release)
    const handedOff = parent.then(() => ownership.observe(child))

    void ownership.observe(handedOff)
    const settlement = ownership.finish()
    settleParent()
    await Promise.resolve()

    expect(release).not.toHaveBeenCalled()
    settleChild()
    await expect(settlement).resolves.toBeUndefined()
    expect(release).toHaveBeenCalledOnce()
  })

  it('owns an already-started operation when the signal is already aborted', async () => {
    let settleRaw!: () => void
    const raw = new Promise<void>((resolve) => {
      settleRaw = resolve
    })
    const release = vi.fn()
    const ownership = createSettleAwareOperationOwnership(release)
    const controller = new AbortController()
    controller.abort()

    const waiting = ownership.wait(raw, controller.signal)
    const settlement = ownership.finish()

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    expect(release).not.toHaveBeenCalled()
    settleRaw()
    await settlement
    expect(release).toHaveBeenCalledOnce()
  })
})
