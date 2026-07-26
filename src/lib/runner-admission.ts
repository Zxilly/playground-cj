import { readTrustedQuotaIdentity } from '@/lib/ai/quota-identity'
import { getSharedGatewayRateLimiter } from '@/lib/ai/shared-gateway-rate-limit'

const DEFAULT_IDENTITY_REQUESTS_PER_MINUTE = 10
const DEFAULT_GLOBAL_REQUESTS_PER_MINUTE = 120
const HEADER_NAME = /^[!#$%&'*+\-.^`|~\w]+$/
export const DEFAULT_RUNNER_ADMISSION_TIMEOUT_MS = 2_000

type Environment = Readonly<Record<string, string | undefined>>

export interface RunnerAdmissionConfig {
  readonly identityRequestsPerMinute: number
  readonly globalRequestsPerMinute: number
  readonly timeoutMs: number
}

export interface RunnerAdmissionGate {
  readonly timeoutMs: number
  readonly resolveIdentity: (headers: Headers) => string
  readonly consume: (
    identity: string,
    signal?: AbortSignal,
  ) => Promise<boolean>
}

function requiredProductionValue(
  environment: Environment,
  name: string,
): string | undefined {
  const value = environment[name]?.trim()
  if (environment.NODE_ENV === 'production' && !value)
    throw new Error(`${name} must be set in production`)
  return value
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined)
    return fallback
  const parsed = Number(value)
  if (
    !Number.isSafeInteger(parsed)
    || parsed < minimum
    || parsed > maximum
  ) {
    throw new Error(
      `${label} must be an integer between ${minimum} and ${maximum}`,
    )
  }
  return parsed
}

export function readRunnerAdmissionConfig(
  environment: Environment = process.env,
): RunnerAdmissionConfig {
  const identityLimit = requiredProductionValue(
    environment,
    'CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE',
  )
  const globalLimit = requiredProductionValue(
    environment,
    'CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE',
  )
  const trustedHeader = environment.AI_GATEWAY_TRUSTED_IP_HEADER?.trim()
  if (trustedHeader && !HEADER_NAME.test(trustedHeader)) {
    throw new Error(
      'AI_GATEWAY_TRUSTED_IP_HEADER must contain a valid HTTP header name',
    )
  }
  if (
    environment.NODE_ENV === 'production'
    && environment.VERCEL !== '1'
    && !environment.VERCEL_ENV
    && !trustedHeader
  ) {
    throw new Error(
      'a trusted client IP source must be configured in production',
    )
  }
  const redisUrl = requiredProductionValue(
    environment,
    'UPSTASH_REDIS_REST_URL',
  )
  const redisToken = requiredProductionValue(
    environment,
    'UPSTASH_REDIS_REST_TOKEN',
  )
  if (environment.NODE_ENV === 'production') {
    if (!redisUrl || !redisToken)
      throw new Error('runner Redis admission configuration is unavailable')
    if (environment.UPSTASH_REDIS_REST_URL !== redisUrl)
      throw new Error('UPSTASH_REDIS_REST_URL must not contain whitespace')
    let parsedRedisUrl: URL
    try {
      parsedRedisUrl = new URL(redisUrl)
    }
    catch {
      throw new Error('UPSTASH_REDIS_REST_URL must be a valid HTTPS URL')
    }
    if (
      parsedRedisUrl.protocol !== 'https:'
      || parsedRedisUrl.username
      || parsedRedisUrl.password
      || parsedRedisUrl.search
      || parsedRedisUrl.hash
    ) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL must use HTTPS without credentials, query, or fragment',
      )
    }
    if (
      environment.UPSTASH_REDIS_REST_TOKEN !== redisToken
      || /\s/.test(redisToken)
    ) {
      throw new Error('UPSTASH_REDIS_REST_TOKEN must not contain whitespace')
    }
  }

  const config: RunnerAdmissionConfig = {
    identityRequestsPerMinute: boundedInteger(
      identityLimit,
      DEFAULT_IDENTITY_REQUESTS_PER_MINUTE,
      'identity request limit',
      1,
      1_000,
    ),
    globalRequestsPerMinute: boundedInteger(
      globalLimit,
      DEFAULT_GLOBAL_REQUESTS_PER_MINUTE,
      'global request limit',
      1,
      100_000,
    ),
    timeoutMs: boundedInteger(
      environment.CJ_RUNNER_ADMISSION_TIMEOUT_MS?.trim(),
      DEFAULT_RUNNER_ADMISSION_TIMEOUT_MS,
      'admission timeout',
      100,
      5_000,
    ),
  }
  if (config.globalRequestsPerMinute < config.identityRequestsPerMinute)
    throw new Error('global request limit must be at least the identity request limit')
  return config
}

export function getRunnerAdmissionGate(): RunnerAdmissionGate {
  const environment = process.env
  const config = readRunnerAdmissionConfig(environment)
  const limiter = getSharedGatewayRateLimiter(
    config.identityRequestsPerMinute,
    config.globalRequestsPerMinute,
    'runner',
  )
  return {
    timeoutMs: config.timeoutMs,
    resolveIdentity: headers => readTrustedQuotaIdentity(headers, environment),
    consume: limiter.consume,
  }
}
