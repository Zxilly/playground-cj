import { describe, expect, it } from 'vitest'
import nextConfig from './next.config'

describe('next dev config', () => {
  it('allows 127.0.0.1 as a development origin for HMR', () => {
    expect(nextConfig.allowedDevOrigins).toContain('127.0.0.1')
  })
})
