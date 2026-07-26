import { createHash } from 'node:crypto'
import { getRedis } from '@/lib/redis'

const WINDOW_MS = 60_000
const KEY_TTL_SECONDS = 120
const KEY_PREFIX = 'shared-ai:request-rate:'

const CONSUME_SCRIPT = `
local identityCount = tonumber(redis.call("get", KEYS[1]) or "0")
local globalCount = tonumber(redis.call("get", KEYS[2]) or "0")
local identityLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

if identityCount >= identityLimit or globalCount >= globalLimit then
  return 0
end

identityCount = redis.call("incr", KEYS[1])
if identityCount == 1 then
  redis.call("expire", KEYS[1], ttl)
end

globalCount = redis.call("incr", KEYS[2])
if globalCount == 1 then
  redis.call("expire", KEYS[2], ttl)
end

return 1
`.trim()

interface RedisPort {
  eval: (
    script: string,
    keys: string[],
    args: string[],
    signal?: AbortSignal,
  ) => Promise<unknown>
}

export interface SharedGatewayRateLimiter {
  consume: (identity: string, signal?: AbortSignal) => Promise<boolean>
}

export interface SharedGatewayRateLimiterDependencies {
  readonly redis: RedisPort
  readonly now: () => number
  readonly identityDigest: (identity: string) => string
  readonly identityRequestsPerMinute: number
  readonly globalRequestsPerMinute: number
  readonly keyPrefix?: string
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive integer`)
}

export function createSharedGatewayRateLimiter(
  dependencies: SharedGatewayRateLimiterDependencies,
): SharedGatewayRateLimiter {
  positiveInteger(dependencies.identityRequestsPerMinute, 'identity request limit')
  positiveInteger(dependencies.globalRequestsPerMinute, 'global request limit')
  if (dependencies.globalRequestsPerMinute < dependencies.identityRequestsPerMinute)
    throw new Error('global request limit must be at least the identity request limit')

  return {
    async consume(identity: string, signal?: AbortSignal): Promise<boolean> {
      signal?.throwIfAborted()
      if (!identity || identity.length > 256)
        throw new Error('invalid shared quota identity')
      const digest = dependencies.identityDigest(identity)
      const bucket = Math.floor(dependencies.now() / WINDOW_MS)
      const keyPrefix = dependencies.keyPrefix ?? KEY_PREFIX
      const identityKey = `${keyPrefix}${bucket}:identity:${digest}`
      const globalKey = `${keyPrefix}${bucket}:global`
      const result = await dependencies.redis.eval(
        CONSUME_SCRIPT,
        [identityKey, globalKey],
        [
          String(dependencies.identityRequestsPerMinute),
          String(dependencies.globalRequestsPerMinute),
          String(KEY_TTL_SECONDS),
        ],
        signal,
      )
      signal?.throwIfAborted()
      return Number(result) === 1
    },
  }
}

const defaultLimiters = new Map<string, {
  identityRequestsPerMinute: number
  globalRequestsPerMinute: number
  limiter: SharedGatewayRateLimiter
}>()

export function getSharedGatewayRateLimiter(
  identityRequestsPerMinute: number,
  globalRequestsPerMinute: number,
  scope = 'model',
): SharedGatewayRateLimiter {
  const existing = defaultLimiters.get(scope)
  if (
    existing
    && (
      existing.identityRequestsPerMinute !== identityRequestsPerMinute
      || existing.globalRequestsPerMinute !== globalRequestsPerMinute
    )
  ) {
    throw new Error(`shared gateway ${scope} rate limits changed after initialization`)
  }
  if (!existing) {
    const limiter = createSharedGatewayRateLimiter({
      redis: {
        eval: (script, keys, args, signal) =>
          getRedis(signal).eval(script, keys, args),
      },
      now: Date.now,
      identityDigest: identity => createHash('sha256').update(identity).digest('hex'),
      identityRequestsPerMinute,
      globalRequestsPerMinute,
      keyPrefix: scope === 'model'
        ? KEY_PREFIX
        : `shared-ai:${scope}-rate:`,
    })
    defaultLimiters.set(scope, {
      identityRequestsPerMinute,
      globalRequestsPerMinute,
      limiter,
    })
    return limiter
  }
  return existing.limiter
}
