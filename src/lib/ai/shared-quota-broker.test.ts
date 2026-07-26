import { describe, expect, it, vi } from 'vitest'
import { createSharedQuotaBroker } from './shared-quota-broker'

class MemoryRedis {
  readonly values = new Map<string, unknown>()

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null
  }

  async set(
    key: string,
    value: unknown,
    options: { nx?: true, ex: number },
  ): Promise<'OK' | null> {
    if (options.nx && this.values.has(key))
      return null
    this.values.set(key, value)
    return 'OK'
  }

  async eval(_script: string, keys: string[], args: string[]): Promise<number> {
    const [key] = keys
    if (key && this.values.get(key) === args[0]) {
      this.values.delete(key)
      return 1
    }
    return 0
  }
}

function lifecycleDependencies() {
  return {
    listManaged: async () => [],
    remove: async () => {},
    identityDigest: () => 'identity-digest',
  }
}

describe('shared quota broker', () => {
  it('forwards cancellation ownership into every Redis operation', async () => {
    const caller = new AbortController()
    const redis = {
      get: vi.fn(async () => null),
      set: vi.fn(async (
        _key: string,
        _value: unknown,
        _options: { nx?: true, ex: number },
        _signal?: AbortSignal,
      ) => 'OK'),
      eval: vi.fn(async (
        _script: string,
        _keys: string[],
        _args: string[],
        _signal?: AbortSignal,
      ) => 1),
    }
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision: async () => ({ tokenId: 6, key: 'server-only-key' }),
      reset: vi.fn(),
      detail: vi.fn(),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    await broker.acquireCredential('203.0.113.10', caller.signal)

    expect(redis.get).toHaveBeenCalledWith(
      'shared-ai:credential:identity-digest',
      caller.signal,
    )
    expect(redis.set).toHaveBeenCalledWith(
      'shared-ai:credential-lock:identity-digest',
      'lock-owner',
      { nx: true, ex: 30 },
      caller.signal,
    )
    expect(redis.set).toHaveBeenCalledWith(
      'shared-ai:credential:identity-digest',
      expect.any(Object),
      { ex: expect.any(Number) },
      caller.signal,
    )
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      ['shared-ai:credential-lock:identity-digest'],
      ['lock-owner'],
      expect.any(AbortSignal),
    )
  })

  it('provisions one upstream quota token for concurrent requests in the same trusted bucket', async () => {
    const redis = new MemoryRedis()
    const provision = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 1))
      return { tokenId: 7, key: 'server-only-key' }
    })
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      now: () => 1_000,
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      lockOwner: () => 'lock-owner',
    })

    const [first, second] = await Promise.all([
      broker.acquireCredential('203.0.113.10'),
      broker.acquireCredential('203.0.113.10'),
    ])

    expect(provision).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
    expect(first.apiKey).toBe('server-only-key')
    expect(first.nextResetAt).toBeGreaterThan(1_000)
  })

  it('keeps upstream quota isolated between trusted identities', async () => {
    const redis = new MemoryRedis()
    let tokenId = 6
    const provision = vi.fn(async (name: string) => ({
      tokenId: ++tokenId,
      key: `key-for-${name}`,
    }))
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
      identityDigest: identity => identity === '203.0.113.10'
        ? 'a'.repeat(64)
        : 'b'.repeat(64),
    })

    const first = await broker.acquireCredential('203.0.113.10')
    const second = await broker.acquireCredential('198.51.100.20')

    expect(first.tokenId).not.toBe(second.tokenId)
    expect(provision).toHaveBeenCalledTimes(2)
    expect(provision.mock.calls.map(call => call[0])).toEqual([
      `pcj:s:${'a'.repeat(24)}`,
      `pcj:s:${'b'.repeat(24)}`,
    ])
  })

  it('uses a deterministic identity token name within the new-api length limit', async () => {
    const redis = new MemoryRedis()
    const provision = vi.fn(async (
      _name: string,
      _quota: number,
      _expiresAtSeconds: number,
      _signal?: AbortSignal,
    ) => ({
      tokenId: 8,
      key: 'server-only-key',
    }))
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
      identityDigest: () => 'a'.repeat(64),
    })

    await broker.acquireCredential('203.0.113.10')

    const tokenName = provision.mock.calls[0]?.[0]
    expect(tokenName).toBe(`pcj:s:${'a'.repeat(24)}`)
    expect(tokenName).toHaveLength(30)
  })

  it('fails closed at the managed-token capacity before creating another row', async () => {
    const redis = new MemoryRedis()
    const provision = vi.fn()
    const now = Date.UTC(2026, 6, 25)
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      listManaged: async () => Array.from({ length: 512 }, (_, index) => ({
        tokenId: index + 1,
        name: `pcj:s:${index.toString(16).padStart(24, '0')}`,
        expiresAt: now + 60_000,
      })),
      remove: vi.fn(),
      now: () => now,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
      identityDigest: () => 'f'.repeat(64),
    })

    await expect(broker.acquireCredential('203.0.113.10')).rejects.toThrow(
      'shared credential capacity is full',
    )
    expect(provision).not.toHaveBeenCalled()
  })

  it('reclaims safely expired managed rows and provisions with finite expiry', async () => {
    const redis = new MemoryRedis()
    const now = Date.UTC(2026, 6, 25)
    const remove = vi.fn(async () => {})
    const provision = vi.fn(async (
      _name: string,
      _quota: number,
      _expiresAtSeconds: number,
      _signal?: AbortSignal,
    ) => ({
      tokenId: 514,
      key: 'new-key',
    }))
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      listManaged: async () => [{
        tokenId: 513,
        name: `pcj:s:${'e'.repeat(24)}`,
        expiresAt: now - 120_000,
      }],
      remove,
      now: () => now,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
      identityDigest: () => 'f'.repeat(64),
    })

    await broker.acquireCredential('203.0.113.10')

    expect(remove).toHaveBeenCalledWith(513, undefined)
    expect(provision).toHaveBeenCalledWith(
      `pcj:s:${'f'.repeat(24)}`,
      1_000_000,
      expect.any(Number),
      undefined,
    )
    const expiresAtSeconds = provision.mock.calls[0]?.[2]
    expect(expiresAtSeconds).toBeGreaterThan(Math.floor(now / 1_000))
    expect(expiresAtSeconds).toBeLessThan(
      Math.floor(now / 1_000) + (3 * 24 * 60 * 60),
    )
  })

  it('does not reclaim an expired row during the in-flight request grace', async () => {
    const redis = new MemoryRedis()
    const now = Date.UTC(2026, 6, 25)
    const remove = vi.fn()
    const provision = vi.fn()
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => ({
        tokenId: 513,
        key: 'expired-key',
        expiresAt: now - 30_000,
      }),
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      listManaged: async () => [{
        tokenId: 513,
        name: `pcj:s:${'f'.repeat(24)}`,
        expiresAt: now - 30_000,
      }],
      remove,
      now: () => now,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
      identityDigest: () => 'f'.repeat(64),
    })

    await expect(broker.acquireCredential('203.0.113.10')).rejects.toThrow(
      'shared credential is awaiting safe reclamation',
    )
    expect(remove).not.toHaveBeenCalled()
    expect(provision).not.toHaveBeenCalled()
  })

  it('serializes concurrent provisioning against the hard inventory cap', async () => {
    const redis = new MemoryRedis()
    const now = Date.UTC(2026, 6, 25)
    const inventory = Array.from({ length: 511 }, (_, index) => ({
      tokenId: index + 1,
      name: `pcj:s:${index.toString(16).padStart(24, '0')}`,
      expiresAt: now + 60_000,
    }))
    const provision = vi.fn(async (
      name: string,
      _quota: number,
      expiresAtSeconds: number,
    ) => {
      const tokenId = inventory.length + 1
      inventory.push({
        tokenId,
        name,
        expiresAt: expiresAtSeconds * 1_000,
      })
      return { tokenId, key: `key-${tokenId}` }
    })
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail: vi.fn(),
      listManaged: async () => [...inventory],
      now: () => now,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
      identityDigest: identity => identity === '203.0.113.10'
        ? 'a'.repeat(64)
        : 'b'.repeat(64),
    })

    const results = await Promise.allSettled([
      broker.acquireCredential('203.0.113.10'),
      broker.acquireCredential('198.51.100.20'),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected'))
      .toMatchObject({ reason: new Error('shared credential capacity is full') })
    expect(provision).toHaveBeenCalledOnce()
    expect(inventory).toHaveLength(512)
  })

  it('reports quota from the server-side token without exposing the credential', async () => {
    const redis = new MemoryRedis()
    const detail = vi.fn(async () => ({
      status: 1,
      remain_quota: 250_000,
    }))
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision: async () => ({ tokenId: 9, key: 'never-return-this-key' }),
      reset: vi.fn(),
      detail,
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    await broker.acquireCredential('203.0.113.10')
    const quota = await broker.readQuota('203.0.113.10')

    expect(quota).toEqual({
      nextResetAt: expect.any(Number),
      perPeriod: 1_000_000,
      available: 250_000,
      exhausted: false,
    })
    expect(JSON.stringify(quota)).not.toContain('never-return-this-key')
    expect(detail).toHaveBeenCalledWith(9, undefined)
  })

  it('reports a fresh bucket without creating an upstream token during metadata reads', async () => {
    const redis = new MemoryRedis()
    const provision = vi.fn(async () => ({ tokenId: 9, key: 'never-return-this-key' }))
    const detail = vi.fn()
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision,
      reset: vi.fn(),
      detail,
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    await expect(broker.readQuota('203.0.113.10')).resolves.toEqual({
      nextResetAt: expect.any(Number),
      perPeriod: 1_000_000,
      available: 1_000_000,
      exhausted: false,
    })
    expect(provision).not.toHaveBeenCalled()
    expect(detail).not.toHaveBeenCalled()
  })

  it('fails metadata closed for an administrator-disabled token', async () => {
    const redis = new MemoryRedis()
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => ({
        tokenId: 10,
        key: 'server-only-key',
        expiresAt: 200_000_000,
      }),
      provision: vi.fn(),
      reset: vi.fn(),
      detail: async () => ({ status: 2, remain_quota: 500_000 }),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    await expect(broker.readQuota('203.0.113.10')).rejects.toThrow(
      'shared quota token is unavailable',
    )
  })

  it('refills an expired bucket under the distributed lock before reusing its token', async () => {
    const redis = new MemoryRedis()
    let now = 1_000
    const reset = vi.fn(async () => {})
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision: async () => ({ tokenId: 11, key: 'server-only-key' }),
      reset,
      detail: vi.fn(),
      now: () => now,
      sleep: async () => {},
      lockOwner: () => `owner-${now}`,
    })

    const initial = await broker.acquireCredential('203.0.113.10')
    now = initial.nextResetAt
    const refreshed = await broker.acquireCredential('203.0.113.10')

    expect(reset).toHaveBeenCalledOnce()
    expect(reset).toHaveBeenCalledWith(
      11,
      1_000_000,
      expect.any(Number),
      undefined,
    )
    expect(refreshed.apiKey).toBe(initial.apiKey)
    expect(refreshed.nextResetAt).toBeGreaterThan(initial.nextResetAt)
  })

  it('rolls an exhausted cached bucket at the period boundary during metadata reads', async () => {
    const redis = new MemoryRedis()
    let now = 1_000
    let detail = { status: 4, remain_quota: 0 }
    const reset = vi.fn(async () => {
      detail = { status: 1, remain_quota: 1_000_000 }
    })
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision: async () => ({ tokenId: 12, key: 'server-only-key' }),
      reset,
      detail: async () => detail,
      now: () => now,
      sleep: async () => {},
      lockOwner: () => `owner-${now}`,
    })

    const initial = await broker.acquireCredential('203.0.113.10')
    now = initial.nextResetAt
    const quota = await broker.readQuota('203.0.113.10')

    expect(reset).toHaveBeenCalledOnce()
    expect(reset).toHaveBeenCalledWith(
      12,
      1_000_000,
      expect.any(Number),
      undefined,
    )
    expect(quota).toEqual({
      nextResetAt: expect.any(Number),
      perPeriod: 1_000_000,
      available: 1_000_000,
      exhausted: false,
    })
    expect(quota.nextResetAt).toBeGreaterThan(initial.nextResetAt)
  })

  it('recovers an existing identity token after cache loss without refilling it', async () => {
    const redis = new MemoryRedis()
    const lookup = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        tokenId: 17,
        key: 'stable-server-key',
        expiresAt: 200_000_000,
      })
    const provision = vi.fn(async () => ({
      tokenId: 17,
      key: 'stable-server-key',
    }))
    const reset = vi.fn(async () => {})
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup,
      provision,
      reset,
      detail: vi.fn(),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    const initial = await broker.acquireCredential('203.0.113.10')
    redis.values.clear()
    const recovered = await broker.acquireCredential('203.0.113.10')

    expect(recovered).toMatchObject({
      tokenId: initial.tokenId,
      apiKey: initial.apiKey,
    })
    expect(lookup).toHaveBeenCalledTimes(3)
    expect(provision).toHaveBeenCalledOnce()
    expect(reset).not.toHaveBeenCalled()
  })

  it('rebuilds the credential cache from metadata lookup without provisioning or refilling', async () => {
    const redis = new MemoryRedis()
    const lookup = vi.fn(async () => ({
      tokenId: 18,
      key: 'recovered-server-key',
      expiresAt: 200_000_000,
    }))
    const provision = vi.fn()
    const reset = vi.fn()
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup,
      provision,
      reset,
      detail: async () => ({ status: 1, remain_quota: 125_000 }),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    await expect(broker.readQuota('203.0.113.10')).resolves.toMatchObject({
      available: 125_000,
      exhausted: false,
    })
    await expect(broker.acquireCredential('203.0.113.10')).resolves.toMatchObject({
      tokenId: 18,
      apiKey: 'recovered-server-key',
    })

    expect(lookup).toHaveBeenCalledOnce()
    expect(provision).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
  })

  it('starts a recovered token period after lookup when recovery crosses a boundary', async () => {
    const redis = new MemoryRedis()
    let now = 1_000
    const broker = createSharedQuotaBroker({
      redis,
      ...lifecycleDependencies(),
      lookup: async () => {
        now = 57_600_001
        return {
          tokenId: 20,
          key: 'recovered-server-key',
          expiresAt: 200_000_000,
        }
      },
      provision: vi.fn(),
      reset: vi.fn(),
      detail: async () => ({ status: 1, remain_quota: 125_000 }),
      now: () => now,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })

    const quota = await broker.readQuota('203.0.113.10')

    expect(quota.nextResetAt).toBeGreaterThan(now)
  })

  it('does not settle while a Redis dependency that ignored abort remains pending', async () => {
    const redis = new MemoryRedis()
    const hanging = new Promise<never>(() => {})
    const broker = createSharedQuotaBroker({
      redis: {
        ...redis,
        get: async () => hanging,
        set: redis.set.bind(redis),
        eval: redis.eval.bind(redis),
      },
      ...lifecycleDependencies(),
      lookup: async () => null,
      provision: vi.fn(),
      reset: vi.fn(),
      detail: vi.fn(),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'lock-owner',
    })
    const controller = new AbortController()
    const operation = broker.acquireCredential(
      '203.0.113.10',
      controller.signal,
    )
    controller.abort()

    await expect(Promise.race([
      operation.then(() => 'settled', () => 'settled'),
      new Promise(resolve => setTimeout(resolve, 0, 'pending')),
    ])).resolves.toBe('pending')
  })

  it('settles credential acquisition only after distributed lock release settles', async () => {
    const redis = new MemoryRedis()
    let settleRelease: (() => void) | undefined
    const releaseLock = vi.fn(() => new Promise<number>((resolve) => {
      settleRelease = () => resolve(1)
    }))
    const broker = createSharedQuotaBroker({
      redis: {
        get: redis.get.bind(redis),
        set: redis.set.bind(redis),
        eval: releaseLock,
      },
      ...lifecycleDependencies(),
      lookup: async () => ({
        tokenId: 19,
        key: 'server-key',
        expiresAt: 200_000_000,
      }),
      provision: vi.fn(),
      reset: vi.fn(),
      detail: vi.fn(),
      now: () => 1_000,
      sleep: async () => {},
      lockOwner: () => 'release-owner',
    })
    const operation = broker.acquireCredential('203.0.113.11')
    await vi.waitFor(() => expect(releaseLock).toHaveBeenCalledOnce())

    await expect(Promise.race([
      operation.then(() => 'settled', () => 'settled'),
      Promise.resolve('pending'),
    ])).resolves.toBe('pending')

    settleRelease?.()
    await expect(operation).resolves.toMatchObject({ tokenId: 19 })
  })
})
