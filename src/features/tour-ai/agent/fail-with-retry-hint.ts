export interface RetryHint<T> {
  ok: false
  error: string
  expectedShape: T
}

export function failWithRetryHint<T>(error: unknown, expectedShape: T): RetryHint<T> {
  const message = error instanceof Error
    ? error.message
    : error == null
      ? String(error)
      : String(error)
  return { ok: false, error: message, expectedShape }
}
