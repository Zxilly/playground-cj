import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSharedGatewayMetadata } from './shared-gateway-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSharedGatewayMetadata', () => {
  it('accepts quota metadata without a browser credential', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 2_000,
        perPeriod: 1_000_000,
        available: 250_000,
        exhausted: false,
      },
    })))

    await expect(fetchSharedGatewayMetadata()).resolves.toEqual({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 2_000,
        perPeriod: 1_000_000,
        available: 250_000,
        exhausted: false,
      },
    })
    expect(fetch).toHaveBeenCalledWith('/api/ai-key', { method: 'GET' })
  })

  it('fails closed if a response contains a legacy shared key field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      transport: 'shared-gateway',
      model: 'server-model',
      apiKey: 'must-not-enter-browser-state',
      quota: {
        nextResetAt: 2_000,
        perPeriod: 1_000_000,
        available: 250_000,
        exhausted: false,
      },
    })))

    await expect(fetchSharedGatewayMetadata()).rejects.toThrow('Invalid shared gateway metadata')
  })
})
