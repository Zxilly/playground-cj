interface NewApiEnvelope<T> {
  success: boolean
  message: string
  data?: T
}

interface NewApiToken {
  id: number
  name: string
  key: string
  expired_time?: number
}

interface NewApiPage<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export const TOKEN_STATUS_ENABLED = 1
export const TOKEN_STATUS_DISABLED = 2
export const TOKEN_STATUS_EXPIRED = 3
export const TOKEN_STATUS_EXHAUSTED = 4

export interface NewApiTokenDetail {
  id: number
  user_id: number
  name: string
  status: number
  expired_time: number
  remain_quota: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits: string
  allow_ips: string | null
  group: string
  cross_group_retry: boolean
}

export interface ManagedQuotaToken {
  readonly tokenId: number
  readonly name: string
  /** Absolute Unix time in milliseconds. */
  readonly expiresAt: number
}

interface NewApiConfig {
  baseURL: string
  accessToken: string
  userId: string
  group: string
}

const NEW_API_REQUEST_TIMEOUT_MS = 10_000
const MANAGED_TOKEN_PAGE_SIZE = 100
const MAX_MANAGED_TOKEN_PAGES = 20

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
}

function validatedBaseURL(raw: string): string {
  if (raw !== raw.trim())
    throw new Error('NEW_API_BASE_URL must not contain surrounding whitespace')

  let parsed: URL
  try {
    parsed = new URL(raw)
  }
  catch {
    throw new Error('NEW_API_BASE_URL must be an absolute URL')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      'NEW_API_BASE_URL must not contain credentials, query, or fragment',
    )
  }
  const localDevelopment = process.env.NODE_ENV !== 'production'
    && parsed.protocol === 'http:'
    && isLoopback(parsed.hostname)
  if (parsed.protocol !== 'https:' && !localDevelopment)
    throw new Error('NEW_API_BASE_URL must use HTTPS')

  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.toString().replace(/\/$/, '')
}

function readConfig(): NewApiConfig {
  const baseURL = process.env.NEW_API_BASE_URL
  const accessToken = process.env.NEW_API_ACCESS_TOKEN
  const userId = process.env.NEW_API_USER_ID
  const group = process.env.NEW_API_TOKEN_GROUP || 'default'
  if (!baseURL || !accessToken || !userId)
    throw new Error('NEW_API_BASE_URL / NEW_API_ACCESS_TOKEN / NEW_API_USER_ID must be set')
  if (accessToken.length > 16_384 || /\s/.test(accessToken))
    throw new Error('NEW_API_ACCESS_TOKEN must not contain whitespace')
  if (!/^[1-9]\d{0,19}$/.test(userId))
    throw new Error('NEW_API_USER_ID must be a positive decimal identifier')
  if (
    group !== group.trim()
    || group.length > 64
    || [...group].some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 0x1F || codePoint === 0x7F)
    })
  ) {
    throw new Error('NEW_API_TOKEN_GROUP must be a bounded plain value')
  }
  return {
    baseURL: validatedBaseURL(baseURL),
    accessToken,
    userId,
    group,
  }
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const requestTimeout = AbortSignal.timeout(NEW_API_REQUEST_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, requestTimeout]) : requestTimeout
}

function authHeaders(cfg: NewApiConfig): HeadersInit {
  return {
    'Authorization': `Bearer ${cfg.accessToken}`,
    'New-Api-User': cfg.userId,
    'Content-Type': 'application/json',
  }
}

async function expectSuccess<T>(resp: Response, label: string): Promise<T | undefined> {
  if (!resp.ok)
    throw new Error(`new-api ${label} failed: HTTP ${resp.status}`)
  const json = await resp.json() as NewApiEnvelope<T>
  if (!json.success)
    throw new Error(`new-api ${label} failed: ${json.message || 'unknown error'}`)
  return json.data
}

