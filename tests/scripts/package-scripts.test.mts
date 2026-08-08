import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'

describe('package scripts', () => {
  it('prepares assets and compiles Git-tracked curriculum before consumers', () => {
    expect(packageJson.scripts.prebuild)
      .toBe('pnpm prep && pnpm content-packs:generate')
    expect(packageJson.scripts.predev).toBe('pnpm prep')
    expect(packageJson.scripts.pretest)
      .toBe('pnpm prep && pnpm content-packs:generate')
    expect(packageJson.scripts.test)
      .toBe('vitest --project unit --project component')
    expect(packageJson.scripts['test:run'])
      .toBe('pnpm prep && pnpm content-packs:generate && vitest run --project unit --project component')
    expect(packageJson.scripts['pretest:browser'])
      .toBe('pnpm prep && pnpm content-packs:generate')
    expect(packageJson.scripts['test:browser'])
      .toBe('vitest run --project browser')
    expect(packageJson.scripts['test:e2e'])
      .toBe('vitest run --project e2e')
    expect(packageJson.scripts['pretest:e2e'])
      .toBe('pnpm prep && pnpm content-packs:generate')
    expect(packageJson.scripts.precoverage).toBe('pnpm prep')
    expect(packageJson.scripts.prep).toBe('node scripts/download-wasm-assets-cli.mjs')
  })
})
