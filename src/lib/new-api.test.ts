import { afterEach, describe, expect, it, vi } from 'vitest'

const envKeys = [
  'NEW_API_BASE_URL',
  'NEW_API_ACCESS_TOKEN',
  'NEW_API_USER_ID',
  'NEW_API_TOKEN_GROUP',
] as const

async function importApi() {
  vi.resetModules()
  return import('@/lib/new-api')
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init)
}

describe('new-api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    for (const key of envKeys)
      delete process.env[key]
  })

  it('requires base URL, access token, and user id configuration', async () => {
    const { findTokenIdByName } = await importApi()

    await expect(findTokenIdByName('token')).rejects.toThrow(
      'NEW_API_BASE_URL / NEW_API_ACCESS_TOKEN / NEW_API_USER_ID must be set',
    )
  })

  it('finds only an exact token name and sends auth headers', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example/'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      success: true,
      message: '',
      data: {
        page: 1,
        page_size: 20,
        total: 2,
        items: [
          { id: 1, name: 'token-old', key: 'old' },
          { id: 2, name: 'token', key: 'new' },
        ],
      },
    }))
    const { findTokenIdByName } = await importApi()

    await expect(findTokenIdByName('token')).resolves.toBe(2)

    expect(fetch).toHaveBeenCalledWith(
      'https://new-api.example/api/token/search?keyword=token&p=1&page_size=20',
      {
        headers: {
          'Authorization': 'Bearer secret',
          'New-Api-User': '42',
          'Content-Type': 'application/json',
        },
      },
    )
  })

  it('surfaces HTTP and envelope errors', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch')
    const { findTokenIdByName } = await importApi()

    fetch.mockResolvedValueOnce(jsonResponse({ success: true }, { status: 503 }))
    await expect(findTokenIdByName('token')).rejects.toThrow('new-api search token failed: HTTP 503')

    fetch.mockResolvedValueOnce(jsonResponse({ success: false, message: 'denied' }))
    await expect(findTokenIdByName('token')).rejects.toThrow('new-api search token failed: denied')
  })

  it('creates a missing token, locates it, then fetches its key', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    process.env.NEW_API_TOKEN_GROUP = 'students'
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: { page: 1, page_size: 20, total: 0, items: [] },
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '' }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: { page: 1, page_size: 20, total: 1, items: [{ id: 7, name: 'ip-1', key: '' }] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: { key: 'sk-test' },
      }))
    const { provisionTokenForIp } = await importApi()

    await expect(provisionTokenForIp('ip-1', 123)).resolves.toEqual({ tokenId: 7, key: 'sk-test' })

    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/')
    expect(JSON.parse((fetch.mock.calls[1]?.[1] as RequestInit).body as string)).toMatchObject({
      name: 'ip-1',
      remain_quota: 123,
      group: 'students',
    })
    expect(fetch.mock.calls[3]?.[0]).toBe('https://new-api.example/api/token/7/key')
  })

  it('throws when a fetched token key is missing', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      success: true,
      message: '',
      data: {},
    }))
    const { fetchTokenKey } = await importApi()

    await expect(fetchTokenKey(7)).rejects.toThrow('new-api fetch token key: missing key in response')
  })

  it('resets remain_quota with a single PUT when the token is already enabled', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const detail = {
      id: 9,
      user_id: 42,
      name: 'playground-cj:ip-1',
      status: 1,
      expired_time: -1,
      remain_quota: 0,
      unlimited_quota: false,
      model_limits_enabled: false,
      model_limits: '',
      allow_ips: null,
      group: 'default',
      cross_group_retry: false,
    }
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '', data: detail }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '' }))
    const { resetTokenRemainQuota } = await importApi()

    await resetTokenRemainQuota(9, 250000)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0]?.[0]).toBe('https://new-api.example/api/token/9')
    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/')
    const refillCall = fetch.mock.calls[1]
    expect((refillCall?.[1] as RequestInit).method).toBe('PUT')
    const refillBody = JSON.parse((refillCall?.[1] as RequestInit).body as string)
    expect(refillBody).toMatchObject({
      id: 9,
      remain_quota: 250000,
      status: 1,
      name: 'playground-cj:ip-1',
      group: 'default',
    })
  })

  it('re-enables an exhausted token with a second status_only PUT', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const detail = {
      id: 9,
      user_id: 42,
      name: 'playground-cj:ip-1',
      status: 4, // exhausted
      expired_time: -1,
      remain_quota: 0,
      unlimited_quota: false,
      model_limits_enabled: false,
      model_limits: '',
      allow_ips: null,
      group: 'default',
      cross_group_retry: false,
    }
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '', data: detail }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '' }))
    const { resetTokenRemainQuota } = await importApi()

    await resetTokenRemainQuota(9, 250000)

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/')
    const refillBody = JSON.parse((fetch.mock.calls[1]?.[1] as RequestInit).body as string)
    expect(refillBody.status).toBe(4) // preserved during refill
    expect(refillBody.remain_quota).toBe(250000)

    expect(fetch.mock.calls[2]?.[0]).toBe('https://new-api.example/api/token/?status_only=1')
    const reenableBody = JSON.parse((fetch.mock.calls[2]?.[1] as RequestInit).body as string)
    expect(reenableBody.status).toBe(1)
    expect(reenableBody.remain_quota).toBe(250000)
  })

  it('surfaces errors from the token detail fetch', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ success: false, message: 'not found' }),
    )
    const { resetTokenRemainQuota } = await importApi()

    await expect(resetTokenRemainQuota(9, 250000)).rejects.toThrow(
      'new-api fetch token detail failed: not found',
    )
  })
})
