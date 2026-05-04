import { Redis } from '@upstash/redis'

let cached: Redis | null = null

export function getRedis(): Redis {
  if (cached)
    return cached
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token)
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN must be set')
  cached = new Redis({ url, token })
  return cached
}
