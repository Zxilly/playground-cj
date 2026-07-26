import { describe, expect, it } from 'vitest'
import { readSharedAIConfig } from './shared-ai-config'

describe('readSharedAIConfig', () => {
  it('prefers server-only upstream configuration', () => {
    expect(readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://private-upstream.test/v1/',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_TIMEOUT_MS: '12000',
      NEXT_PUBLIC_LLM_BASE_URL: 'https://legacy-public.test/v1',
      NEXT_PUBLIC_LLM_DEFAULT_MODEL: 'legacy-model',
    })).toEqual({
      upstreamBaseURL: 'https://private-upstream.test/v1',
      model: 'server-model',
      timeoutMs: 12_000,
      identityRequestsPerMinute: 30,
      globalRequestsPerMinute: 1_000,
      maximumConcurrentRequests: 32,
      metadataIdentityRequestsPerMinute: 60,
      metadataGlobalRequestsPerMinute: 500,
      metadataMaximumConcurrentRequests: 8,
      metadataCacheTtlMs: 5_000,
      metadataCacheMaxEntries: 2_000,
    })
  })

  it('fails closed in production instead of using browser-visible or hard-coded upstream defaults', () => {
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      NEXT_PUBLIC_LLM_BASE_URL: 'https://legacy-public.test/v1',
      NEXT_PUBLIC_LLM_DEFAULT_MODEL: 'legacy-model',
      NEW_API_BASE_URL: 'https://admin-api.test',
    })).toThrow('SHARED_LLM_BASE_URL must be set in production')

    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://private-upstream.test/v1',
      NEXT_PUBLIC_LLM_DEFAULT_MODEL: 'legacy-model',
    })).toThrow('SHARED_LLM_MODEL must be set in production')
  })

  it('rejects insecure production upstream URLs and invalid timeouts', () => {
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'http://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
    })).toThrow('SHARED_LLM_BASE_URL must use HTTPS')

    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_TIMEOUT_MS: 'not-a-number',
    })).toThrow()
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_TIMEOUT_MS: '30000',
    })).toThrow()

    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://user:password@upstream.test/v1?debug=1',
      SHARED_LLM_MODEL: 'server-model',
    })).toThrow('SHARED_LLM_BASE_URL must not contain credentials, query, or fragment')
  })

  it('validates deployment-wide and per-identity request limits together', () => {
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_IDENTITY_REQUESTS_PER_MINUTE: '50',
      SHARED_LLM_GLOBAL_REQUESTS_PER_MINUTE: '40',
    })).toThrow('SHARED_LLM_GLOBAL_REQUESTS_PER_MINUTE must be at least the per-identity limit')
  })

  it('rejects an invalid process concurrency limit', () => {
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_MAX_CONCURRENT_REQUESTS: '0',
    })).toThrow()
  })

  it('validates the independent metadata protection limits', () => {
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_METADATA_IDENTITY_REQUESTS_PER_MINUTE: '50',
      SHARED_LLM_METADATA_GLOBAL_REQUESTS_PER_MINUTE: '40',
    })).toThrow(
      'SHARED_LLM_METADATA_GLOBAL_REQUESTS_PER_MINUTE must be at least the per-identity limit',
    )
    expect(() => readSharedAIConfig({
      NODE_ENV: 'production',
      SHARED_LLM_BASE_URL: 'https://upstream.test/v1',
      SHARED_LLM_MODEL: 'server-model',
      SHARED_LLM_METADATA_CACHE_TTL_MS: '0',
    })).toThrow()
  })
})
