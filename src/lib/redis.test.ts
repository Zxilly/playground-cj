import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const Redis = vi.hoisted(() => vi.fn(class RedisMock {}))

vi.mock('@upstash/redis', () => ({ Redis }))

const { getRedis } = await import('./redis')

describe('getRedis', () => {
  beforeEach(() => {
    Redis.mockClear()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('binds a request signal to the concrete Upstash HTTP client', () => {
    const controller = new AbortController()

    getRedis(controller.signal)

    expect(Redis).toHaveBeenCalledWith({
      url: 'https://redis.example',
      token: 'secret',
      signal: controller.signal,
    })
  })

  it('does not reuse a client bound to a different request signal', () => {
    const first = new AbortController()
    const second = new AbortController()

    expect(getRedis(first.signal)).not.toBe(getRedis(second.signal))
    expect(Redis).toHaveBeenCalledTimes(2)
  })

  it('rejects plaintext Redis transport in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'http://redis.example')

    expect(() => getRedis(new AbortController().signal)).toThrow(
      'UPSTASH_REDIS_REST_URL must use HTTPS',
    )
    expect(Redis).not.toHaveBeenCalled()
  })

  it.each([
    'https://user:password@redis.example',
    'https://redis.example?token=leak',
    'https://redis.example/#fragment',
  ])('rejects Redis URLs carrying request-external state: %s', (url) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', url)

    expect(() => getRedis(new AbortController().signal)).toThrow(
      'must not contain credentials, query, or fragment',
    )
    expect(Redis).not.toHaveBeenCalled()
  })

  it('allows plaintext Redis only on loopback outside production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'http://127.0.0.1:8079')

    getRedis(new AbortController().signal)

    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://127.0.0.1:8079',
    }))
  })

  it.each([' leading', 'trailing ', 'line\nbreak'])(
    'rejects ambiguous Redis bearer tokens',
    (token) => {
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', token)

      expect(() => getRedis(new AbortController().signal)).toThrow(
        'UPSTASH_REDIS_REST_TOKEN must not contain whitespace',
      )
      expect(Redis).not.toHaveBeenCalled()
    },
  )
})
