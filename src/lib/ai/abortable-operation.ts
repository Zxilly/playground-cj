function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

/**
 * Stop awaiting an operation as soon as the caller's signal aborts, even when
 * the dependency ignores AbortSignal. The dependency promise remains observed
 * so a late rejection cannot become unhandled.
 */
export function awaitWithSignal<T>(
  operation: PromiseLike<T>,
  signal?: AbortSignal,
): Promise<T> {
  const observed = Promise.resolve(operation)
  if (!signal)
    return observed
  if (signal.aborted) {
    void observed.then(
      () => undefined,
      () => undefined,
    )
    return Promise.reject(abortReason(signal))
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let handleAbort = () => {}
    const finish = (callback: () => void) => {
      if (settled)
        return
      settled = true
      signal.removeEventListener('abort', handleAbort)
      callback()
    }
    handleAbort = () => finish(() => reject(abortReason(signal)))
    signal.addEventListener('abort', handleAbort, { once: true })
    observed.then(
      value => finish(() => resolve(value)),
      error => finish(() => reject(error)),
    )
  })
}
