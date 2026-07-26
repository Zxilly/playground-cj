import { describe, expect, it } from 'vitest'
import { readTrustedQuotaIdentity } from './quota-identity'

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

describe('readTrustedQuotaIdentity', () => {
  it('uses the Vercel-authenticated forwarding header instead of spoofable forwarding headers', () => {
    expect(readTrustedQuotaIdentity(headers({
      'x-vercel-forwarded-for': '203.0.113.10',
      'x-forwarded-for': '198.51.100.99',
      'x-real-ip': '198.51.100.98',
    }), {
      VERCEL: '1',
      NODE_ENV: 'production',
    })).toBe('203.0.113.10')
  })

  it('rejects ordinary forwarding headers in a non-Vercel production deployment', () => {
    expect(() => readTrustedQuotaIdentity(headers({
      'x-forwarded-for': '198.51.100.99',
      'x-real-ip': '198.51.100.98',
    }), {
      NODE_ENV: 'production',
    })).toThrow('trusted client identity is unavailable')
  })

  it('accepts only an explicitly configured reverse-proxy header outside Vercel', () => {
    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '2001:db8::1',
      'x-forwarded-for': '198.51.100.99',
    }), {
      NODE_ENV: 'production',
      AI_GATEWAY_TRUSTED_IP_HEADER: 'x-playground-client-ip',
    })).toBe('2001:db8::/64')
  })

  it('canonicalizes equivalent IPv6 spellings into the same quota bucket', () => {
    const environment = {
      NODE_ENV: 'production',
      AI_GATEWAY_TRUSTED_IP_HEADER: 'x-playground-client-ip',
    }

    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '2001:0db8:0:0:0:0:0:1',
    }), environment)).toBe('2001:db8::/64')
    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '2001:db8::1',
    }), environment)).toBe('2001:db8::/64')
  })

  it('groups rotating IPv6 host addresses by /64 without merging adjacent networks', () => {
    const environment = {
      NODE_ENV: 'production',
      AI_GATEWAY_TRUSTED_IP_HEADER: 'x-playground-client-ip',
    }

    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '2001:db8:1234:5678::1',
    }), environment)).toBe('2001:db8:1234:5678::/64')
    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '2001:db8:1234:5678:ffff:ffff:ffff:ffff',
    }), environment)).toBe('2001:db8:1234:5678::/64')
    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '2001:db8:1234:5679::1',
    }), environment)).toBe('2001:db8:1234:5679::/64')
  })

  it('keeps IPv4-mapped addresses in the exact IPv4 bucket', () => {
    expect(readTrustedQuotaIdentity(headers({
      'x-playground-client-ip': '::ffff:192.0.2.42',
    }), {
      NODE_ENV: 'production',
      AI_GATEWAY_TRUSTED_IP_HEADER: 'x-playground-client-ip',
    })).toBe('192.0.2.42')
  })
})
