import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchSharedGatewayMetadata,
  prepareSharedGateway,
} from './shared-gateway-client'

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
    expect(fetch).toHaveBeenCalledWith('/api/ai-gateway/metadata', { method: 'GET' })
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

    await expect(fetchSharedGatewayMetadata()).rejects.toThrow('shared_service_unavailable')
  })

  it('provisions shared service readiness before the classroom is enabled', async () => {
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

    await expect(prepareSharedGateway()).resolves.toMatchObject({
      transport: 'shared-gateway',
      model: 'server-model',
    })
    expect(fetch).toHaveBeenCalledWith('/api/ai-gateway/readiness', { method: 'POST' })
  })

  it('preserves a safe readiness error code for the UI', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      error: { code: 'shared_service_busy' },
    }, { status: 503 })))

    await expect(prepareSharedGateway()).rejects.toThrow('shared_service_busy')
  })
})
