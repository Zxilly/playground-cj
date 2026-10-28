/** Stop waiting without allowing late completion to update a disposed owner. */
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    if (signal.aborted)
      abort()
    else
      signal.addEventListener('abort', abort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
