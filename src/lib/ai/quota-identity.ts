import { isIP } from 'node:net'

const IPV4_MAPPED_PREFIX = /^::ffff:(?=\d{1,3}(?:\.\d{1,3}){3}$)/i
const HEADER_NAME = /^[!#$%&'*+\-.^`|~\w]+$/

type Environment = Readonly<Record<string, string | undefined>>

function canonicalIpv6(raw: string): string {
  return new URL(`http://[${raw}]/`).hostname.slice(1, -1)
}

function ipv6Prefix64(address: string): string {
  const [leftRaw, rightRaw, ...extra] = address.split('::')
  if (extra.length > 0)
    throw new Error('trusted client identity is unavailable')
  const left = leftRaw ? leftRaw.split(':') : []
  const right = rightRaw ? rightRaw.split(':') : []
  const omitted = 8 - left.length - right.length
  if (
    left.length + right.length > 8
    || (!address.includes('::') && omitted !== 0)
    || (address.includes('::') && omitted < 1)
  ) {
    throw new Error('trusted client identity is unavailable')
  }
  const hextets = [
    ...left,
    ...Array.from<string>({ length: omitted }).fill('0'),
    ...right,
  ].map((hextet) => {
    const parsed = Number.parseInt(hextet, 16)
    if (
      hextet.length === 0
      || hextet.length > 4
      || !Number.isInteger(parsed)
      || parsed < 0
      || parsed > 0xFFFF
    ) {
      throw new Error('trusted client identity is unavailable')
    }
    return parsed
  })
  const prefixAddress = [
    ...hextets.slice(0, 4),
    0,
    0,
    0,
    0,
  ].map(hextet => hextet.toString(16)).join(':')
  return `${canonicalIpv6(prefixAddress)}/64`
}

function normalizeAddress(raw: string | null): string {
  const first = raw?.split(',', 1)[0]?.trim().replace(IPV4_MAPPED_PREFIX, '') ?? ''
  const version = isIP(first)
  if (!first || version === 0)
    throw new Error('trusted client identity is unavailable')
  if (version === 6)
    return ipv6Prefix64(canonicalIpv6(first))
  return first
}

/**
 * Resolve the quota bucket from an address supplied by trusted infrastructure.
 * IPv4 uses the exact address; IPv6 uses the canonical /64 network prefix so
 * rotating privacy/host addresses cannot mint fresh quota identities.
 *
 * Vercel overwrites `x-vercel-forwarded-for`, so clients cannot choose another
 * user's bucket. A self-hosted production deployment must explicitly name the
 * header injected (and stripped from public requests) by its trusted reverse
 * proxy. Development keeps a loopback fallback for `next dev`.
 */
export function readTrustedQuotaIdentity(
  headers: Headers,
  environment: Environment = process.env,
): string {
  if (environment.VERCEL === '1' || environment.VERCEL_ENV)
    return normalizeAddress(headers.get('x-vercel-forwarded-for'))

  const trustedHeader = environment.AI_GATEWAY_TRUSTED_IP_HEADER?.trim()
  if (trustedHeader) {
    if (!HEADER_NAME.test(trustedHeader))
      throw new Error('trusted client identity is unavailable')
    return normalizeAddress(headers.get(trustedHeader))
  }

  if (environment.NODE_ENV === 'production')
    throw new Error('trusted client identity is unavailable')

  const developmentAddress = headers.get('x-forwarded-for') ?? headers.get('x-real-ip')
  return developmentAddress ? normalizeAddress(developmentAddress) : '127.0.0.1'
}
