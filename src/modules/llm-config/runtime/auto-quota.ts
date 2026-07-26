import type { AutoQuotaState } from '@/stores/llmConfig'
import { fetchSharedGatewayMetadata } from './shared-gateway-client'

/**
 * Read the authoritative server-side quota snapshot after a shared-gateway
 * request. Returns a state only once the bucket is exhausted; available quota
 * leaves the caller's existing state untouched.
 */
export async function probeExhaustedQuota(): Promise<AutoQuotaState | null> {
  try {
    const { quota } = await fetchSharedGatewayMetadata()
    return quota.exhausted ? quota : null
  }
  catch {
    return null
  }
}
