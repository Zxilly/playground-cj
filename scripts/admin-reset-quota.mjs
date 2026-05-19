#!/usr/bin/env node
// Refill a per-IP playground token in new-api and refresh the matching Redis
// cache entry. Use this when the daily quota was burned during testing and you
// want a fresh window without waiting for the next Asia/Shanghai midnight.
//
// Usage:
//   node --env-file=.env scripts/admin-reset-quota.mjs [--ip <ip>] [--quota <n>]
//
// Defaults:
//   --ip unknown    Matches the cache key for local dev requests that carry
//                   no x-forwarded-for / x-real-ip header.
//   --quota 1000000 Must match PER_IP_QUOTA in src/app/api/ai-key/route.ts.

import { Redis } from '@upstash/redis'

const TOKEN_STATUS_ENABLED = 1
const REDIS_TTL_SECONDS = 60 * 60 * 24 * 30
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--'))
      continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    }
    else {
      out[key] = true
    }
  }
  return out
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var ${name}. Run with: node --env-file=.env scripts/admin-reset-quota.mjs`)
    process.exit(1)
  }
  return v
}

function nextShanghaiMidnight(now) {
  const shifted = now + SHANGHAI_OFFSET_MS
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS
  return dayStart + DAY_MS - SHANGHAI_OFFSET_MS
}

async function callNewApi(label, url, init) {
  const resp = await fetch(url, init)
  if (!resp.ok)
    throw new Error(`new-api ${label} failed: HTTP ${resp.status} ${await resp.text().catch(() => '')}`)
  const json = await resp.json()
  if (json.success === false)
    throw new Error(`new-api ${label} failed: ${json.message || 'unknown error'}`)
  return json.data
}

const args = parseArgs(process.argv.slice(2))
const ip = typeof args.ip === 'string' ? args.ip : 'unknown'
const quota = Number(args.quota ?? 1_000_000)
if (!Number.isFinite(quota) || quota <= 0) {
  console.error(`Invalid --quota value: ${args.quota}`)
  process.exit(1)
}

const baseURL = requireEnv('NEW_API_BASE_URL').replace(/\/$/, '')
const accessToken = requireEnv('NEW_API_ACCESS_TOKEN')
const userId = requireEnv('NEW_API_USER_ID')
const group = process.env.NEW_API_TOKEN_GROUP || 'default'
const upstashUrl = requireEnv('UPSTASH_REDIS_REST_URL')
const upstashToken = requireEnv('UPSTASH_REDIS_REST_TOKEN')

const authHeaders = {
  'Authorization': `Bearer ${accessToken}`,
  'New-Api-User': userId,
  'Content-Type': 'application/json',
}

const tokenName = `playground-cj:${ip}`
const cacheKey = `ai-key:ip:${ip}`

// 1. Locate the token
const page = await callNewApi(
  'search token',
  `${baseURL}/api/token/search?keyword=${encodeURIComponent(tokenName)}&p=1&page_size=20`,
  { headers: authHeaders },
)
const exact = (page?.items ?? []).find(t => t.name === tokenName)
if (!exact) {
  console.error(`No token found with name "${tokenName}". Was it ever provisioned via /api/ai-key for this IP?`)
  process.exit(2)
}
const tokenId = exact.id

// 2. Fetch detail to preserve fields during PUT (mirrors resetTokenRemainQuota)
const detail = await callNewApi('fetch token detail', `${baseURL}/api/token/${tokenId}`, { headers: authHeaders })

// 3. Refill remain_quota, preserving status. UpdateToken rejects enabling an
//    exhausted token in a single call, so re-enabling happens in step 4.
const refillBody = {
  id: detail.id,
  name: detail.name,
  status: detail.status,
  expired_time: detail.expired_time,
  remain_quota: quota,
  unlimited_quota: detail.unlimited_quota,
  model_limits_enabled: detail.model_limits_enabled,
  model_limits: detail.model_limits,
  allow_ips: detail.allow_ips,
  group: detail.group,
  cross_group_retry: detail.cross_group_retry,
}
await callNewApi('reset token quota', `${baseURL}/api/token/`, {
  method: 'PUT',
  headers: authHeaders,
  body: JSON.stringify(refillBody),
})

if (detail.status !== TOKEN_STATUS_ENABLED) {
  await callNewApi('re-enable token', `${baseURL}/api/token/?status_only=1`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ ...refillBody, status: TOKEN_STATUS_ENABLED }),
  })
}

// 4. Fetch the key so the cache entry stays valid for the frontend
const keyResp = await callNewApi('fetch token key', `${baseURL}/api/token/${tokenId}/key`, {
  method: 'POST',
  headers: authHeaders,
})
const tokenKey = keyResp?.key
if (!tokenKey)
  throw new Error('new-api fetch token key: response missing "key"')

// 5. Refresh the Redis cache so /api/ai-key trusts the refill and exposes a
//    fresh nextResetAt to the frontend (otherwise the bootstrap probe still
//    sees exhausted=true until the next Shanghai midnight).
const redis = new Redis({ url: upstashUrl, token: upstashToken })
const now = Date.now()
const nextResetAt = nextShanghaiMidnight(now)
await redis.set(cacheKey, {
  key: tokenKey,
  tokenId,
  createdAt: now,
  lastResetAt: now,
  nextResetAt,
}, { ex: REDIS_TTL_SECONDS })

console.log(`✓ Refilled token "${tokenName}" (id=${tokenId}, group=${group}) to ${quota.toLocaleString()} quota`)
console.log(`✓ Redis cache "${cacheKey}" updated; next reset at ${new Date(nextResetAt).toISOString()}`)
