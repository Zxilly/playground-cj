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
    vi.unstubAllEnvs()
    for (const key of envKeys)
      delete process.env[key]
  })

  it('requires base URL, access token, and user id configuration', async () => {
    const { findTokenIdByName } = await importApi()

    await expect(findTokenIdByName('token')).rejects.toThrow(
      'NEW_API_BASE_URL / NEW_API_ACCESS_TOKEN / NEW_API_USER_ID must be set',
    )
  })

  it('rejects plaintext admin transport in production before fetching', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEW_API_BASE_URL = 'http://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch')
    const { findTokenIdByName } = await importApi()

    await expect(findTokenIdByName('token')).rejects.toThrow(
      'NEW_API_BASE_URL must use HTTPS',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'https://user:password@new-api.example',
    'https://new-api.example?token=leak',
    'https://new-api.example/#fragment',
  ])('rejects an admin URL carrying credentials, query, or fragment: %s', async (url) => {
    process.env.NEW_API_BASE_URL = url
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch')
    const { findTokenIdByName } = await importApi()

    await expect(findTokenIdByName('token')).rejects.toThrow(
      'NEW_API_BASE_URL must not contain credentials, query, or fragment',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows plaintext admin transport only on loopback outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    process.env.NEW_API_BASE_URL = 'http://127.0.0.1:3001'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      success: true,
      message: '',
      data: { page: 1, page_size: 20, total: 0, items: [] },
    }))
    const { findTokenIdByName } = await importApi()

    await expect(findTokenIdByName('token')).resolves.toBeNull()
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3001/api/token/search?keyword=token&p=1&page_size=20',
    )
  })

  it.each([' leading', 'trailing ', 'line\nbreak'])(
    'rejects ambiguous new-api admin bearer tokens',
    async (token) => {
      process.env.NEW_API_BASE_URL = 'https://new-api.example'
      process.env.NEW_API_ACCESS_TOKEN = token
      process.env.NEW_API_USER_ID = '42'
      const fetch = vi.spyOn(globalThis, 'fetch')
      const { findTokenIdByName } = await importApi()

      await expect(findTokenIdByName('token')).rejects.toThrow(
        'NEW_API_ACCESS_TOKEN must not contain whitespace',
      )
      expect(fetch).not.toHaveBeenCalled()
    },
  )

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
        cache: 'no-store',
        signal: expect.anything(),
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
        data: { page: 1, page_size: 20, total: 1, items: [{ id: 7, name: 'identity-1', key: '' }] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: { key: 'sk-test' },
      }))
    const { provisionQuotaToken } = await importApi()

    await expect(
      provisionQuotaToken('identity-1', 123, 2_000_000_000),
    ).resolves.toEqual({ tokenId: 7, key: 'sk-test' })

    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/')
    expect(JSON.parse((fetch.mock.calls[1]?.[1] as RequestInit).body as string)).toMatchObject({
      name: 'identity-1',
      remain_quota: 123,
      expired_time: 2_000_000_000,
      group: 'students',
    })
    expect(fetch.mock.calls[3]?.[0]).toBe('https://new-api.example/api/token/7/key')
  })

  it('recovers the exact token when another process wins the lookup/create race', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: { page: 1, page_size: 20, total: 0, items: [] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: false,
        message: 'token name already exists',
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: {
          page: 1,
          page_size: 20,
          total: 1,
          items: [{ id: 8, name: 'identity-race', key: '' }],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: { key: 'sk-race-winner' },
      }))
    const { provisionQuotaToken } = await importApi()

    await expect(provisionQuotaToken('identity-race', 123, 2_000_000_000)).resolves.toEqual({
      tokenId: 8,
      key: 'sk-race-winner',
    })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
    expect(fetch.mock.calls[3]?.[0]).toBe('https://new-api.example/api/token/8/key')
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('fails closed when a failed create has no exact token to recover', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const emptySearch = {
      success: true,
      message: '',
      data: { page: 1, page_size: 20, total: 0, items: [] },
    }
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(emptySearch))
      .mockResolvedValueOnce(jsonResponse({
        success: false,
        message: 'token name already exists',
      }))
      .mockResolvedValueOnce(jsonResponse(emptySearch))
    const { provisionQuotaToken } = await importApi()

    await expect(provisionQuotaToken('identity-missing', 123, 2_000_000_000)).rejects.toThrow(
      'new-api create token failed: token name already exists',
    )
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
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

  it('lists only managed quota tokens across bounded pages and deletes by id', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: {
          page: 1,
          page_size: 100,
          total: 3,
          items: [
            {
              id: 7,
              name: 'pcj:s:aaaaaaaaaaaaaaaaaaaaaaaa',
              expired_time: 2_000_000_000,
            },
            {
              id: 8,
              name: 'operator-token',
              expired_time: -1,
            },
          ],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: {
          page: 2,
          page_size: 100,
          total: 3,
          items: [{
            id: 9,
            name: 'pcj:s:bbbbbbbbbbbbbbbbbbbbbbbb',
            expired_time: 2_000_000_100,
          }],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
      }))
    const { deleteQuotaToken, listManagedQuotaTokens } = await importApi()

    await expect(listManagedQuotaTokens('pcj:s:')).resolves.toEqual([
      {
        tokenId: 7,
        name: 'pcj:s:aaaaaaaaaaaaaaaaaaaaaaaa',
        expiresAt: 2_000_000_000_000,
      },
      {
        tokenId: 9,
        name: 'pcj:s:bbbbbbbbbbbbbbbbbbbbbbbb',
        expiresAt: 2_000_000_100_000,
      },
    ])
    await deleteQuotaToken(7)

    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://new-api.example/api/token/search?keyword=pcj%3As%3A&p=1&page_size=100',
    )
    expect(fetch.mock.calls[1]?.[0]).toContain('&p=2&page_size=100')
    expect(fetch.mock.calls[2]).toEqual([
      'https://new-api.example/api/token/7',
      expect.objectContaining({ method: 'DELETE' }),
    ])
  })

  it('recovers a token after Redis cache loss without replenishing its quota', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: '',
        data: {
          page: 1,
          page_size: 20,
          total: 1,
          items: [{ id: 7, name: 'identity-1', key: '' }],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '', data: { key: 'sk-test' } }))
    const { provisionQuotaToken } = await importApi()

    await expect(provisionQuotaToken('identity-1', 123, 2_000_000_000)).resolves.toEqual({
      tokenId: 7,
      key: 'sk-test',
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/7/key')
    expect(fetch.mock.calls.some(([url]) =>
      url === 'https://new-api.example/api/token/'
      || url === 'https://new-api.example/api/token/?status_only=1')).toBe(false)
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

    await resetTokenRemainQuota(9, 250000, 2_000_000_000)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0]?.[0]).toBe('https://new-api.example/api/token/9')
    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/')
    const refillCall = fetch.mock.calls[1]
    expect((refillCall?.[1] as RequestInit).method).toBe('PUT')
    const refillBody = JSON.parse((refillCall?.[1] as RequestInit).body as string)
    expect(refillBody).toMatchObject({
      id: 9,
      remain_quota: 250000,
      expired_time: 2_000_000_000,
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

    await resetTokenRemainQuota(9, 250000, 2_000_000_000)

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1]?.[0]).toBe('https://new-api.example/api/token/')
    const refillBody = JSON.parse((fetch.mock.calls[1]?.[1] as RequestInit).body as string)
    expect(refillBody.status).toBe(4) // preserved during refill
    expect(refillBody.remain_quota).toBe(250000)
    expect(refillBody.expired_time).toBe(2_000_000_000)

    expect(fetch.mock.calls[2]?.[0]).toBe('https://new-api.example/api/token/?status_only=1')
    const reenableBody = JSON.parse((fetch.mock.calls[2]?.[1] as RequestInit).body as string)
    expect(reenableBody.status).toBe(1)
    expect(reenableBody.remain_quota).toBe(250000)
  })

  it.each([
    { label: 'administrator-disabled', status: 2 },
    { label: 'expired', status: 3 },
  ])('fails closed before any PUT for a $label token', async ({ status }) => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      success: true,
      message: '',
      data: {
        id: 9,
        user_id: 42,
        name: 'playground-cj:identity-1',
        status,
        expired_time: -1,
        remain_quota: 0,
        unlimited_quota: false,
        model_limits_enabled: false,
        model_limits: '',
        allow_ips: null,
        group: 'default',
        cross_group_retry: false,
      },
    }))
    const { resetTokenRemainQuota } = await importApi()

    await expect(resetTokenRemainQuota(9, 250000, 2_000_000_000)).rejects.toThrow(
      'new-api: refusing to reset a token that is not enabled or quota-exhausted',
    )
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('surfaces errors from the token detail fetch', async () => {
    process.env.NEW_API_BASE_URL = 'https://new-api.example'
    process.env.NEW_API_ACCESS_TOKEN = 'secret'
    process.env.NEW_API_USER_ID = '42'
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ success: false, message: 'not found' }),
    )
    const { resetTokenRemainQuota } = await importApi()

    await expect(resetTokenRemainQuota(9, 250000, 2_000_000_000)).rejects.toThrow(
      'new-api fetch token detail failed: not found',
    )
  })
})
