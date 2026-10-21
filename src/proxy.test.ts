// @vitest-environment node

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from './proxy'

function request(url: string, country = 'CN', method = 'GET') {
  return new NextRequest(url, {
    method,
    headers: {
      'host': new URL(url).host,
      'x-vercel-ip-country': country,
      'accept-language': 'zh-CN',
    },
  })
}

afterEach(() => vi.unstubAllEnvs())
beforeEach(() => vi.stubEnv('CHINA_SITE_REDIRECT', '1'))

describe('china website redirect', () => {
  it('keeps the original site active until the Makers deployment is enabled', () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('CHINA_SITE_REDIRECT', '')
    expect(proxy(request('https://playground.cj.zxilly.dev/en')).headers.get('location')).toBeNull()
  })

  it('preserves the playground path and query on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    const response = proxy(request('https://playground.cj.zxilly.dev/en?code=example'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://play.cj.zxilly.com/en?code=example')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('maps the separate tour domain to the equivalent same-origin course path', () => {
    vi.stubEnv('VERCEL', '1')
    const response = proxy(request('https://tour.cj.zxilly.dev/en/basics/variables?from=share'))
    expect(response.headers.get('location')).toBe('https://play.cj.zxilly.com/en/tour/basics/variables?from=share')
    const root = proxy(request('https://tour.cj.zxilly.dev/'))
    expect(root.headers.get('location')).toBe('https://play.cj.zxilly.com/zh/tour')
  })

  it('keeps non-China traffic on the original Vercel site', () => {
    vi.stubEnv('VERCEL', '1')
    const response = proxy(request('https://playground.cj.zxilly.dev/en', 'US'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not trust a Vercel country header outside Vercel', () => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_ENV', '')
    const response = proxy(request('https://playground.cj.zxilly.dev/en'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not redirect the Makers domain or POST requests', () => {
    vi.stubEnv('VERCEL', '1')
    expect(proxy(request('https://play.cj.zxilly.com/en')).headers.get('location')).toBeNull()
    expect(proxy(request('https://playground.cj.zxilly.dev/en', 'CN', 'POST')).headers.get('location')).toBeNull()
  })
})
