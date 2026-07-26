import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'

describe('package scripts', () => {
  it('prepares LSP assets and verifies published curriculum before production consumers', () => {
    expect(packageJson.scripts.prebuild)
      .toBe('pnpm prep && pnpm content-packs:verify-published')
    expect(packageJson.scripts.predev).toBe('pnpm prep')
    expect(packageJson.scripts.pretest)
      .toBe('pnpm prep && pnpm content-packs:verify-published')
    expect(packageJson.scripts.test)
      .toBe('vitest --project unit --project component')
    expect(packageJson.scripts['test:run'])
      .toBe('pnpm prep && pnpm content-packs:verify-published && vitest run --project unit --project component')
    expect(packageJson.scripts['pretest:browser']).toBe('pnpm prep')
    expect(packageJson.scripts['test:browser'])
      .toBe('vitest run --project browser')
    expect(packageJson.scripts['test:e2e'])
      .toBe('vitest run --project e2e')
    expect(packageJson.scripts.precoverage).toBe('pnpm prep')
    expect(packageJson.scripts.prep).toBe('node scripts/download-wasm-assets-cli.mjs')
  })
})
