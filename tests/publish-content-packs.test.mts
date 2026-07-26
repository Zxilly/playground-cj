// @vitest-environment node

import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  contentPackArtifactSha256,
  contentPackPublicationHistorySchema,
  contentPackRepositoryReviewDeclarationSchema,
  currentContentPackValidationReceiptSchema,
  formatGeneratedJson,
  generatedContentPackArtifactSchema,
  generatedContentPackManifestSchema,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  generatedContentPackDirectory,
  readVerifiedRepositoryPublication,
} from '../scripts/content-pack-verification.mts'
import {
  finalizeContentPackPublication,
  parseContentPackPublicationCliArgs,
} from '../scripts/publish-content-packs.mts'

const temporaryDirectories: string[] = []

function copyPublicationFixture(): string {
  const directory = mkdtempSync(
    join(resolve(tmpdir()), 'playground-cj-publish-test-'),
  )
  temporaryDirectories.push(directory)
  cpSync(generatedContentPackDirectory, directory, { recursive: true })
  return directory
}

function copyGenesisCandidateFixture(): string {
  const directory = mkdtempSync(
    join(resolve(tmpdir()), 'playground-cj-genesis-test-'),
  )
  temporaryDirectories.push(directory)
  for (const file of [
    'en.json',
    'zh.json',
    'manifest.json',
    'validation-receipt.json',
  ]) {
    copyFileSync(
      join(generatedContentPackDirectory, file),
      join(directory, file),
    )
  }
  return directory
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function nextPublicationIdentity(directory: string): {
  sequence: number
  snapshotDirectory: string
} {
  const sequence = readVerifiedRepositoryPublication(directory).entry.sequence + 1
  return {
    sequence,
    snapshotDirectory: String(sequence).padStart(4, '0'),
  }
}

function snapshotTree(
  directory: string,
  root = directory,
): Record<string, string> {
  const snapshot: Record<string, string> = {}
  for (const name of readdirSync(directory)) {
    const file = join(directory, name)
    if (statSync(file).isDirectory()) {
      Object.assign(snapshot, snapshotTree(file, root))
    }
    else {
      snapshot[file.slice(root.length + 1).replaceAll('\\', '/')]
        = readFileSync(file, 'utf8')
    }
  }
  return snapshot
}

function readCurrentValidationReceipt(directory: string) {
  return currentContentPackValidationReceiptSchema.parse(
    readJson(join(directory, 'validation-receipt.json')),
  )
}

function writeCandidateWithReorderedPacks(directory: string): void {
  const artifacts = {} as Record<
    'en' | 'zh',
    ReturnType<typeof generatedContentPackArtifactSchema.parse>
  >
  const manifest = generatedContentPackManifestSchema.parse(
    readJson(join(directory, 'manifest.json')),
  )
  const receipt = readCurrentValidationReceipt(directory)

  for (const locale of ['en', 'zh'] as const) {
    const current = generatedContentPackArtifactSchema.parse(
      readJson(join(directory, `${locale}.json`)),
    )
    const artifact = generatedContentPackArtifactSchema.parse({
      ...current,
      packs: [...current.packs].reverse(),
    })
    artifacts[locale] = artifact
    manifest.locales[locale].artifactSha256
      = contentPackArtifactSha256(artifact)
    writeFileSync(
      join(directory, `${locale}.json`),
      formatGeneratedJson(artifact),
      'utf8',
    )
  }
  receipt.artifacts = {
    en: contentPackArtifactSha256(artifacts.en),
    zh: contentPackArtifactSha256(artifacts.zh),
  }
  writeFileSync(
    join(directory, 'manifest.json'),
    formatGeneratedJson(manifest),
    'utf8',
  )
  writeFileSync(
    join(directory, 'validation-receipt.json'),
    formatGeneratedJson(receipt),
    'utf8',
  )
}

function writeCandidateWithChangedValidationReceipt(directory: string): void {
  const receipt = readCurrentValidationReceipt(directory)
  const first = receipt.templates[0]!
  receipt.templates[0] = {
    ...first,
    validationInputSha256:
      first.validationInputSha256 === 'f'.repeat(64)
        ? 'e'.repeat(64)
        : 'f'.repeat(64),
  }
  writeFileSync(
    join(directory, 'validation-receipt.json'),
    formatGeneratedJson(receipt),
    'utf8',
  )
}

afterEach(() => {
  const systemTemp = resolve(tmpdir())
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = resolve(directory)
    if (
      resolved.startsWith(`${systemTemp}\\`)
      || resolved.startsWith(`${systemTemp}/`)
    ) {
      rmSync(resolved, { force: true, recursive: true })
    }
  }
})

