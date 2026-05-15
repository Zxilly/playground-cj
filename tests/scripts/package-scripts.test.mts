import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'

describe('package scripts', () => {
  it('prepares LSP assets before Next commands that load next.config', () => {
    expect(packageJson.scripts.prebuild).toBe('pnpm prep')
    expect(packageJson.scripts.predev).toBe('pnpm prep')
    expect(packageJson.scripts.pretest).toBe('pnpm prep')
    expect(packageJson.scripts['pretest:browser']).toBe('pnpm prep')
    expect(packageJson.scripts.precoverage).toBe('pnpm prep')
    expect(packageJson.scripts.prep).toBe('node scripts/download-lsp-cli.mjs')
  })
})
