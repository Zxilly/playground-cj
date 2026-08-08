import { readSharedAIConfig } from '@/lib/ai/shared-ai-config'
import { getSharedGatewayBulkhead } from '@/lib/ai/shared-gateway-bulkhead'
import { getSharedGatewayRateLimiter } from '@/lib/ai/shared-gateway-rate-limit'
import { readTrustedQuotaIdentity } from '@/lib/ai/quota-identity'
import { getSharedQuotaBroker } from '@/lib/ai/shared-quota-broker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

/**
 * Side-effectful readiness probe used before the shared classroom is enabled.
 * Metadata GET remains read-only; this endpoint provisions or recovers the
 * caller's bounded shared credential so the first lesson turn is not the probe.
 */
export async function POST(request: Request): Promise<Response> {
  let release: (() => void) | null = null
  try {
    const config = readSharedAIConfig()
    const identity = readTrustedQuotaIdentity(request.headers)
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(config.timeoutMs),
    ])
    const limiter = getSharedGatewayRateLimiter(
      config.metadataIdentityRequestsPerMinute,
      config.metadataGlobalRequestsPerMinute,
      'readiness',
    )
    if (!await limiter.consume(identity, signal)) {
      return errorResponse(
        429,
        'rate_limit_exceeded',
        'Too many shared AI readiness requests.',
      )
    }
    release = getSharedGatewayBulkhead(
      config.metadataMaximumConcurrentRequests,
      'readiness',
    ).tryAcquire()
    if (!release) {
      return errorResponse(
        503,
        'shared_service_busy',
        'The shared AI service is busy.',
      )
    }

    const broker = getSharedQuotaBroker()
    await broker.acquireCredential(identity, signal)
    const quota = await broker.readQuota(identity, signal)
    return Response.json({
      transport: 'shared-gateway',
      model: config.model,
      quota,
    }, { headers: NO_STORE_HEADERS })
  }
  catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'name' in error
      && error.name === 'TimeoutError'
    ) {
      return errorResponse(
        504,
        'shared_service_timeout',
        'The shared AI service took too long to prepare.',
      )
    }
    if (error instanceof Error && error.message.includes('broker is busy')) {
      return errorResponse(
        503,
        'shared_service_busy',
        'The shared AI service is busy.',
      )
    }
    return errorResponse(
      503,
      'shared_service_unavailable',
      'The shared AI service is unavailable.',
    )
  }
  finally {
    release?.()
  }
}
