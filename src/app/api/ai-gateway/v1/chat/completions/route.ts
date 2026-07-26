import { readSharedAIConfig } from '@/lib/ai/shared-ai-config'
import { getSharedGatewayBulkhead } from '@/lib/ai/shared-gateway-bulkhead'
import { getSharedGatewayRateLimiter } from '@/lib/ai/shared-gateway-rate-limit'
import { readTrustedQuotaIdentity } from '@/lib/ai/quota-identity'
import { createSharedModelGateway } from '@/lib/ai/shared-model-gateway'
import { getSharedQuotaBroker } from '@/lib/ai/shared-quota-broker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function unavailableResponse(): Response {
  return Response.json({
    error: {
      code: 'shared_service_unavailable',
      message: 'The shared AI service is unavailable.',
      type: 'shared_service_unavailable',
    },
  }, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function POST(request: Request): Promise<Response> {
  try {
    const config = readSharedAIConfig()
    const broker = getSharedQuotaBroker()
    const bulkhead = getSharedGatewayBulkhead(config.maximumConcurrentRequests)
    const rateLimiter = getSharedGatewayRateLimiter(
      config.identityRequestsPerMinute,
      config.globalRequestsPerMinute,
    )
    const gateway = createSharedModelGateway({
      resolveIdentity: readTrustedQuotaIdentity,
      consumeRequestPermit: rateLimiter.consume,
      acquireCredential: broker.acquireCredential,
      fetch: globalThis.fetch,
      upstreamBaseURL: config.upstreamBaseURL,
      model: config.model,
      timeoutMs: config.timeoutMs,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    return gateway(request)
  }
  catch {
    return unavailableResponse()
  }
}
