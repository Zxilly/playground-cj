import { beforeEach, describe, expect, it, vi } from 'vitest'

const gatewayHandler = vi.hoisted(() => vi.fn(async () => new Response('ok')))
const createSharedModelGateway = vi.hoisted(() => vi.fn(() => gatewayHandler))
const acquireCredential = vi.hoisted(() => vi.fn())
const consumeRequestPermit = vi.hoisted(() => vi.fn())
const readTrustedQuotaIdentity = vi.hoisted(() => vi.fn())
const tryAcquireRequestSlot = vi.hoisted(() => vi.fn())

vi.mock('@/lib/ai/shared-model-gateway', () => ({
  createSharedModelGateway,
}))
vi.mock('@/lib/ai/shared-quota-broker', () => ({
  getSharedQuotaBroker: () => ({ acquireCredential }),
}))
vi.mock('@/lib/ai/shared-gateway-rate-limit', () => ({
  getSharedGatewayRateLimiter: () => ({ consume: consumeRequestPermit }),
}))
vi.mock('@/lib/ai/shared-gateway-bulkhead', () => ({
  getSharedGatewayBulkhead: () => ({ tryAcquire: tryAcquireRequestSlot }),
}))
vi.mock('@/lib/ai/quota-identity', () => ({
  readTrustedQuotaIdentity,
}))
vi.mock('@/lib/ai/shared-ai-config', () => ({
  readSharedAIConfig: () => ({
    upstreamBaseURL: 'https://upstream.test/v1',
    model: 'server-model',
    timeoutMs: 25_000,
    identityRequestsPerMinute: 30,
    globalRequestsPerMinute: 1_000,
    maximumConcurrentRequests: 32,
  }),
}))

const { maxDuration, POST } = await import('./route')

describe('post /api/ai-gateway/v1/chat/completions', () => {
  beforeEach(() => {
    gatewayHandler.mockClear()
    createSharedModelGateway.mockClear()
  })

  it('binds the gateway to trusted identity and the server-side quota broker', async () => {
    const request = new Request('https://playground.test/api/ai-gateway/v1/chat/completions', {
      method: 'POST',
    })

    await expect(POST(request)).resolves.toMatchObject({ status: 200 })

    expect(createSharedModelGateway).toHaveBeenCalledWith({
      resolveIdentity: readTrustedQuotaIdentity,
      consumeRequestPermit,
      acquireCredential,
      fetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 25_000,
      tryAcquireRequestSlot,
    })
    expect(gatewayHandler).toHaveBeenCalledWith(request)
    expect(maxDuration).toBe(30)
  })
})
