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
