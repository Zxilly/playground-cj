interface NewApiEnvelope<T> {
  success: boolean
  message: string
  data?: T
}

interface NewApiToken {
  id: number
  name: string
  key: string
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

interface NewApiConfig {
  baseURL: string
  accessToken: string
  userId: string
  group: string
}

function readConfig(): NewApiConfig {
  const baseURL = process.env.NEW_API_BASE_URL
  const accessToken = process.env.NEW_API_ACCESS_TOKEN
  const userId = process.env.NEW_API_USER_ID
  const group = process.env.NEW_API_TOKEN_GROUP || 'default'
  if (!baseURL || !accessToken || !userId)
    throw new Error('NEW_API_BASE_URL / NEW_API_ACCESS_TOKEN / NEW_API_USER_ID must be set')
  return { baseURL: baseURL.replace(/\/$/, ''), accessToken, userId, group }
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

export async function findTokenIdByName(name: string): Promise<number | null> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/search?keyword=${encodeURIComponent(name)}&p=1&page_size=20`
  const resp = await fetch(url, { headers: authHeaders(cfg) })
  const data = await expectSuccess<NewApiPage<NewApiToken>>(resp, 'search token')
  const items = data?.items ?? []
  const exact = items.find(t => t.name === name)
  return exact ? exact.id : null
}

async function createTokenRow(name: string, quota: number): Promise<void> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/`
  const body = {
    name,
    remain_quota: quota,
    unlimited_quota: false,
    expired_time: -1,
    model_limits_enabled: false,
    allow_ips: null,
    group: cfg.group,
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
  })
  await expectSuccess<unknown>(resp, 'create token')
}

export async function fetchTokenKey(id: number): Promise<string> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/${id}/key`
  const resp = await fetch(url, { method: 'POST', headers: authHeaders(cfg) })
  const data = await expectSuccess<{ key: string }>(resp, 'fetch token key')
  if (!data?.key)
    throw new Error('new-api fetch token key: missing key in response')
  return data.key
}

export async function fetchTokenDetail(id: number): Promise<NewApiTokenDetail> {
  const cfg = readConfig()
  const url = `${cfg.baseURL}/api/token/${id}`
  const resp = await fetch(url, { headers: authHeaders(cfg) })
  const data = await expectSuccess<NewApiTokenDetail>(resp, 'fetch token detail')
  if (!data)
    throw new Error('new-api fetch token detail: empty response')
  return data
}

export async function provisionTokenForIp(name: string, quota: number): Promise<{ tokenId: number, key: string }> {
  let tokenId = await findTokenIdByName(name)
  if (tokenId == null) {
    await createTokenRow(name, quota)
    tokenId = await findTokenIdByName(name)
    if (tokenId == null)
      throw new Error('new-api: created token but could not locate it by name')
  }
  const key = await fetchTokenKey(tokenId)
  return { tokenId, key }
}

// Resets Token.RemainQuota to the given value. If the token had previously
// reached the Exhausted state (status 4), also re-enables it. UpdateToken
// rejects enabling an exhausted token whose cleanToken.RemainQuota is still 0,
// so this is done in two PUT calls: first refill quota while preserving the
// original status, then flip status to Enabled.
export async function resetTokenRemainQuota(id: number, remainQuota: number): Promise<void> {
  const cfg = readConfig()
  const detail = await fetchTokenDetail(id)

  const refillBody = {
    id: detail.id,
    name: detail.name,
    status: detail.status,
    expired_time: detail.expired_time,
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
  })
  await expectSuccess<unknown>(refillResp, 'reset token quota')

  if (detail.status === TOKEN_STATUS_ENABLED)
    return

  const reenableBody = { ...refillBody, status: TOKEN_STATUS_ENABLED }
  const reenableResp = await fetch(`${cfg.baseURL}/api/token/?status_only=1`, {
    method: 'PUT',
    headers: authHeaders(cfg),
    body: JSON.stringify(reenableBody),
  })
  await expectSuccess<unknown>(reenableResp, 're-enable token')
}
