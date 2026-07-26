import { Redis } from '@upstash/redis'

let cached: Redis | null = null

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
}

function readRedisConfig(): { url: string, token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN must be set',
    )
  }
  if (url !== url.trim())
    throw new Error('UPSTASH_REDIS_REST_URL must not contain surrounding whitespace')
  if (token.length > 16_384 || /\s/.test(token))
    throw new Error('UPSTASH_REDIS_REST_TOKEN must not contain whitespace')

  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error('UPSTASH_REDIS_REST_URL must be an absolute URL')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL must not contain credentials, query, or fragment',
    )
  }
  const localDevelopment = process.env.NODE_ENV !== 'production'
    && parsed.protocol === 'http:'
    && isLoopback(parsed.hostname)
  if (parsed.protocol !== 'https:' && !localDevelopment)
    throw new Error('UPSTASH_REDIS_REST_URL must use HTTPS')

  return { url, token }
}

export function getRedis(signal?: AbortSignal): Redis {
  if (!signal && cached)
    return cached
  const { url, token } = readRedisConfig()
  const redis = new Redis({ url, token, signal })
  if (!signal)
    cached = redis
  return redis
}
