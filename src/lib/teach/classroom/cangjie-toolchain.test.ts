import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertLockedCangjieCompiler,
  loadCangjieToolchainLock,
  parseCangjieToolchainLock,
} from './cangjie-toolchain'

describe('cangjie toolchain lock', () => {
  it('rejects a same-version compiler whose executable bytes differ', () => {
    const { lock } = loadCangjieToolchainLock()
    const directory = mkdtempSync(join(tmpdir(), 'playground-cj-cjc-lock-'))
    const compiler = join(directory, 'cjc')
    writeFileSync(compiler, 'self-reporting wrapper', 'utf8')
    try {
      expect(() => assertLockedCangjieCompiler(compiler, {
        name: 'cjc',
        version: lock.compiler.version,
        backend: lock.compiler.backend,
        target: lock.compiler.target,
      })).toThrow(/executable bytes do not match/)
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects an identity or target that differs from the lock before hashing', () => {
    const { lock } = loadCangjieToolchainLock()
    expect(() => assertLockedCangjieCompiler('missing-cjc', {
      name: 'cjc',
      version: lock.compiler.version,
      backend: lock.compiler.backend,
      target: 'aarch64-unknown-linux-gnu',
    })).toThrow(/identity does not match/)
  })

  it('rejects a digest-pinned archive hosted outside the official endpoints', () => {
    const { lock } = loadCangjieToolchainLock()

    expect(() => parseCangjieToolchainLock({
      ...lock,
      sdk: {
        ...lock.sdk,
        url: lock.sdk.url.replace(
          'https://cangjie-lang.cn/',
          'https://mirror.invalid/',
        ),
      },
    })).toThrow(/official Cangjie download endpoint/)
    expect(() => parseCangjieToolchainLock({
      ...lock,
      stdx: {
        ...lock.stdx,
        releasePage: 'https://mirror.invalid/cangjie-stdx',
      },
    })).toThrow(/locked stdx release/)
  })
})
