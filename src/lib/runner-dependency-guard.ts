export const RUNNER_DEPENDENCY_CANCELLATION_GRACE_MS = 1_000

export interface RunnerDependencyFailure {
  readonly dependency: string
  readonly pendingCancellationCount: number
}

export interface RunnerDependencyGuard {
  /**
   * False while cancellation is unsettled, and permanently false after a
   * cancellation-contract violation. Callers must check this before acquiring
   * a new local slot.
   */
  readonly canAccept: () => boolean
  /**
   * Observe an operation that is expected to settle when `signal` aborts.
   * This does not race or replace the operation promise.
   */
  readonly watch: <T>(
    operation: PromiseLike<T>,
    signal: AbortSignal,
    dependency: string,
  ) => Promise<T>
  /**
   * Observe an explicit cancellation call. New work stays paused until the
   * cancellation itself settles.
   */
  readonly watchCancellation: (
    operation: PromiseLike<unknown>,
    dependency: string,
  ) => Promise<void>
}

export interface RunnerDependencyGuardOptions {
  readonly cancellationGraceMs: number
  readonly onFatal: (failure: RunnerDependencyFailure) => void
}

export interface RunnerDependencyFailStopBoundary {
  readonly nodeEnv: string | undefined
  readonly log: (message: string) => void
  readonly exit: (status: number) => void
}

function assertOptions(options: RunnerDependencyGuardOptions): void {
  if (
    !Number.isSafeInteger(options.cancellationGraceMs)
    || options.cancellationGraceMs <= 0
  ) {
    throw new Error('runner dependency cancellation grace must be a positive integer')
  }
}

/**
 * A promise that ignores cancellation cannot safely be forgotten: admitting a
 * replacement would let repeated timeouts accumulate unbounded zombie I/O.
 * The guard therefore pauses admission as soon as cancellation begins. If the
 * operation still has not settled after a short grace period, it crosses one
 * fail-stop boundary and never reopens inside the same process.
 */
export function createRunnerDependencyGuard(
  options: RunnerDependencyGuardOptions,
): RunnerDependencyGuard {
  assertOptions(options)

  const pendingCancellations = new Set<symbol>()
  let fatal = false

  const monitor = <T>(
    operation: PromiseLike<T>,
    dependency: string,
    signal?: AbortSignal,
  ): Promise<T> => {
    const tracked = Promise.resolve(operation)
    const token = Symbol(dependency)
    let settled = false
    let cancellationStarted = false
    let graceTimer: ReturnType<typeof setTimeout> | undefined

    const beginCancellation = () => {
      if (settled || cancellationStarted)
        return
      cancellationStarted = true
      pendingCancellations.add(token)
      graceTimer = setTimeout(() => {
        if (settled || fatal)
          return
        fatal = true
        options.onFatal({
          dependency,
          pendingCancellationCount: pendingCancellations.size,
        })
      }, options.cancellationGraceMs)
    }

    const finish = () => {
      if (settled)
        return
      settled = true
      signal?.removeEventListener('abort', beginCancellation)
      if (graceTimer !== undefined)
        clearTimeout(graceTimer)
      pendingCancellations.delete(token)
    }

    if (signal) {
      signal.addEventListener('abort', beginCancellation, { once: true })
      if (signal.aborted)
        beginCancellation()
    }
    else {
      beginCancellation()
    }

    tracked.then(finish, finish)
    return tracked
  }

  return {
    canAccept: () => !fatal && pendingCancellations.size === 0,
    watch: (operation, signal, dependency) =>
      monitor(operation, dependency, signal),
    watchCancellation: (operation, dependency) =>
      monitor(operation, dependency).then(
        () => undefined,
        () => undefined,
      ),
  }
}

export function crossRunnerDependencyFailStopBoundary(
  failure: RunnerDependencyFailure,
  boundary: RunnerDependencyFailStopBoundary = {
    nodeEnv: process.env.NODE_ENV,
    log: message => console.error(message),
    exit: status => process.exit(status),
  },
): void {
  boundary.log(
    `[runner-proxy] fatal cancellation-contract violation in ${failure.dependency}; `
    + `${failure.pendingCancellationCount} cancellation operation(s) remain pending`,
  )

  // Once an I/O dependency has violated AbortSignal, no in-process action can
  // both restore throughput and prove that zombie work is bounded. Production
  // therefore terminates this instance; Vercel or the self-hosted supervisor
  // must replace it. Development stays fail-closed so the fault is inspectable.
  if (boundary.nodeEnv === 'production')
    boundary.exit(1)
}

const runnerDependencyGuard = createRunnerDependencyGuard({
  cancellationGraceMs: RUNNER_DEPENDENCY_CANCELLATION_GRACE_MS,
  onFatal: crossRunnerDependencyFailStopBoundary,
})

export function getRunnerDependencyGuard(): RunnerDependencyGuard {
  return runnerDependencyGuard
}
