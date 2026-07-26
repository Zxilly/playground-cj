import { describe, expect, it, vi } from 'vitest'
import { createSharedGatewayBulkhead } from './shared-gateway-bulkhead'
import {
  createSharedQuotaMetadataReader,
  SharedQuotaMetadataBusyError,
  SharedQuotaMetadataRateLimitError,
} from './shared-quota-metadata'

const QUOTA = {
  nextResetAt: 10_000,
  perPeriod: 1_000_000,
  available: 250_000,
  exhausted: false,
}

function dependencies(overrides: Partial<Parameters<
  typeof createSharedQuotaMetadataReader
>[0]> = {}) {
  const bulkhead = createSharedGatewayBulkhead(2)
  return {
    readQuota: vi.fn(async () => QUOTA),
    consumeDistributedPermit: vi.fn(async () => true),
    tryAcquireSlot: bulkhead.tryAcquire,
    now: () => 1_000,
    timeoutMs: 1_000,
    cacheTtlMs: 5_000,
    cacheMaxEntries: 20,
    identityRequestsPerMinute: 10,
    globalRequestsPerMinute: 100,
    ...overrides,
  }
}

describe('shared quota metadata reader', () => {
  it('coalesces concurrent misses and serves a bounded cache without repeated dependencies', async () => {
    let resolveQuota!: (quota: typeof QUOTA) => void
    const readQuota = vi.fn(() => new Promise<typeof QUOTA>((resolve) => {
      resolveQuota = resolve
    }))
    const deps = dependencies({ readQuota })
    const reader = createSharedQuotaMetadataReader(deps)

    const first = reader.read('identity-1')
    const second = reader.read('identity-1')
    await vi.waitFor(() => expect(readQuota).toHaveBeenCalledOnce())
    expect(deps.consumeDistributedPermit).toHaveBeenCalledOnce()
    resolveQuota(QUOTA)

    await expect(Promise.all([first, second])).resolves.toEqual([QUOTA, QUOTA])
    await expect(reader.read('identity-1')).resolves.toEqual(QUOTA)
    expect(deps.consumeDistributedPermit).toHaveBeenCalledOnce()
    expect(readQuota).toHaveBeenCalledOnce()
  })

  it('rate-limits metadata floods locally without charging model quota or amplifying Redis', async () => {
    const deps = dependencies({
      identityRequestsPerMinute: 2,
      globalRequestsPerMinute: 10,
    })
    const reader = createSharedQuotaMetadataReader(deps)

    await expect(reader.read('identity-1')).resolves.toEqual(QUOTA)
    await expect(reader.read('identity-1')).resolves.toEqual(QUOTA)
    await expect(reader.read('identity-1')).rejects.toBeInstanceOf(
      SharedQuotaMetadataRateLimitError,
    )
    expect(deps.consumeDistributedPermit).toHaveBeenCalledOnce()
    expect(deps.readQuota).toHaveBeenCalledOnce()
  })

  it('applies the process-wide metadata limit across distinct identities', async () => {
    const deps = dependencies({
      identityRequestsPerMinute: 2,
      globalRequestsPerMinute: 2,
    })
    const reader = createSharedQuotaMetadataReader(deps)

    await expect(reader.read('identity-1')).resolves.toEqual(QUOTA)
    await expect(reader.read('identity-2')).resolves.toEqual(QUOTA)
    await expect(reader.read('identity-3')).rejects.toBeInstanceOf(
      SharedQuotaMetadataRateLimitError,
    )
    expect(deps.consumeDistributedPermit).toHaveBeenCalledTimes(2)
    expect(deps.readQuota).toHaveBeenCalledTimes(2)
  })

  it('evicts the least-recently-used identity when the metadata cache is full', async () => {
    const deps = dependencies({ cacheMaxEntries: 1 })
    const reader = createSharedQuotaMetadataReader(deps)

    await reader.read('identity-1')
    await reader.read('identity-2')
    await reader.read('identity-1')

    expect(deps.consumeDistributedPermit).toHaveBeenCalledTimes(3)
    expect(deps.readQuota).toHaveBeenCalledTimes(3)
  })

  it('keeps the metadata slot when the distributed permit remains unsettled', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const consumeDistributedPermit = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>(() => {}))
      .mockResolvedValue(true)
    const deps = dependencies({
      tryAcquireSlot: bulkhead.tryAcquire,
      consumeDistributedPermit,
      timeoutMs: 10,
    })
    const reader = createSharedQuotaMetadataReader(deps)

    await expect(reader.read('identity-1')).rejects.toMatchObject({
      name: 'TimeoutError',
    })
    await expect(reader.read('identity-2')).rejects.toBeInstanceOf(
      SharedQuotaMetadataBusyError,
    )
    expect(consumeDistributedPermit).toHaveBeenCalledOnce()
  })

  it('keeps the metadata slot when the quota broker remains unsettled', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const readQuota = vi.fn()
      .mockImplementationOnce(() => new Promise<typeof QUOTA>(() => {}))
      .mockResolvedValue(QUOTA)
    const deps = dependencies({
      tryAcquireSlot: bulkhead.tryAcquire,
      readQuota,
      timeoutMs: 10,
    })
    const reader = createSharedQuotaMetadataReader(deps)

    await expect(reader.read('identity-1')).rejects.toMatchObject({
      name: 'TimeoutError',
    })
    await expect(reader.read('identity-2')).rejects.toBeInstanceOf(
      SharedQuotaMetadataBusyError,
    )
    expect(readQuota).toHaveBeenCalledOnce()
  })
})
