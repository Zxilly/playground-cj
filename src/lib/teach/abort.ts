/**
 * True when a caught error (or the signal itself) indicates the learner aborted
 * the turn. The teacher tool wrapper uses it to emit a "User aborted" result,
 * and the runner / knowledge layers use it to re-throw an abort instead of
 * masking it as a runner-unavailable result or empty hits.
 */
export function isUserAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === 'AbortError')
}
