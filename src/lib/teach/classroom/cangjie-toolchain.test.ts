import { describe, expect, it } from 'vitest'
import {
  assertLockedCangjieCompiler,
  loadCangjieToolchainLock,
  parseCangjieToolchainLock,
} from './cangjie-toolchain'

describe('cangjie toolchain lock', () => {
  it('rejects an identity or target that differs from the lock', () => {
    const { lock } = loadCangjieToolchainLock()
    expect(() => assertLockedCangjieCompiler({
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
