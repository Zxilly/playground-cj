'use client'

import { z } from 'zod'

const quotaSchema = z.strictObject({
  nextResetAt: z.number().int().nonnegative(),
  perPeriod: z.number().int().positive(),
  available: z.number().nonnegative(),
  exhausted: z.boolean(),
}).refine(quota => quota.available <= quota.perPeriod, {
  message: 'available quota exceeds per-period quota',
})

const metadataSchema = z.strictObject({
  transport: z.literal('shared-gateway'),
  model: z.string().trim().min(1).max(256),
  quota: quotaSchema,
})

export type SharedGatewayMetadata = z.infer<typeof metadataSchema>

const gatewayErrorSchema = z.object({
  error: z.object({
    code: z.string(),
  }),
})

async function readMetadataResponse(response: Response): Promise<SharedGatewayMetadata> {
  let body: unknown
  try {
    body = await response.json() as unknown
  }
  catch {
    throw new Error('shared_service_unavailable')
  }

  if (!response.ok) {
    const parsedError = gatewayErrorSchema.safeParse(body)
    throw new Error(parsedError.success
      ? parsedError.data.error.code
      : 'shared_service_unavailable')
  }

  const parsed = metadataSchema.safeParse(body)
  if (!parsed.success)
    throw new Error('shared_service_unavailable')
  return parsed.data
}

export async function fetchSharedGatewayMetadata(): Promise<SharedGatewayMetadata> {
  const response = await fetch('/api/ai-gateway/metadata', { method: 'GET' })
  return readMetadataResponse(response)
}

/** Provision/recover the shared credential before enabling the classroom. */
export async function prepareSharedGateway(): Promise<SharedGatewayMetadata> {
  const response = await fetch('/api/ai-gateway/readiness', { method: 'POST' })
  return readMetadataResponse(response)
}
