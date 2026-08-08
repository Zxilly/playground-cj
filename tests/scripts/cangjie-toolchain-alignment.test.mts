import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadCangjieToolchainLock,
} from '../../src/lib/teach/classroom/cangjie-toolchain'
import { canonicalJson } from '../../src/lib/teach/classroom/canonical-json'

const repositoryRoot = resolve(process.cwd())
function readRepositoryFile(...segments: string[]): string {
  return readFileSync(join(repositoryRoot, ...segments), 'utf8')
}

describe('cangjie toolchain alignment', () => {
  it('uses one checked-in lock as the installer authority for CI and runner', () => {
    const { lock } = loadCangjieToolchainLock(repositoryRoot)
    const dockerfile = readRepositoryFile('cj-runner', 'Dockerfile')
    const installer = readRepositoryFile(
      'cj-runner',
      'install-cangjie-toolchain.sh',
    )
    const workflow = readRepositoryFile('.github', 'workflows', 'test.yml')
    const cjpm = readRepositoryFile('cj-runner', 'cjpm.toml')
    const runner = readRepositoryFile('cj-runner', 'cmd', 'runner', 'main.go')
    const runnerProxy = readRepositoryFile('src', 'lib', 'runner-proxy.ts')

    expect(dockerfile).toContain(
      'COPY cangjie-toolchain.lock.json install-cangjie-toolchain.sh',
    )
    expect(dockerfile.match(/snapshot\.debian\.org\/archive\/debian\/20260725T000000Z/g))
      .toHaveLength(2)
    expect(dockerfile.match(/snapshot\.debian\.org\/archive\/debian-security\/20260725T000000Z/g))
      .toHaveLength(2)
    expect(dockerfile).not.toContain('deb.debian.org')
    expect(dockerfile).not.toContain('security.debian.org')
    expect(dockerfile).toContain('install-cangjie-toolchain.sh')
    expect(dockerfile).not.toMatch(/^ARG CANGJIE_/m)
    expect(workflow).toContain(
      'lock=cj-runner/cangjie-toolchain.lock.json',
    )
    expect(workflow).toContain(
      'bash cj-runner/install-cangjie-toolchain.sh',
    )
    expect(workflow).not.toContain(lock.sdk.url)
    expect(installer).toContain('sdk_url=$(jq -er \'.sdk.url\'')
    expect(installer).toContain(
      'compiler_sha256=$(jq -er \'.compiler.executableSha256\'',
    )
    expect(installer).toContain(
      'jq -cS -j . "$lock_file" >"$canonical_lock"',
    )
    expect(installer).toContain('--proto \'=https\'')
    expect(installer).toContain('Refusing to merge a locked SDK')
    expect(installer).toContain('Refusing to merge locked stdx')
    expect(installer).toContain(
      'mv -T --no-clobber -- "$staged_sdk_root" "$sdk_root"',
    )
    expect(installer).toContain(
      'SDK cache must be a regular, non-symlink file',
    )
    expect(dockerfile).toContain(
      'cp "$CJ/.playground-cj-toolchain-lock.sha256" /cjroot/',
    )
    expect(runner).toContain('verifyInstalledCangjieToolchain(')
    expect(runner).toContain('runner_toolchain_mismatch')
    expect(runner).toContain(
      'X-Playground-Cangjie-Toolchain-Lock-Sha256',
    )
    expect(runnerProxy).toContain(
      'X-Playground-Cangjie-Toolchain-Lock-Sha256',
    )
    expect(runner).toContain(
      'X-Playground-Cangjie-Toolchain-Status',
    )
    expect(runnerProxy).toContain(
      'X-Playground-Cangjie-Toolchain-Status',
    )

    const sdkUrl = new URL(lock.sdk.url)
    expect(sdkUrl.protocol).toBe('https:')
    expect(sdkUrl.host).toBe('cangjie-lang.cn')
    expect(sdkUrl.pathname).toBe('/v1/files/auth/downLoad')
    expect(new URL(lock.stdx.url).host).toBe('gitcode.com')
    expect(new URL(lock.stdx.releasePage).host).toBe('gitcode.com')

    const canonicalLockSha256 = createHash('sha256')
      .update(canonicalJson(lock), 'utf8')
      .digest('hex')
    expect(loadCangjieToolchainLock(repositoryRoot).provenance.lockFileSha256)
      .toBe(canonicalLockSha256)

    const compatibility = /^cjc-version\s*=\s*"([^"]+)"\s*$/m.exec(cjpm)
    expect(compatibility?.[1]).toBe(lock.release)
  })
})
