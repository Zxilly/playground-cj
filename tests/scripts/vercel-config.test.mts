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
      'src/app/api/run/route.ts': { supportsCancellation: true },
    })
  })
})

describe('vercel deployment input', () => {
  it('downloads generated WASM assets during the remote build', () => {
    const ignoredPaths = readFileSync(resolve('.vercelignore'), 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))

    expect(ignoredPaths).toEqual(expect.arrayContaining([
      '/*',
      '!package.json',
      '!pnpm-lock.yaml',
      '!patches',
      '!cj-runner',
      '!public',
      'public/lsp/',
      '!scripts',
      '!src',
      '!tour',
    ]))
  })
})
