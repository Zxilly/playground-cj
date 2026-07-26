import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRunnerDependencyGuard,
  crossRunnerDependencyFailStopBoundary,
} from './runner-dependency-guard'

describe('runner dependency guard', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pauses new admission while an aborted operation is still cancelling, then recovers', async () => {
    vi.useFakeTimers()
    let settle: (() => void) | undefined
    const fatal = vi.fn()
    const guard = createRunnerDependencyGuard({
      cancellationGraceMs: 1_000,
      onFatal: fatal,
    })
    const controller = new AbortController()
    const operation = new Promise<void>((resolve) => {
      settle = resolve
    })

    guard.watch(operation, controller.signal, 'Redis admission')
    expect(guard.canAccept()).toBe(true)

    controller.abort()
    expect(guard.canAccept()).toBe(false)

    settle?.()
    await operation
    await Promise.resolve()

    expect(guard.canAccept()).toBe(true)
    expect(fatal).not.toHaveBeenCalled()
  })

  it('crosses a fail-stop boundary once when cancellation violates its grace period', async () => {
    vi.useFakeTimers()
    let settleFirst: (() => void) | undefined
    const fatal = vi.fn()
    const guard = createRunnerDependencyGuard({
      cancellationGraceMs: 1_000,
      onFatal: fatal,
    })
    const firstController = new AbortController()
    const secondController = new AbortController()
    const first = new Promise<void>((resolve) => {
      settleFirst = resolve
    })
    const second = new Promise<void>(() => {})

    guard.watch(first, firstController.signal, 'runner fetch')
    guard.watch(second, secondController.signal, 'runner response')
    firstController.abort()
    secondController.abort()

    await vi.advanceTimersByTimeAsync(1_000)

    expect(fatal).toHaveBeenCalledOnce()
    expect(fatal).toHaveBeenCalledWith({
      dependency: 'runner fetch',
      pendingCancellationCount: 2,
    })
    expect(guard.canAccept()).toBe(false)

    settleFirst?.()
    await first
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(fatal).toHaveBeenCalledOnce()
    expect(guard.canAccept()).toBe(false)
  })

  it('watches explicit cancellation work without admitting a replacement', async () => {
    vi.useFakeTimers()
    let settle: (() => void) | undefined
    const fatal = vi.fn()
    const guard = createRunnerDependencyGuard({
      cancellationGraceMs: 1_000,
      onFatal: fatal,
    })
    const cancellation = new Promise<void>((resolve) => {
      settle = resolve
    })

    guard.watchCancellation(cancellation, 'request body cancellation')

    expect(guard.canAccept()).toBe(false)
    settle?.()
    await cancellation
    await Promise.resolve()
    expect(guard.canAccept()).toBe(true)
    expect(fatal).not.toHaveBeenCalled()
  })

  it('terminates a production instance so the deployment supervisor can replace it', () => {
    const log = vi.fn()
    const exit = vi.fn()

    crossRunnerDependencyFailStopBoundary({
      dependency: 'runner fetch',
      pendingCancellationCount: 1,
    }, {
      nodeEnv: 'production',
      log,
      exit,
    })

    expect(log).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('stays fail-closed without terminating the development process', () => {
    const exit = vi.fn()

    crossRunnerDependencyFailStopBoundary({
      dependency: 'request body stream',
      pendingCancellationCount: 1,
    }, {
      nodeEnv: 'development',
      log: vi.fn(),
      exit,
    })

    expect(exit).not.toHaveBeenCalled()
  })
})
