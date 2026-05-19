import { describe, expect, it } from 'vitest'
import { normalizeIp, readClientIp } from './client-ip'

describe('normalizeIp', () => {
  it('strips the v4-mapped IPv6 prefix and returns the bare IPv4', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1')
    expect(normalizeIp('::ffff:8.8.8.8')).toBe('8.8.8.8')
  })

  it('is case-insensitive on the prefix', () => {
    expect(normalizeIp('::FFFF:1.2.3.4')).toBe('1.2.3.4')
  })

  it('leaves real IPv6 addresses untouched', () => {
    expect(normalizeIp('::1')).toBe('::1')
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1')
    expect(normalizeIp('fe80::1ff:fe23:4567:890a')).toBe('fe80::1ff:fe23:4567:890a')
  })

  it('leaves bare IPv4 untouched', () => {
    expect(normalizeIp('127.0.0.1')).toBe('127.0.0.1')
    expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1')
  })

  it('does not strip the prefix when the suffix is not a dotted IPv4 quad', () => {
    // ::ffff:0:0 is a valid IPv6 form (IPv4-translated IPv6), not the
    // IPv4-mapped form. Stripping it would yield "0:0" which is meaningless.
    expect(normalizeIp('::ffff:abcd:1234')).toBe('::ffff:abcd:1234')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeIp('  ::ffff:10.0.0.1  ')).toBe('10.0.0.1')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeIp('')).toBe('')
    expect(normalizeIp('   ')).toBe('')
  })
})

function makeHeaders(entries: Record<string, string>): Headers {
  const h = new Headers()
  for (const [k, v] of Object.entries(entries))
    h.set(k, v)
  return h
}

describe('readClientIp', () => {
  it('uses the first x-forwarded-for entry and normalises it', () => {
    const h = makeHeaders({ 'x-forwarded-for': '::ffff:1.2.3.4, 10.0.0.1' })
    expect(readClientIp(h)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const h = makeHeaders({ 'x-real-ip': '::ffff:5.6.7.8' })
    expect(readClientIp(h)).toBe('5.6.7.8')
  })

  it('returns "unknown" when no IP headers are present', () => {
    expect(readClientIp(makeHeaders({}))).toBe('unknown')
  })

  it('returns "unknown" when x-forwarded-for is an empty string', () => {
    expect(readClientIp(makeHeaders({ 'x-forwarded-for': '' }))).toBe('unknown')
  })

  it('falls through to x-real-ip when x-forwarded-for is only whitespace', () => {
    const h = makeHeaders({ 'x-forwarded-for': '   ', 'x-real-ip': '9.9.9.9' })
    expect(readClientIp(h)).toBe('9.9.9.9')
  })

  it('returns the bare IPv6 form when client connects via IPv6 loopback', () => {
    const h = makeHeaders({ 'x-forwarded-for': '::1' })
    expect(readClientIp(h)).toBe('::1')
  })
})
