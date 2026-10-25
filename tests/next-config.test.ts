import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('next development indicator', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each([
    ['1', false],
    [undefined, undefined],
  ])('only hides the badge when PLAYGROUND_E2E is %s', async (value, expected) => {
    vi.stubEnv('PLAYGROUND_E2E', value)
    vi.resetModules()
    const { default: config } = await import('../next.config')
    expect(config.devIndicators).toBe(expected)
  })
})
