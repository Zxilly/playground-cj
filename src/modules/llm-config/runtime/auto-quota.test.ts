import { afterEach, describe, expect, it, vi } from 'vitest'
import * as sharedGatewayClient from './shared-gateway-client'
import { probeExhaustedQuota } from './auto-quota'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('probeExhaustedQuota', () => {
  it('returns the authoritative server quota once it is exhausted', async () => {
    vi.spyOn(sharedGatewayClient, 'fetchSharedGatewayMetadata').mockResolvedValue({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 1_234,
        perPeriod: 1_000_000,
        available: 0,
        exhausted: true,
      },
    })

    await expect(probeExhaustedQuota()).resolves.toEqual({
      nextResetAt: 1_234,
      perPeriod: 1_000_000,
      available: 0,
      exhausted: true,
    })
  })

  it('returns null while shared quota is still available', async () => {
    vi.spyOn(sharedGatewayClient, 'fetchSharedGatewayMetadata').mockResolvedValue({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 1_234,
        perPeriod: 1_000_000,
        available: 90,
        exhausted: false,
      },
    })

    await expect(probeExhaustedQuota()).resolves.toBeNull()
  })

  it('returns null when server-side quota metadata cannot be read', async () => {
    vi.spyOn(sharedGatewayClient, 'fetchSharedGatewayMetadata').mockRejectedValue(new Error('HTTP 500'))

    await expect(probeExhaustedQuota()).resolves.toBeNull()
  })
})
