import { readSharedAIConfig } from '@/lib/ai/shared-ai-config'
import { getSharedGatewayBulkhead } from '@/lib/ai/shared-gateway-bulkhead'
import { getSharedGatewayRateLimiter } from '@/lib/ai/shared-gateway-rate-limit'
import { readTrustedQuotaIdentity } from '@/lib/ai/quota-identity'
import { getSharedQuotaBroker } from '@/lib/ai/shared-quota-broker'
import {
  getSharedQuotaMetadataReader,
  SharedQuotaMetadataRateLimitError,
} from '@/lib/ai/shared-quota-metadata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET(request: Request): Promise<Response> {
  try {
    const config = readSharedAIConfig()
    const identity = readTrustedQuotaIdentity(request.headers)
    const broker = getSharedQuotaBroker()
    const limiter = getSharedGatewayRateLimiter(
      config.metadataIdentityRequestsPerMinute,
      config.metadataGlobalRequestsPerMinute,
      'metadata',
    )
    const bulkhead = getSharedGatewayBulkhead(
      config.metadataMaximumConcurrentRequests,
      'metadata',
    )
    const reader = getSharedQuotaMetadataReader({
      readQuota: broker.readQuota,
      consumeDistributedPermit: limiter.consume,
      tryAcquireSlot: bulkhead.tryAcquire,
      now: Date.now,
      timeoutMs: config.timeoutMs,
      cacheTtlMs: config.metadataCacheTtlMs,
      cacheMaxEntries: config.metadataCacheMaxEntries,
      identityRequestsPerMinute: config.metadataIdentityRequestsPerMinute,
      globalRequestsPerMinute: config.metadataGlobalRequestsPerMinute,
    })
    const quota = await reader.read(identity, request.signal)

    return Response.json({
      transport: 'shared-gateway',
      model: config.model,
      quota: {
        nextResetAt: quota.nextResetAt,
        perPeriod: quota.perPeriod,
        available: quota.available,
        exhausted: quota.exhausted,
      },
    }, {
      headers: NO_STORE_HEADERS,
    })
  }
  catch (error) {
    if (error instanceof SharedQuotaMetadataRateLimitError) {
      return Response.json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'Too many shared AI metadata requests.',
        },
      }, {
        status: 429,
        headers: NO_STORE_HEADERS,
      })
    }
    return Response.json({
      error: {
        code: 'shared_service_unavailable',
        message: 'The shared AI service is unavailable.',
      },
    }, {
      status: 503,
      headers: NO_STORE_HEADERS,
    })
  }
}
