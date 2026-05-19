// Recognises insufficient-quota errors surfaced by the new-api gateway. The
// gateway returns several phrasings depending on which check tripped, so we
// match on a small set of stable keywords in both the error message and any
// APICallError response body the AI SDK attaches.
const QUOTA_PATTERNS = [
  'insufficient_user_quota',
  'insufficient quota',
  '额度不足',
  'token quota is not enough',
  'user quota is not enough',
]

function collectErrorText(error: unknown): string {
  if (error == null)
    return ''
  const parts: string[] = []
  if (error instanceof Error)
    parts.push(error.message)
  if (typeof error === 'object') {
    const obj = error as { responseBody?: unknown, data?: unknown, cause?: unknown }
    if (typeof obj.responseBody === 'string')
      parts.push(obj.responseBody)
    if (obj.data !== undefined) {
      try {
        parts.push(typeof obj.data === 'string' ? obj.data : JSON.stringify(obj.data))
      }
      catch {}
    }
    if (obj.cause !== undefined && obj.cause !== error)
      parts.push(collectErrorText(obj.cause))
  }
  if (typeof error === 'string')
    parts.push(error)
  return parts.join('\n').toLowerCase()
}

export function isQuotaExhaustedError(error: unknown): boolean {
  const haystack = collectErrorText(error)
  if (!haystack)
    return false
  return QUOTA_PATTERNS.some(p => haystack.includes(p))
}
