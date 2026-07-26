import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consume = vi.hoisted(() => vi.fn())
const getSharedGatewayRateLimiter = vi.hoisted(() => vi.fn(() => ({ consume })))

vi.mock('@/lib/ai/shared-gateway-rate-limit', () => ({
  getSharedGatewayRateLimiter,
}))

const {
  getRunnerAdmissionGate,
  readRunnerAdmissionConfig,
} = await import('./runner-admission')

describe('readRunnerAdmissionConfig', () => {
  beforeEach(() => {
    consume.mockReset()
    getSharedGatewayRateLimiter.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses conservative local-development defaults', () => {
    expect(readRunnerAdmissionConfig({
      NODE_ENV: 'development',
    })).toEqual({
      identityRequestsPerMinute: 10,
      globalRequestsPerMinute: 120,
      timeoutMs: 2_000,
    })
  })

  it('fails closed when a production deployment omits distributed admission settings', () => {
    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    })).toThrow('CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE')

    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    })).toThrow('CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE')
  })

  it('requires a production identity header controlled by trusted infrastructure', () => {
    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '100',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    })).toThrow('trusted client IP')
  })

  it('rejects an invalid trusted proxy header name at configuration time', () => {
    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      AI_GATEWAY_TRUSTED_IP_HEADER: 'bad header:name',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '100',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    })).toThrow('AI_GATEWAY_TRUSTED_IP_HEADER')
  })

  it('requires the distributed Redis admission backend in production', () => {
    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '100',
    })).toThrow('UPSTASH_REDIS_REST_URL')

    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '100',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
    })).toThrow('UPSTASH_REDIS_REST_TOKEN')
  })

  it('rejects an insecure production Redis endpoint', () => {
    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '100',
      UPSTASH_REDIS_REST_URL: 'http://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    })).toThrow('UPSTASH_REDIS_REST_URL must use HTTPS')
  })

  it('rejects Redis credentials containing whitespace', () => {
    expect(() => readRunnerAdmissionConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '10',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '100',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'secret value',
    })).toThrow('UPSTASH_REDIS_REST_TOKEN')
  })

  it('rejects unsafe or contradictory admission limits', () => {
    expect(() => readRunnerAdmissionConfig({
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: 'not-a-number',
    })).toThrow('identity request limit')
    expect(() => readRunnerAdmissionConfig({
      CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE: '20',
      CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE: '10',
    })).toThrow('global request limit')
    expect(() => readRunnerAdmissionConfig({
      CJ_RUNNER_ADMISSION_TIMEOUT_MS: '25001',
    })).toThrow('admission timeout')
  })

  it('builds a runner-scoped distributed gate using the trusted identity boundary', async () => {
    consume.mockResolvedValue(true)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE', '7')
    vi.stubEnv('CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE', '70')
    vi.stubEnv('CJ_RUNNER_ADMISSION_TIMEOUT_MS', '1500')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret')

    const gate = getRunnerAdmissionGate()
    const identity = gate.resolveIdentity(new Headers({
      'origin': 'https://attacker.example',
      'x-forwarded-for': '198.51.100.99',
      'x-vercel-forwarded-for': '203.0.113.10',
    }))

    expect(identity).toBe('203.0.113.10')
    expect(gate.timeoutMs).toBe(1_500)
    expect(getSharedGatewayRateLimiter).toHaveBeenCalledWith(7, 70, 'runner')
    const controller = new AbortController()
    await expect(gate.consume(identity, controller.signal)).resolves.toBe(true)
    expect(consume).toHaveBeenCalledWith(identity, controller.signal)
  })
})
