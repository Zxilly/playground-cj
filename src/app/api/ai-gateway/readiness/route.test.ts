import { beforeEach, describe, expect, it, vi } from 'vitest'

const acquireCredential = vi.hoisted(() => vi.fn())
const readQuota = vi.hoisted(() => vi.fn())
const consume = vi.hoisted(() => vi.fn())
const release = vi.hoisted(() => vi.fn())
const tryAcquire = vi.hoisted(() => vi.fn(() => release))

vi.mock('@/lib/ai/shared-ai-config', () => ({
  readSharedAIConfig: () => ({
    model: 'server-model',
    timeoutMs: 25_000,
    metadataIdentityRequestsPerMinute: 60,
    metadataGlobalRequestsPerMinute: 500,
    metadataMaximumConcurrentRequests: 8,
  }),
}))
vi.mock('@/lib/ai/quota-identity', () => ({
  readTrustedQuotaIdentity: () => 'identity-1',
}))
vi.mock('@/lib/ai/shared-gateway-rate-limit', () => ({
  getSharedGatewayRateLimiter: () => ({ consume }),
}))
vi.mock('@/lib/ai/shared-gateway-bulkhead', () => ({
  getSharedGatewayBulkhead: () => ({ tryAcquire }),
}))
vi.mock('@/lib/ai/shared-quota-broker', () => ({
  getSharedQuotaBroker: () => ({ acquireCredential, readQuota }),
}))

const { POST, maxDuration } = await import('./route')

describe('post /api/ai-gateway/readiness', () => {
  beforeEach(() => {
    acquireCredential.mockReset()
    readQuota.mockReset()
    consume.mockReset().mockResolvedValue(true)
    release.mockReset()
    tryAcquire.mockReset().mockReturnValue(release)
  })

  it('provisions a credential before returning sanitized readiness metadata', async () => {
    acquireCredential.mockResolvedValue({
      apiKey: 'server-secret',
      credentialId: 'credential-1',
    })
    readQuota.mockResolvedValue({
      nextResetAt: 2_000,
      perPeriod: 1_000_000,
      available: 250_000,
      exhausted: false,
    })

    const response = await POST(new Request('https://playground.test/api/ai-gateway/readiness', {
      method: 'POST',
    }))
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(maxDuration).toBe(30)
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
    expect(text).not.toContain('server-secret')
    expect(acquireCredential).toHaveBeenCalledWith('identity-1', expect.any(AbortSignal))
    expect(readQuota).toHaveBeenCalledWith('identity-1', expect.any(AbortSignal))
    expect(release).toHaveBeenCalledOnce()
  })

  it('returns a stable busy code and releases the bulkhead', async () => {
    acquireCredential.mockRejectedValue(new Error('shared credential broker is busy: secret'))

    const response = await POST(new Request('https://playground.test/api/ai-gateway/readiness', {
      method: 'POST',
    }))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: {
        code: 'shared_service_busy',
        message: 'The shared AI service is busy.',
      },
    })
    expect(release).toHaveBeenCalledOnce()
  })

  it('rejects excess readiness probes before provisioning', async () => {
    consume.mockResolvedValue(false)

    const response = await POST(new Request('https://playground.test/api/ai-gateway/readiness', {
      method: 'POST',
    }))

    expect(response.status).toBe(429)
    expect(acquireCredential).not.toHaveBeenCalled()
    expect(tryAcquire).not.toHaveBeenCalled()
  })
})