export async function findTokenIdByName(name: string, signal?: AbortSignal): Promise<number | null> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/search?keyword=${encodeURIComponent(name)}&p=1&page_size=20`
  const resp = await fetch(url, {
    headers: authHeaders(cfg),
    cache: 'no-store',
    signal: requestSignal(signal),
  })
  const data = await expectSuccess<NewApiPage<NewApiToken>>(resp, 'search token')
  const items = data?.items ?? []
  const exact = items.find(t => t.name === name)
  return exact ? exact.id : null
}

async function createTokenRow(
  name: string,
  quota: number,
  expiresAtSeconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= 0)
    throw new Error('new-api token expiry must be a positive Unix timestamp')
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/`
  const body = {
    name,
    remain_quota: quota,
    unlimited_quota: false,
    expired_time: expiresAtSeconds,
    model_limits_enabled: false,
    allow_ips: null,
    group: cfg.group,
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
    signal: requestSignal(signal),
  })
  await expectSuccess<unknown>(resp, 'create token')
}

export async function fetchTokenKey(id: number, signal?: AbortSignal): Promise<string> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/${id}/key`
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(cfg),
    signal: requestSignal(signal),
  })
  const data = await expectSuccess<{ key: string }>(resp, 'fetch token key')
  if (!data?.key)
    throw new Error('new-api fetch token key: missing key in response')
  return data.key
}

export async function fetchTokenDetail(id: number, signal?: AbortSignal): Promise<NewApiTokenDetail> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/${id}`
  const resp = await fetch(url, {
    headers: authHeaders(cfg),
    cache: 'no-store',
    signal: requestSignal(signal),
  })
  const data = await expectSuccess<NewApiTokenDetail>(resp, 'fetch token detail')
  if (!data)
    throw new Error('new-api fetch token detail: empty response')
  return data
}

export async function provisionQuotaToken(
  name: string,
  quota: number,
  expiresAtSeconds: number,
  signal?: AbortSignal,
): Promise<{ tokenId: number, key: string }> {
  let tokenId = await findTokenIdByName(name, signal)
  if (tokenId == null) {
    let createError: unknown
    try {
      await createTokenRow(name, quota, expiresAtSeconds, signal)
    }
    catch (error) {
      createError = error
    }

    // Another process may create the deterministic token after our first
    // lookup. Recover that exact token after a create conflict; if it still
    // cannot be found, fail closed without resetting or creating a substitute.
    tokenId = await findTokenIdByName(name, signal)
    if (tokenId == null) {
      if (createError)
        throw createError
      throw new Error('new-api: created token but could not locate it by name')
    }
  }
  // Finding an existing deterministic token is recovery, never a refill. Only
  // the quota broker may reset it at an observed period boundary while holding
  // the per-identity distributed lock.
  const key = await fetchTokenKey(tokenId, signal)
  return { tokenId, key }
}

function managedTokenFromRow(
  value: NewApiToken,
  prefix: string,
): ManagedQuotaToken | null {
  if (typeof value.name !== 'string' || value.name.length > 50)
    throw new Error('new-api managed token inventory contains an invalid name')
  if (!value.name.startsWith(prefix))
    return null
  if (!Number.isInteger(value.id) || value.id <= 0)
    throw new Error('new-api managed token inventory contains an invalid id')
  if (!Number.isSafeInteger(value.expired_time)) {
    throw new TypeError(
      'new-api managed token inventory contains an invalid expiry',
    )
  }
  return {
    tokenId: value.id,
    name: value.name,
    // A permanent row can exist from an older deployment. Retain and count it
    // until that identity crosses a quota boundary and receives finite expiry.
    expiresAt: value.expired_time === -1
      ? Number.MAX_SAFE_INTEGER
      : value.expired_time! * 1_000,
  }
}

