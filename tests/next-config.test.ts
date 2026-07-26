import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

describe('next app config', () => {
  it('allows 127.0.0.1 as a development origin for HMR', () => {
    expect(nextConfig.allowedDevOrigins).toContain('127.0.0.1')
  })

  it('blocks cross-origin passive resources as a renderer-independent backstop', async () => {
    const rules = await nextConfig.headers?.()
    const globalRule = rules?.find(rule => rule.source === '/:path*')
    const csp = globalRule?.headers.find(
      header => header.key === 'Content-Security-Policy',
    )

    expect(csp?.value).toBe(
      'base-uri \'self\'; object-src \'none\'; frame-src \'none\'; img-src \'self\' blob: data:; media-src \'self\' blob: data:',
    )
  })
})
