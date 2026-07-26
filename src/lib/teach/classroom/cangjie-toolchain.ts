import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { canonicalJson } from './canonical-json'

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const cangjieToolchainLockSchema = z.object({
  schemaVersion: z.literal(1),
  release: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/i),
  compiler: z.object({
    name: z.literal('cjc'),
    version: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/i),
    backend: z.literal('cjnative'),
    target: z.literal('x86_64-unknown-linux-gnu'),
    executableSha256: sha256Schema,
  }).strict(),
  sdk: z.object({
    platform: z.literal('linux-x64'),
    url: z.url().startsWith('https://'),
    sha256: sha256Schema,
  }).strict(),
  stdx: z.object({
    version: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/i),
    url: z.url().startsWith('https://'),
    releasePage: z.url().startsWith('https://'),
    sha256: sha256Schema,
  }).strict(),
}).strict().superRefine((lock, context) => {
  if (lock.release !== lock.compiler.version) {
    context.addIssue({
      code: 'custom',
      path: ['compiler', 'version'],
      message: 'compiler version must equal the locked SDK release',
    })
  }
  const sdkUrl = new URL(lock.sdk.url)
  const expectedSdkFile = `cangjie-sdk-linux-x64-${lock.release}.tar.gz`
  if (
    sdkUrl.origin !== 'https://cangjie-lang.cn'
    || sdkUrl.pathname !== '/v1/files/auth/downLoad'
    || sdkUrl.hash
    || sdkUrl.username
    || sdkUrl.password
    || sdkUrl.searchParams.size !== 3
    || sdkUrl.searchParams.get('nsId') !== '142267'
    || sdkUrl.searchParams.get('fileName') !== expectedSdkFile
    || !/^[a-z0-9]+$/i.test(sdkUrl.searchParams.get('objectKey') ?? '')
  ) {
    context.addIssue({
      code: 'custom',
      path: ['sdk', 'url'],
      message: 'SDK URL must use the exact official Cangjie download endpoint',
    })
  }
  const expectedStdxReleasePage
    = `https://gitcode.com/Cangjie/cangjie_stdx/releases/tag/v${lock.release}`
  if (lock.stdx.releasePage !== expectedStdxReleasePage) {
    context.addIssue({
      code: 'custom',
      path: ['stdx', 'releasePage'],
      message: 'stdx release page must address the locked SDK release',
    })
  }
  const expectedStdxUrl
    = `https://gitcode.com/Cangjie/cangjie_stdx/releases/download/`
      + `v${lock.release}/cangjie-stdx-linux-x64-${lock.stdx.version}.zip`
  if (lock.stdx.url !== expectedStdxUrl) {
    context.addIssue({
      code: 'custom',
      path: ['stdx', 'url'],
      message: 'stdx URL must address the locked release and archive',
    })
  }
})

export type CangjieToolchainLock = z.infer<typeof cangjieToolchainLockSchema>

export interface CangjieToolchainProvenance {
  release: string
  sdkArchiveSha256: string
  compilerExecutableSha256: string
  lockFileSha256: string
}

export interface LoadedCangjieToolchainLock {
  lock: CangjieToolchainLock
  provenance: CangjieToolchainProvenance
}

export interface LockedCangjieCompilerIdentity {
  name: 'cjc'
  version: string
  backend: 'cjnative'
  target: 'x86_64-unknown-linux-gnu'
  toolchain: CangjieToolchainProvenance
}

export function parseCangjieToolchainLock(
  input: unknown,
): LoadedCangjieToolchainLock {
  const lock = cangjieToolchainLockSchema.parse(input)
  return {
    lock,
    provenance: {
      release: lock.release,
      sdkArchiveSha256: lock.sdk.sha256,
      compilerExecutableSha256: lock.compiler.executableSha256,
      lockFileSha256: createHash('sha256')
        .update(canonicalJson(lock), 'utf8')
        .digest('hex'),
    },
  }
}

export function lockedCangjieCompilerIdentity(
  input: unknown,
): LockedCangjieCompilerIdentity {
  const { lock, provenance } = parseCangjieToolchainLock(input)
  return {
    name: lock.compiler.name,
    version: lock.compiler.version,
    backend: lock.compiler.backend,
    target: lock.compiler.target,
    toolchain: provenance,
  }
}

export function cangjieToolchainLockPath(
  repositoryRoot = process.cwd(),
): string {
  return join(
    resolve(repositoryRoot),
    'cj-runner',
    'cangjie-toolchain.lock.json',
  )
}

export function loadCangjieToolchainLock(
  repositoryRoot = process.cwd(),
): LoadedCangjieToolchainLock {
  const bytes = readFileSync(cangjieToolchainLockPath(repositoryRoot))
  return parseCangjieToolchainLock(
    JSON.parse(bytes.toString('utf8')),
  )
}

export function assertLockedCangjieCompiler(
  compilerPath: string,
  reported: {
    name: 'cjc'
    version: string
    backend: 'cjnative'
    target: string
  },
  repositoryRoot = process.cwd(),
): CangjieToolchainProvenance {
  const { lock, provenance } = loadCangjieToolchainLock(repositoryRoot)
  if (
    reported.name !== lock.compiler.name
    || reported.version !== lock.compiler.version
    || reported.backend !== lock.compiler.backend
    || reported.target !== lock.compiler.target
  ) {
    throw new Error(
      `Cangjie compiler identity does not match locked release ${lock.release}`,
    )
  }
  const executableSha256 = createHash('sha256')
    .update(readFileSync(resolve(compilerPath)))
    .digest('hex')
  if (executableSha256 !== lock.compiler.executableSha256) {
    throw new Error(
      'Cangjie compiler executable bytes do not match the toolchain lock',
    )
  }
  return provenance
}
