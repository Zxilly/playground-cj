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

export async function fetchSharedGatewayMetadata(): Promise<SharedGatewayMetadata> {
  const response = await fetch('/api/ai-key', { method: 'GET' })
  if (!response.ok)
    throw new Error(`Shared gateway metadata request failed: HTTP ${response.status}`)

  let body: unknown
  try {
    body = await response.json() as unknown
  }
  catch {
    throw new Error('Invalid shared gateway metadata')
  }

  const parsed = metadataSchema.safeParse(body)
  if (!parsed.success)
    throw new Error('Invalid shared gateway metadata')
  return parsed.data
}
