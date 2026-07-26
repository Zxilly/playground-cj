import { beforeEach, describe, expect, it, vi } from 'vitest'

const readQuota = vi.hoisted(() => vi.fn())
const readTrustedQuotaIdentity = vi.hoisted(() => vi.fn(() => 'identity-1'))
const readMetadata = vi.hoisted(() => vi.fn())
const getSharedQuotaMetadataReader = vi.hoisted(() => vi.fn(() => ({
  read: readMetadata,
})))
const consumeDistributedPermit = vi.hoisted(() => vi.fn())
const tryAcquireSlot = vi.hoisted(() => vi.fn())

vi.mock('@/lib/ai/shared-quota-broker', () => ({
  getSharedQuotaBroker: () => ({ readQuota }),
}))
vi.mock('@/lib/ai/quota-identity', () => ({
  readTrustedQuotaIdentity,
}))
vi.mock('@/lib/ai/shared-gateway-rate-limit', () => ({
  getSharedGatewayRateLimiter: () => ({ consume: consumeDistributedPermit }),
}))
vi.mock('@/lib/ai/shared-gateway-bulkhead', () => ({
  getSharedGatewayBulkhead: () => ({ tryAcquire: tryAcquireSlot }),
}))
vi.mock('@/lib/ai/shared-quota-metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/shared-quota-metadata')>()
  return {
    ...actual,
    getSharedQuotaMetadataReader,
  }
})
vi.mock('@/lib/ai/shared-ai-config', () => ({
  readSharedAIConfig: () => ({
    model: 'server-model',
    timeoutMs: 25_000,
    metadataIdentityRequestsPerMinute: 60,
    metadataGlobalRequestsPerMinute: 500,
    metadataMaximumConcurrentRequests: 8,
    metadataCacheTtlMs: 5_000,
    metadataCacheMaxEntries: 2_000,
  }),
}))

const { GET, maxDuration } = await import('./route')
const { SharedQuotaMetadataRateLimitError } = await import(
  '@/lib/ai/shared-quota-metadata',
)

describe('get /api/ai-gateway/metadata', () => {
  beforeEach(() => {
    readQuota.mockReset()
    readMetadata.mockReset()
    readTrustedQuotaIdentity.mockClear()
    getSharedQuotaMetadataReader.mockClear()
  })

  it('returns only shared gateway metadata and quota, never the upstream credential', async () => {
    readMetadata.mockResolvedValue({
      nextResetAt: 2_000,
      perPeriod: 1_000_000,
      available: 250_000,
      exhausted: false,
      apiKey: 'malicious-extra-key-from-port',
    })
    const request = new Request('https://playground.test/api/ai-gateway/metadata')

    const response = await GET(request)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(maxDuration).toBe(30)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(JSON.parse(text)).toEqual({
      transport: 'shared-gateway',
      model: 'server-model',
      quota: {
        nextResetAt: 2_000,
        perPeriod: 1_000_000,
        available: 250_000,
        exhausted: false,
      },
    })
    expect(text).not.toContain('apiKey')
    expect(text).not.toContain('malicious-extra-key')
    expect(readMetadata).toHaveBeenCalledWith('identity-1', expect.any(AbortSignal))
    expect(getSharedQuotaMetadataReader).toHaveBeenCalledWith({
      readQuota,
      consumeDistributedPermit,
      tryAcquireSlot,
      now: Date.now,
      timeoutMs: 25_000,
      cacheTtlMs: 5_000,
      cacheMaxEntries: 2_000,
      identityRequestsPerMinute: 60,
      globalRequestsPerMinute: 500,
    })
  })

  it('sanitizes quota broker failures', async () => {
    readMetadata.mockRejectedValue(new Error('redis failed with server-secret'))

    const response = await GET(new Request('https://playground.test/api/ai-gateway/metadata'))
    const text = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(text).toContain('shared_service_unavailable')
    expect(text).not.toContain('redis failed')
    expect(text).not.toContain('server-secret')
  })

  it('returns a bounded metadata rate-limit response without reading quota', async () => {
    readMetadata.mockRejectedValue(
      new SharedQuotaMetadataRateLimitError('internal counter details'),
    )

    const response = await GET(new Request('https://playground.test/api/ai-gateway/metadata'))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many shared AI metadata requests.',
      },
    })
  })
})
