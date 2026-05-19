import { headers } from 'next/headers'
import { getRedis } from '@/lib/redis'
import { readClientIp } from '@/lib/client-ip'
import { provisionTokenForIp, resetTokenRemainQuota } from '@/lib/new-api'
import { nextResetAtMs } from '@/lib/quota-reset'

export const runtime = 'nodejs'

interface CachedToken {
  key: string
  tokenId: number
  createdAt: number
  lastResetAt: number
  nextResetAt: number
}

interface ApiResponse {
  baseURL: string
  apiKey: string
  model: string
  quota: {
    nextResetAt: number
  }
}

const PER_IP_QUOTA = 1000000
const REDIS_TTL_SECONDS = 60 * 60 * 24 * 30
const LOCK_TTL_SECONDS = 10
const POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 500
const TOKEN_NAME_PREFIX = 'playground-cj:'
const CACHE_KEY_PREFIX = 'ai-key:ip:'
const LOCK_KEY_PREFIX = 'ai-key:lock:'

function publicBaseURL(): string {
  return process.env.NEXT_PUBLIC_LLM_BASE_URL || 'https://llm.learningman.top/v1'
}

function defaultModel(): string {
  return process.env.NEXT_PUBLIC_LLM_DEFAULT_MODEL || 'gpt-4o-mini'
}

function buildResponse(cached: CachedToken): ApiResponse {
  return {
    baseURL: publicBaseURL(),
    apiKey: cached.key,
    model: defaultModel(),
    quota: { nextResetAt: cached.nextResetAt },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type RedisClient = ReturnType<typeof getRedis>

function isDue(cached: CachedToken, now: number): boolean {
  // typeof guard tolerates cached payloads written before nextResetAt existed.
  const dueAt = typeof cached.nextResetAt === 'number' ? cached.nextResetAt : 0
  return now >= dueAt
}

async function maybeRefillQuota(
  redis: RedisClient,
  cacheKey: string,
  lockKey: string,
  cached: CachedToken,
): Promise<CachedToken> {
  if (!isDue(cached, Date.now()))
    return cached

  const acquired = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS)
      const c = await redis.get<CachedToken>(cacheKey)
      if (c?.key && !isDue(c, Date.now()))
        return c
    }
    return cached
  }

  try {
    const current = await redis.get<CachedToken>(cacheKey)
    if (current?.key && !isDue(current, Date.now()))
      return current

    const target = current?.key ? current : cached
    await resetTokenRemainQuota(target.tokenId, PER_IP_QUOTA)
    const now = Date.now()
    const refreshed: CachedToken = {
      ...target,
      lastResetAt: now,
      nextResetAt: nextResetAtMs(now),
    }
    await redis.set(cacheKey, refreshed, { ex: REDIS_TTL_SECONDS })
    return refreshed
  }
  finally {
    await redis.del(lockKey)
  }
}

export async function GET() {
  const h = await headers()
  const ip = readClientIp(h)
  const cacheKey = `${CACHE_KEY_PREFIX}${ip}`
  const lockKey = `${LOCK_KEY_PREFIX}${ip}`

  const redis = getRedis()

  const cached = await redis.get<CachedToken>(cacheKey)
  if (cached?.key) {
    try {
      const fresh = await maybeRefillQuota(redis, cacheKey, lockKey, cached)
      return Response.json(buildResponse(fresh))
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'unknown error'
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const acquired = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS)
      const c = await redis.get<CachedToken>(cacheKey)
      if (c?.key)
        return Response.json(buildResponse(c))
    }
    return new Response(JSON.stringify({ error: 'busy' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const existing = await redis.get<CachedToken>(cacheKey)
    if (existing?.key)
      return Response.json(buildResponse(existing))

    const ipName = `${TOKEN_NAME_PREFIX}${ip}`
    const { tokenId, key } = await provisionTokenForIp(ipName, PER_IP_QUOTA)

    const now = Date.now()
    const value: CachedToken = {
      key,
      tokenId,
      createdAt: now,
      lastResetAt: now,
      nextResetAt: nextResetAtMs(now),
    }
    await redis.set(cacheKey, value, { ex: REDIS_TTL_SECONDS })

    return Response.json(buildResponse(value))
  }
  catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  finally {
    await redis.del(lockKey)
  }
}
