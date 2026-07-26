import { z } from 'zod'

const DEFAULT_BASE_URL = 'https://llm.learningman.top/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_IDENTITY_REQUESTS_PER_MINUTE = 30
const DEFAULT_GLOBAL_REQUESTS_PER_MINUTE = 1_000
const DEFAULT_MAX_CONCURRENT_REQUESTS = 32
const DEFAULT_METADATA_IDENTITY_REQUESTS_PER_MINUTE = 60
const DEFAULT_METADATA_GLOBAL_REQUESTS_PER_MINUTE = 500
const DEFAULT_METADATA_MAX_CONCURRENT_REQUESTS = 8
const DEFAULT_METADATA_CACHE_TTL_MS = 5_000
const DEFAULT_METADATA_CACHE_MAX_ENTRIES = 2_000

const configSchema = z.strictObject({
  upstreamBaseURL: z.url(),
  model: z.string().trim().min(1).max(256),
  // The route's deployment budget is 30 seconds; keep headroom for response
  // finalization instead of accepting a timeout the platform cannot honor.
  timeoutMs: z.number().int().min(1_000).max(25_000),
  identityRequestsPerMinute: z.number().int().positive().max(10_000),
  globalRequestsPerMinute: z.number().int().positive().max(100_000),
  maximumConcurrentRequests: z.number().int().positive().max(1_000),
  metadataIdentityRequestsPerMinute: z.number().int().positive().max(10_000),
  metadataGlobalRequestsPerMinute: z.number().int().positive().max(100_000),
  metadataMaximumConcurrentRequests: z.number().int().positive().max(1_000),
  metadataCacheTtlMs: z.number().int().min(250).max(60_000),
  metadataCacheMaxEntries: z.number().int().positive().max(100_000),
}).refine(
  config => config.globalRequestsPerMinute >= config.identityRequestsPerMinute,
  {
    message: 'SHARED_LLM_GLOBAL_REQUESTS_PER_MINUTE must be at least the per-identity limit',
    path: ['globalRequestsPerMinute'],
  },
).refine(
  config =>
    config.metadataGlobalRequestsPerMinute
    >= config.metadataIdentityRequestsPerMinute,
  {
    message: 'SHARED_LLM_METADATA_GLOBAL_REQUESTS_PER_MINUTE must be at least the per-identity limit',
    path: ['metadataGlobalRequestsPerMinute'],
  },
)

export interface SharedAIConfig {
  readonly upstreamBaseURL: string
  readonly model: string
  readonly timeoutMs: number
  readonly identityRequestsPerMinute: number
  readonly globalRequestsPerMinute: number
  readonly maximumConcurrentRequests: number
  readonly metadataIdentityRequestsPerMinute: number
  readonly metadataGlobalRequestsPerMinute: number
  readonly metadataMaximumConcurrentRequests: number
  readonly metadataCacheTtlMs: number
  readonly metadataCacheMaxEntries: number
}

type Environment = Readonly<Record<string, string | undefined>>

function developmentBaseURL(environment: Environment): string {
  if (environment.SHARED_LLM_BASE_URL)
    return environment.SHARED_LLM_BASE_URL
  if (environment.NEXT_PUBLIC_LLM_BASE_URL)
    return environment.NEXT_PUBLIC_LLM_BASE_URL
  if (environment.NEW_API_BASE_URL)
    return `${environment.NEW_API_BASE_URL.replace(/\/$/, '')}/v1`
  return DEFAULT_BASE_URL
}

function configuredEndpoint(environment: Environment): {
  upstreamBaseURL: string
  model: string
} {
  if (environment.NODE_ENV === 'production') {
    const upstreamBaseURL = environment.SHARED_LLM_BASE_URL?.trim()
    const model = environment.SHARED_LLM_MODEL?.trim()
    if (!upstreamBaseURL)
      throw new Error('SHARED_LLM_BASE_URL must be set in production')
    if (!model)
      throw new Error('SHARED_LLM_MODEL must be set in production')
    return { upstreamBaseURL, model }
  }
  return {
    upstreamBaseURL: developmentBaseURL(environment),
    model: environment.SHARED_LLM_MODEL
      ?? environment.NEXT_PUBLIC_LLM_DEFAULT_MODEL
      ?? DEFAULT_MODEL,
  }
}

export function readSharedAIConfig(
  environment: Environment = process.env,
): SharedAIConfig {
  const endpoint = configuredEndpoint(environment)
  const parsed = configSchema.parse({
    upstreamBaseURL: endpoint.upstreamBaseURL.replace(/\/+$/, ''),
    model: endpoint.model,
    timeoutMs: environment.SHARED_LLM_TIMEOUT_MS
      ? Number(environment.SHARED_LLM_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS,
    identityRequestsPerMinute: environment.SHARED_LLM_IDENTITY_REQUESTS_PER_MINUTE
      ? Number(environment.SHARED_LLM_IDENTITY_REQUESTS_PER_MINUTE)
      : DEFAULT_IDENTITY_REQUESTS_PER_MINUTE,
    globalRequestsPerMinute: environment.SHARED_LLM_GLOBAL_REQUESTS_PER_MINUTE
      ? Number(environment.SHARED_LLM_GLOBAL_REQUESTS_PER_MINUTE)
      : DEFAULT_GLOBAL_REQUESTS_PER_MINUTE,
    maximumConcurrentRequests: environment.SHARED_LLM_MAX_CONCURRENT_REQUESTS
      ? Number(environment.SHARED_LLM_MAX_CONCURRENT_REQUESTS)
      : DEFAULT_MAX_CONCURRENT_REQUESTS,
    metadataIdentityRequestsPerMinute:
      environment.SHARED_LLM_METADATA_IDENTITY_REQUESTS_PER_MINUTE
        ? Number(environment.SHARED_LLM_METADATA_IDENTITY_REQUESTS_PER_MINUTE)
        : DEFAULT_METADATA_IDENTITY_REQUESTS_PER_MINUTE,
    metadataGlobalRequestsPerMinute:
      environment.SHARED_LLM_METADATA_GLOBAL_REQUESTS_PER_MINUTE
        ? Number(environment.SHARED_LLM_METADATA_GLOBAL_REQUESTS_PER_MINUTE)
        : DEFAULT_METADATA_GLOBAL_REQUESTS_PER_MINUTE,
    metadataMaximumConcurrentRequests:
      environment.SHARED_LLM_METADATA_MAX_CONCURRENT_REQUESTS
        ? Number(environment.SHARED_LLM_METADATA_MAX_CONCURRENT_REQUESTS)
        : DEFAULT_METADATA_MAX_CONCURRENT_REQUESTS,
    metadataCacheTtlMs: environment.SHARED_LLM_METADATA_CACHE_TTL_MS
      ? Number(environment.SHARED_LLM_METADATA_CACHE_TTL_MS)
      : DEFAULT_METADATA_CACHE_TTL_MS,
    metadataCacheMaxEntries: environment.SHARED_LLM_METADATA_CACHE_MAX_ENTRIES
      ? Number(environment.SHARED_LLM_METADATA_CACHE_MAX_ENTRIES)
      : DEFAULT_METADATA_CACHE_MAX_ENTRIES,
  })

  const url = new URL(parsed.upstreamBaseURL)
  const isLocalDevelopment = environment.NODE_ENV !== 'production'
    && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalDevelopment))
    throw new Error('SHARED_LLM_BASE_URL must use HTTPS')
  if (url.username || url.password || url.search || url.hash)
    throw new Error('SHARED_LLM_BASE_URL must not contain credentials, query, or fragment')

  return parsed
}
