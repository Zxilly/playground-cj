// IPv4-mapped IPv6 prefix per RFC 4291 §2.5.5.2. We strip it so a client that
// reaches a dual-stack socket via IPv4 ends up in the same bucket as one that
// reaches it via raw IPv4 — otherwise quota and cache entries get split across
// `127.0.0.1` and `::ffff:127.0.0.1` for the same user.
const IPV4_MAPPED_PREFIX = /^::ffff:(?=\d{1,3}(?:\.\d{1,3}){3}$)/i

export function normalizeIp(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed)
    return ''
  return trimmed.replace(IPV4_MAPPED_PREFIX, '')
}

export function readClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]
    if (first) {
      const normalized = normalizeIp(first)
      if (normalized)
        return normalized
    }
  }
  const real = headers.get('x-real-ip')
  if (real) {
    const normalized = normalizeIp(real)
    if (normalized)
      return normalized
  }
  return 'unknown'
}
