import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import {
  assertWasmAssetsArchive,
  isWasmAssetsComplete,
  resolveZipEntryPath,
} from '../../scripts/download-wasm-assets.mjs'

const WASM_ASSETS_ZIP_SHA256 = '1dbf2c7fb5d36873009076449778c5c6373b4c0680b4a9a94ac9910560fc5585'

let tempDirs: string[] = []

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'playground-cj-lsp-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })))
  tempDirs = []
})

describe('zip entry path resolution', () => {
  it('resolves normal zip entries inside the target directory', () => {
    const lspDir = resolve(tmpdir(), 'playground-cj-lsp-safe')
    const entryPath = resolveZipEntryPath(lspDir, 'modules/linux_x86_64_cjnative/std.core.cjo')

    expect(entryPath).toBe(resolve(lspDir, 'modules', 'linux_x86_64_cjnative', 'std.core.cjo'))
    const relativeEntryPath = relative(lspDir, entryPath)
    expect(relativeEntryPath.startsWith('..')).toBe(false)
    expect(isAbsolute(relativeEntryPath)).toBe(false)
  })

  it.each([
    '../evil.txt',
    'modules/../../evil.txt',
    '/evil.txt',
    'C:/evil.txt',
    'C:\\evil.txt',
    '\\\\server\\share\\evil.txt',
  ])('rejects zip entries outside the target directory: %s', (entryName) => {
    const lspDir = resolve(tmpdir(), 'playground-cj-lsp-safe')

    expect(() => resolveZipEntryPath(lspDir, entryName)).toThrow(/outside.*target directory/i)
  })
})

describe('wasm asset completeness check', () => {
  it('treats a non-empty but partial WASM asset directory as incomplete', async () => {
    const lspDir = await createTempDir()
    writeFileSync(join(lspDir, 'README.txt'), 'partial download marker')

    expect(isWasmAssetsComplete(lspDir)).toBe(false)
  })

  it('requires wasm glue, wasm binary, and target modules payload', async () => {
    const lspDir = await createTempDir()
    writeFileSync(join(lspDir, 'LSPServer-wasm.js'), 'glue')
    writeFileSync(join(lspDir, 'LSPServer-wasm.wasm'), '\0asm')
    const moduleDir = join(lspDir, 'modules', 'linux_x86_64_cjnative')
    mkdirSync(moduleDir, { recursive: true })
    writeFileSync(join(moduleDir, 'std.core.cjo'), 'module')

    expect(isWasmAssetsComplete(lspDir)).toBe(false)
    writeFileSync(join(lspDir, 'cjfmt-wasm.mjs'), 'glue')
    writeFileSync(join(lspDir, 'cjfmt-wasm.wasm'), '\0asm')
    writeFileSync(join(lspDir, '.wasm-assets.sha256'), WASM_ASSETS_ZIP_SHA256)

    expect(isWasmAssetsComplete(lspDir)).toBe(true)
  })

  it('finds CJO modules nested below the target modules directory', async () => {
    const lspDir = await createTempDir()
    writeFileSync(join(lspDir, 'LSPServer-wasm.js'), 'glue')
    writeFileSync(join(lspDir, 'LSPServer-wasm.wasm'), '\0asm')
    const nestedModuleDir = join(lspDir, 'modules', 'linux_x86_64_cjnative', 'std', 'core')
    mkdirSync(nestedModuleDir, { recursive: true })
    writeFileSync(join(nestedModuleDir, 'package.cjo'), 'module')

    writeFileSync(join(lspDir, 'cjfmt-wasm.mjs'), 'glue')
    writeFileSync(join(lspDir, 'cjfmt-wasm.wasm'), '\0asm')
    writeFileSync(join(lspDir, '.wasm-assets.sha256'), WASM_ASSETS_ZIP_SHA256)

    expect(isWasmAssetsComplete(lspDir)).toBe(true)
  })

  it('rejects directories with required files but no CJO module payload', async () => {
    const lspDir = await createTempDir()
    writeFileSync(join(lspDir, 'LSPServer-wasm.js'), 'glue')
    writeFileSync(join(lspDir, 'LSPServer-wasm.wasm'), '\0asm')
    const moduleDir = join(lspDir, 'modules', 'linux_x86_64_cjnative')
    mkdirSync(moduleDir, { recursive: true })
    writeFileSync(join(moduleDir, 'README.txt'), 'not a module')

    expect(isWasmAssetsComplete(lspDir)).toBe(false)
  })
})

describe('wasm asset archive integrity', () => {
  it('accepts only the pinned archive digest', () => {
    const archive = Buffer.from('test archive')
    const digest = createHash('sha256').update(archive).digest('hex')

    expect(() => assertWasmAssetsArchive(archive, digest)).not.toThrow()
    expect(() => assertWasmAssetsArchive(archive, '0'.repeat(64)))
      .toThrow(/SHA-256 mismatch/)
  })
})
