// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface VercelConfiguration {
  functions?: Record<string, {
    supportsCancellation?: boolean
  }>
}

describe('vercel function lifecycle configuration', () => {
  it('propagates client cancellation through every long-running Node route', () => {
    const configuration = JSON.parse(
      readFileSync(resolve('vercel.json'), 'utf8'),
    ) as VercelConfiguration

    expect(configuration.functions).toMatchObject({
      'src/app/api/ai-gateway/**/route.ts': { supportsCancellation: true },
      'src/app/api/ai-gateway/metadata/route.ts': { supportsCancellation: true },
      'src/app/api/format/route.ts': { supportsCancellation: true },
      'src/app/api/run/route.ts': { supportsCancellation: true },
    })
  })
})