describe('content Pack publication finalizer', () => {
  it('creates sequence one from a candidate with no publication metadata', () => {
    const directory = copyGenesisCandidateFixture()

    expect(finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      reviewerLabel: 'codex-agent:genesis-review',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toMatchObject({
      dryRun: false,
      sequence: 1,
      snapshotDirectory: '0001',
    })

    const publication = readVerifiedRepositoryPublication(directory)
    expect(publication.history.entries).toHaveLength(1)
    expect(publication.entry.previousEntrySha256).toBeNull()
    expect(publication.reviewDeclaration.previousHistoryEntrySha256)
      .toBeNull()
  }, 30_000)

  it('rejects incomplete publication metadata instead of resetting to genesis', () => {
    const directory = copyGenesisCandidateFixture()
    mkdirSync(join(directory, 'history'))
    const before = snapshotTree(directory)

    expect(() => finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      reviewerLabel: 'codex-agent:genesis-review',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/Incomplete Content Pack publication metadata/)
    expect(snapshotTree(directory)).toEqual(before)
  })

  it('creates the next verified repository-local publication', () => {
    const directory = copyPublicationFixture()
    const next = nextPublicationIdentity(directory)
    writeCandidateWithReorderedPacks(directory)

    const result = finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      reviewerLabel: 'codex-agent:test-review',
      reviewScope: 'artifact-diff-and-validation-chain',
    })

    expect(result).toMatchObject({
      dryRun: false,
      ...next,
    })
    const history = contentPackPublicationHistorySchema.parse(
      readJson(join(directory, 'publication-history.json')),
    )
    const declaration = contentPackRepositoryReviewDeclarationSchema.parse(
      readJson(join(directory, 'repository-review-declaration.json')),
    )
    expect(history.entries).toHaveLength(next.sequence)
    expect(declaration.declaration).toEqual({
      kind: 'repository-review-declaration',
      reviewerLabel: 'codex-agent:test-review',
      declaredAt: '2026-07-26',
      scope: 'artifact-diff-and-validation-chain',
      trustModel: 'repository-code-review',
      provenance: 'self-asserted-repository-metadata',
      externalTrustAnchor: false,
    })
    expect(readVerifiedRepositoryPublication(directory).entry.sequence)
      .toBe(next.sequence)
  }, 30_000)

  it('requires explicit non-empty reviewer label and review scope arguments', () => {
    expect(() => parseContentPackPublicationCliArgs([]))
      .toThrow(/--reviewer-label/)
    expect(() => parseContentPackPublicationCliArgs([
      '--reviewer-label',
      'repository reviewer',
    ])).toThrow(/--review-scope/)
    expect(() => parseContentPackPublicationCliArgs([
      '--reviewer-label',
      ' ',
      '--review-scope',
      'artifact-diff-and-validation-chain',
    ])).toThrow(/non-empty/)
    expect(() => parseContentPackPublicationCliArgs([
      '--reviewer-label',
      'repository reviewer',
      '--review-scope',
      ' ',
    ])).toThrow(/non-empty/)
  })

  it('rejects tampered historical snapshots before reading the candidate', () => {
    const directory = copyPublicationFixture()
    const historicalArtifact = readFileSync(
      join(directory, 'history', '0001', 'en.json'),
      'utf8',
    )
    writeFileSync(
      join(directory, 'history', '0001', 'en.json'),
      `${historicalArtifact}\n`,
      'utf8',
    )
    writeFileSync(join(directory, 'manifest.json'), '{}\n', 'utf8')

    expect(() => finalizeContentPackPublication({
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/artifact snapshot|publication manifest snapshot/)
  })

  it('rejects stale candidate digests without partially publishing', () => {
    const directory = copyPublicationFixture()
    writeCandidateWithReorderedPacks(directory)
    const manifest = generatedContentPackManifestSchema.parse(
      readJson(join(directory, 'manifest.json')),
    )
    manifest.locales.en.artifactSha256 = '0'.repeat(64)
    writeFileSync(
      join(directory, 'manifest.json'),
      formatGeneratedJson(manifest),
      'utf8',
    )
    const before = snapshotTree(directory)

    expect(() => finalizeContentPackPublication({
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/does not match its manifest digest/)
    expect(snapshotTree(directory)).toEqual(before)
  })

  it('rejects a v5 candidate whose compiler provenance is not the current lock', () => {
    const directory = copyPublicationFixture()
    const receiptPath = join(directory, 'validation-receipt.json')
    const receipt = readCurrentValidationReceipt(directory)
    receipt.compiler.toolchain.lockFileSha256 = 'f'.repeat(64)
    writeFileSync(
      receiptPath,
      formatGeneratedJson(receipt),
      'utf8',
    )
    const before = snapshotTree(directory)

    expect(() => finalizeContentPackPublication({
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/locked Cangjie toolchain/)
    expect(snapshotTree(directory)).toEqual(before)
  })

  it('rejects a candidate that deletes an immutable published pack', () => {
    const directory = copyPublicationFixture()
    const artifactPath = join(directory, 'en.json')
    const artifact = generatedContentPackArtifactSchema.parse(
      readJson(artifactPath),
    )
    const removedConceptId = artifact.packs.at(-1)?.concept.id
    expect(removedConceptId).toBeDefined()
    const currentVersions = { ...artifact.currentVersions }
    delete currentVersions[removedConceptId!]
    const candidate = generatedContentPackArtifactSchema.parse({
      ...artifact,
      currentVersions,
      packs: artifact.packs.filter(
        pack => pack.concept.id !== removedConceptId,
      ),
    })
    const manifest = generatedContentPackManifestSchema.parse(
      readJson(join(directory, 'manifest.json')),
    )
    manifest.locales.en = {
      artifactSha256: contentPackArtifactSha256(candidate),
      currentVersions,
    }
    const receipt = readCurrentValidationReceipt(directory)
    receipt.artifacts.en = contentPackArtifactSha256(candidate)
    writeFileSync(
      artifactPath,
      formatGeneratedJson(candidate),
      'utf8',
    )
    writeFileSync(
      join(directory, 'manifest.json'),
      formatGeneratedJson(manifest),
      'utf8',
    )
    writeFileSync(
      join(directory, 'validation-receipt.json'),
      formatGeneratedJson(receipt),
      'utf8',
    )
    const before = snapshotTree(directory)

    expect(() => finalizeContentPackPublication({
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/deleted published Content Pack/)
    expect(snapshotTree(directory)).toEqual(before)
  })

  it('does not create duplicate publications for the current history head', () => {
    const directory = copyPublicationFixture()
    writeCandidateWithReorderedPacks(directory)
    finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })
    const before = snapshotTree(directory)

    expect(() => finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/already published/)
    expect(snapshotTree(directory)).toEqual(before)
  }, 30_000)

  it('publishes a changed validation receipt even when artifact bytes are unchanged', () => {
    const directory = copyPublicationFixture()
    const next = nextPublicationIdentity(directory)
    writeCandidateWithChangedValidationReceipt(directory)

    expect(finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toMatchObject(next)
    expect(readVerifiedRepositoryPublication(directory).receipt)
      .toEqual(readCurrentValidationReceipt(directory))
  }, 30_000)

  it('rejects an untracked next snapshot instead of overwriting it', () => {
    const directory = copyPublicationFixture()
    const next = nextPublicationIdentity(directory)
    writeCandidateWithReorderedPacks(directory)
    mkdirSync(join(directory, 'history', next.snapshotDirectory))
    writeFileSync(
      join(directory, 'history', next.snapshotDirectory, 'unexpected.txt'),
      'do not overwrite\n',
      'utf8',
    )
    const before = snapshotTree(directory)

    expect(() => finalizeContentPackPublication({
      directory,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toThrow(/snapshot already exists/)
    expect(snapshotTree(directory)).toEqual(before)
  })

  it('validates and reports a dry run without writing publication metadata', () => {
    const directory = copyPublicationFixture()
    const next = nextPublicationIdentity(directory)
    writeCandidateWithReorderedPacks(directory)
    const before = snapshotTree(directory)

    expect(finalizeContentPackPublication({
      declaredAt: '2026-07-26',
      directory,
      dryRun: true,
      reviewerLabel: 'repository reviewer',
      reviewScope: 'artifact-diff-and-validation-chain',
    })).toMatchObject({
      dryRun: true,
      ...next,
    })
    expect(snapshotTree(directory)).toEqual(before)
  })
})
