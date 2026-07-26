import { describe, expect, it, vi } from 'vitest'
import { createSharedGatewayRateLimiter } from './shared-gateway-rate-limit'

describe('shared gateway rate limiter', () => {
  it('atomically checks per-identity and deployment-wide counters in one Redis script', async () => {
    const evalScript = vi.fn(async (
      _script: string,
      _keys: string[],
      _args: string[],
    ) => 1)
    const limiter = createSharedGatewayRateLimiter({
      redis: { eval: evalScript },
      now: () => 125_000,
      identityDigest: identity => `digest:${identity}`,
      identityRequestsPerMinute: 30,
      globalRequestsPerMinute: 1_000,
    })

    await expect(limiter.consume('203.0.113.10')).resolves.toBe(true)
    expect(evalScript).toHaveBeenCalledOnce()
    const [script, keys, args] = evalScript.mock.calls[0]!
    expect(script).toContain('identityCount >= identityLimit or globalCount >= globalLimit')
    expect(keys).toEqual([
      'shared-ai:request-rate:2:identity:digest:203.0.113.10',
      'shared-ai:request-rate:2:global',
    ])
    expect(args).toEqual(['30', '1000', '120'])
  })

  it('rejects the request when either Redis counter has reached its limit', async () => {
    const limiter = createSharedGatewayRateLimiter({
      redis: { eval: async () => 0 },
      now: () => 0,
      identityDigest: () => 'digest',
      identityRequestsPerMinute: 1,
      globalRequestsPerMinute: 10,
    })

    await expect(limiter.consume('203.0.113.10')).resolves.toBe(false)
  })

  it('passes the request cancellation signal into the Redis operation', async () => {
    const evalScript = vi.fn(async (
      _script: string,
      _keys: string[],
      _args: string[],
      _signal?: AbortSignal,
    ) => 1)
    const controller = new AbortController()
    const limiter = createSharedGatewayRateLimiter({
      redis: { eval: evalScript },
      now: () => 0,
      identityDigest: () => 'digest',
      identityRequestsPerMinute: 1,
      globalRequestsPerMinute: 10,
    })

    await expect(
      limiter.consume('203.0.113.10', controller.signal),
    ).resolves.toBe(true)

    expect(evalScript.mock.calls[0]?.[3]).toBe(controller.signal)
  })

  it('does not settle until a Redis operation that ignored abort settles', async () => {
    const controller = new AbortController()
    let resolveRedis: ((value: unknown) => void) | undefined
    const limiter = createSharedGatewayRateLimiter({
      redis: {
        eval: () => new Promise((resolve) => {
          resolveRedis = resolve
        }),
      },
      now: () => 0,
      identityDigest: () => 'digest',
      identityRequestsPerMinute: 1,
      globalRequestsPerMinute: 10,
    })

    const operation = limiter.consume('203.0.113.10', controller.signal)
    controller.abort()
    const pending = Symbol('pending')

    await expect(Promise.race([
      operation.then(() => 'settled', () => 'settled'),
      new Promise(resolve => setTimeout(resolve, 0, pending)),
    ])).resolves.toBe(pending)

    resolveRedis?.(1)
    await expect(operation).rejects.toMatchObject({ name: 'AbortError' })
  })
})