export async function listManagedQuotaTokens(
  prefix: string,
  signal?: AbortSignal,
): Promise<readonly ManagedQuotaToken[]> {
  if (!prefix || prefix.length > 30)
    throw new Error('new-api managed token prefix is invalid')
  const cfg = readConfig()
  const managed: ManagedQuotaToken[] = []
  let seenRows = 0
  let expectedTotal: number | null = null

  for (let page = 1; page <= MAX_MANAGED_TOKEN_PAGES; page++) {
    const url = `${cfg.baseURL}/api/token/search?keyword=${
      encodeURIComponent(prefix)
    }&p=${page}&page_size=${MANAGED_TOKEN_PAGE_SIZE}`
    const resp = await fetch(url, {
      headers: authHeaders(cfg),
      cache: 'no-store',
      signal: requestSignal(signal),
    })
    const data = await expectSuccess<NewApiPage<NewApiToken>>(
      resp,
      'list managed tokens',
    )
    if (
      !data
      || !Number.isSafeInteger(data.total)
      || data.total < 0
      || !Array.isArray(data.items)
    ) {
      throw new Error('new-api managed token inventory is malformed')
    }
    if (expectedTotal !== null && data.total !== expectedTotal)
      throw new Error('new-api managed token inventory changed during paging')
    expectedTotal = data.total
    seenRows += data.items.length
    for (const row of data.items) {
      const token = managedTokenFromRow(row, prefix)
      if (token)
        managed.push(token)
    }
    if (seenRows >= expectedTotal)
      return managed
    if (data.items.length === 0)
      throw new Error('new-api managed token inventory ended before total')
  }
  throw new Error('new-api managed token inventory exceeds the paging bound')
}

export async function deleteQuotaToken(
  id: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0)
    throw new Error('new-api token id is invalid')
  const cfg = readConfig()
  const resp = await fetch(`${cfg.baseURL}/api/token/${id}`, {
    method: 'DELETE',
    headers: authHeaders(cfg),
    signal: requestSignal(signal),
  })
  await expectSuccess<unknown>(resp, 'delete token')
}

// Resets Token.RemainQuota to the given value. If the token had previously
// reached the Exhausted state (status 4), also re-enables it. UpdateToken
// rejects enabling an exhausted token whose cleanToken.RemainQuota is still 0,
// so this is done in two PUT calls: first refill quota while preserving the
// original status, then flip status to Enabled. Administrator-disabled and
// expired tokens are never changed by the automatic quota broker.
export async function resetTokenRemainQuota(
  id: number,
  remainQuota: number,
  expiresAtSeconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= 0)
    throw new Error('new-api token expiry must be a positive Unix timestamp')
  const cfg = readConfig()
  const detail = await fetchTokenDetail(id, signal)
  if (
    detail.status !== TOKEN_STATUS_ENABLED
    && detail.status !== TOKEN_STATUS_EXHAUSTED
  ) {
    throw new Error(
      'new-api: refusing to reset a token that is not enabled or quota-exhausted',
    )
  }

  const refillBody = {
    id: detail.id,
    name: detail.name,
    status: detail.status,
    expired_time: expiresAtSeconds,
    remain_quota: remainQuota,
    unlimited_quota: detail.unlimited_quota,
    model_limits_enabled: detail.model_limits_enabled,
    model_limits: detail.model_limits,
    allow_ips: detail.allow_ips,
    group: detail.group,
    cross_group_retry: detail.cross_group_retry,
  }
  const refillResp = await fetch(`${cfg.baseURL}/api/token/`, {
    method: 'PUT',
    headers: authHeaders(cfg),
    body: JSON.stringify(refillBody),
    signal: requestSignal(signal),
  })
  await expectSuccess<unknown>(refillResp, 'reset token quota')

  if (detail.status === TOKEN_STATUS_ENABLED)
    return

  const reenableBody = { ...refillBody, status: TOKEN_STATUS_ENABLED }
  const reenableResp = await fetch(`${cfg.baseURL}/api/token/?status_only=1`, {
    method: 'PUT',
    headers: authHeaders(cfg),
    body: JSON.stringify(reenableBody),
    signal: requestSignal(signal),
  })
  await expectSuccess<unknown>(reenableResp, 're-enable token')
}
