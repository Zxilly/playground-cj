import { awaitWithSignal } from './abortable-operation'

export interface SettleAwareOperationOwnership {
  /**
   * Retain an already-started raw operation until its real settlement.
   */
  readonly own: <T>(operation: PromiseLike<T>) => Promise<T>
  /**
   * Let the caller stop waiting on abort without surrendering ownership of the
   * raw operation.
   */
  readonly wait: <T>(
    operation: PromiseLike<T>,
    signal: AbortSignal,
  ) => Promise<T>
  /**
   * Observe settlement while intentionally discarding the operation outcome.
   */
  readonly observe: (operation: PromiseLike<unknown>) => Promise<void>
  /**
   * Mark logical work complete. The returned promise settles only after every
   * owned raw operation has settled and the release callback has run.
   */
  readonly finish: () => Promise<void>
}

/**
 * Owns the gap between a caller giving up and an abort-ignoring dependency
 * actually settling. An owned operation may hand off to another operation
 * while the owner is draining; release occurs exactly once after that graph
 * converges and logical work has finished.
 */
export function createSettleAwareOperationOwnership(
  release: () => void = () => {},
): SettleAwareOperationOwnership {
  let pendingOperations = 0
  let finished = false
  let released = false
  let resolveSettlement!: () => void
  const settlement = new Promise<void>((resolve) => {
    resolveSettlement = resolve
  })

  const releaseIfSettled = () => {
    if (!finished || pendingOperations !== 0 || released)
      return
    released = true
    release()
    resolveSettlement()
  }

  const own = <T>(operation: PromiseLike<T>): Promise<T> => {
    if (released)
      throw new Error('Cannot own an operation after settlement')

    pendingOperations += 1
    const owned = Promise.resolve(operation)
    void owned.then(
      () => {
        pendingOperations -= 1
        releaseIfSettled()
      },
      () => {
        pendingOperations -= 1
        releaseIfSettled()
      },
    )
    return owned
  }

  return {
    own,
    wait: <T>(operation: PromiseLike<T>, signal: AbortSignal) =>
      awaitWithSignal(own(operation), signal),
    observe: operation => own(operation).then(
      () => undefined,
      () => undefined,
    ),
    finish() {
      if (!finished) {
        finished = true
        releaseIfSettled()
      }
      return settlement
    },
  }
}
