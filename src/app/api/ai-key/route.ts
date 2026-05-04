import { headers } from 'next/headers'
import { getRedis } from '@/lib/redis'
import { provisionTokenForIp } from '@/lib/new-api'

export const runtime = 'nodejs'

interface CachedToken {
  key: string
  tokenId: number
  createdAt: number
}

interface ApiResponse {
  baseURL: string
  apiKey: string
  model: string
}

const PER_IP_QUOTA = 250000
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

function buildResponse(apiKey: string): ApiResponse {
  return {
    baseURL: publicBaseURL(),
    apiKey,
    model: defaultModel(),
  }
}

function readClientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first)
      return first
  }
  return h.get('x-real-ip')?.trim() || 'unknown'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET() {
  const h = await headers()
  const ip = readClientIp(h)
  const cacheKey = `${CACHE_KEY_PREFIX}${ip}`
  const lockKey = `${LOCK_KEY_PREFIX}${ip}`

  const redis = getRedis()

  const cached = await redis.get<CachedToken>(cacheKey)
  if (cached?.key)
    return Response.json(buildResponse(cached.key))

  const acquired = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS)
      const c = await redis.get<CachedToken>(cacheKey)
      if (c?.key)
        return Response.json(buildResponse(c.key))
    }
    return new Response(JSON.stringify({ error: 'busy' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const existing = await redis.get<CachedToken>(cacheKey)
    if (existing?.key)
      return Response.json(buildResponse(existing.key))

    const ipName = `${TOKEN_NAME_PREFIX}${ip}`
    const { tokenId, key } = await provisionTokenForIp(ipName, PER_IP_QUOTA)

    const value: CachedToken = { key, tokenId, createdAt: Date.now() }
    await redis.set(cacheKey, value, { ex: REDIS_TTL_SECONDS })

    return Response.json(buildResponse(key))
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
