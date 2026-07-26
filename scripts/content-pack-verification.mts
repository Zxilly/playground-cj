import {
  existsSync,
  readFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  assertBilingualLearningContractArtifacts,
  assertRetainsPublishedArtifact,
  contentPackArtifactSha256,
  contentPackManifestSha256,
  contentPackPublicationHistorySchema,
  contentPackRepositoryReviewDeclarationSchema,
  contentPackRepositoryReviewDeclarationSha256,
  contentPackValidationReceiptSchema,
  contentPackValidationReceiptSha256,
  formatGeneratedJson,
  generatedContentPackArtifactSchema,
  generatedContentPackManifestSchema,
  mergeGeneratedContentPackArtifact,
  projectIntegrityCheckedHistoricalRepositoryArtifact,
  projectIntegrityCheckedRepositoryArtifact,
} from '../src/lib/teach/classroom/content-pack-artifact'
import type {
  ContentPackCodeSampleValidation,
  ContentPackPublicationHistory,
  ContentPackPublicationHistoryEntry,
  ContentPackRepositoryReviewDeclaration,
  ContentPackValidationReceipt,
  GeneratedContentPackArtifact,
  GeneratedContentPackManifest,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  loadCangjieToolchainLock,
  lockedCangjieCompilerIdentity,
} from '../src/lib/teach/classroom/cangjie-toolchain'
import type {
  LockedCangjieCompilerIdentity,
} from '../src/lib/teach/classroom/cangjie-toolchain'
import {
  buildCurrentCourseContentPacks,
  getReceiptBoundContentPackCodeSampleValidations,
} from '../src/lib/teach/classroom/content-pack-generation'
import type {
  ContentPackCompilerIdentity,
  ContentPackPacksByLocale,
  ContentPackReferenceValidation,
} from '../src/lib/teach/classroom/content-pack-generation'
import type { CourseContentPack } from '../src/lib/teach/classroom/content-packs'

export const generatedContentPackDirectory = join(
  resolve(process.cwd()),
  'src',
  'lib',
  'teach',
  'classroom',
  'generated',
  'content-packs',
)

const locales = ['en', 'zh'] as const

function readRequiredText(file: string, description: string): string {
  if (!existsSync(file))
    throw new Error(`Missing publication ${description}: ${file}`)
  return readFileSync(file, 'utf8')
}

function readRequiredJson(file: string, description: string): unknown {
  const text = readRequiredText(file, description)
  try {
    return JSON.parse(text)
  }
  catch (error) {
    throw new Error(`Invalid publication ${description}: ${file}`, {
      cause: error,
    })
  }
}

function assertNormalizedFile(
  file: string,
  value: unknown,
  description: string,
): void {
  if (readRequiredText(file, description) !== formatGeneratedJson(value)) {
    throw new Error(
      `Publication ${description} is not in deterministic generated form: ${file}`,
    )
  }
}

export interface VerifiedPublicationSnapshot {
  reviewDeclaration: ContentPackRepositoryReviewDeclaration
  artifacts: Record<'en' | 'zh', GeneratedContentPackArtifact>
  entry: ContentPackPublicationHistoryEntry
  manifest: GeneratedContentPackManifest
  receipt: ContentPackValidationReceipt
}

export interface VerifiedPublicationHistory {
  history: ContentPackPublicationHistory
  snapshots: VerifiedPublicationSnapshot[]
}

function readSnapshot(
  directory: string,
  history: ContentPackPublicationHistory,
  index: number,
  expectedCompiler?: LockedCangjieCompilerIdentity,
): VerifiedPublicationSnapshot {
  const entry = history.entries[index]
  const snapshotRoot = join(
    directory,
    'history',
    entry.snapshotDirectory,
  )
  const manifestPath = join(snapshotRoot, 'manifest.json')
  const receiptPath = join(snapshotRoot, 'validation-receipt.json')
  const reviewDeclarationPath = join(
    snapshotRoot,
    'repository-review-declaration.json',
  )
  const manifest = generatedContentPackManifestSchema.parse(
    readRequiredJson(manifestPath, 'publication manifest snapshot'),
  )
  const receipt = contentPackValidationReceiptSchema.parse(
    readRequiredJson(receiptPath, 'validation receipt snapshot'),
  )
  const reviewDeclaration = contentPackRepositoryReviewDeclarationSchema.parse(
    readRequiredJson(reviewDeclarationPath, 'repository review declaration snapshot'),
  )
  const artifacts = {} as Record<'en' | 'zh', GeneratedContentPackArtifact>

  assertNormalizedFile(
    manifestPath,
    manifest,
    'publication manifest snapshot',
  )
  assertNormalizedFile(
    receiptPath,
    receipt,
    'validation receipt snapshot',
  )
  assertNormalizedFile(
    reviewDeclarationPath,
    reviewDeclaration,
    'repository review declaration snapshot',
  )

  if (contentPackManifestSha256(manifest) !== entry.manifestSha256)
    throw new Error(`Publication ${entry.sequence} manifest snapshot was changed`)
  if (
    contentPackValidationReceiptSha256(receipt)
    !== entry.validationReceiptSha256
  ) {
    throw new Error(
      `Publication ${entry.sequence} validation receipt snapshot was changed`,
    )
  }
  if (
    contentPackRepositoryReviewDeclarationSha256(reviewDeclaration)
    !== entry.reviewDeclarationSha256
  ) {
    throw new Error(
      `Publication ${entry.sequence} review declaration snapshot was changed`,
    )
  }

  const historyPrefix: ContentPackPublicationHistory = {
    schemaVersion: 1,
    entries: history.entries.slice(0, index + 1),
  }
  for (const locale of locales) {
    const artifactPath = join(snapshotRoot, `${locale}.json`)
    const artifact = generatedContentPackArtifactSchema.parse(
      readRequiredJson(
        artifactPath,
        `${locale} Content Pack artifact snapshot`,
      ),
    )
    artifacts[locale] = artifact
    assertNormalizedFile(
      artifactPath,
      artifact,
      `${locale} Content Pack artifact snapshot`,
    )
    if (artifact.locale !== locale) {
      throw new Error(
        `Publication ${entry.sequence} stores ${artifact.locale} at ${locale}.json`,
      )
    }
    if (contentPackArtifactSha256(artifact) !== entry.artifacts[locale]) {
      throw new Error(
        `Publication ${entry.sequence} ${locale} artifact snapshot was changed`,
      )
    }
    if (expectedCompiler) {
      projectIntegrityCheckedRepositoryArtifact(
        artifact,
        manifest,
        reviewDeclaration,
        receipt,
        historyPrefix,
        expectedCompiler,
      )
    }
    else {
      projectIntegrityCheckedHistoricalRepositoryArtifact(
        artifact,
        manifest,
        reviewDeclaration,
        receipt,
        historyPrefix,
      )
    }
  }
  assertBilingualLearningContractArtifacts(artifacts.en, artifacts.zh)

  return {
    reviewDeclaration,
    artifacts,
    entry,
    manifest,
    receipt,
  }
}

/**
 * Read the repository-local integrity log for historical Content Packs. Every
 * entry is checked against its snapshot before any candidate bytes are read.
 * The digest chain detects inconsistent repository state, but without an
 * external anchor it cannot prove that a repository writer did not rewrite it.
 */
export function readVerifiedPublicationHistory(
  directory = generatedContentPackDirectory,
  options: { allowLegacyHeadForMigration?: boolean } = {},
): VerifiedPublicationHistory {
  const historyPath = join(directory, 'publication-history.json')
  const history = contentPackPublicationHistorySchema.parse(
    readRequiredJson(historyPath, 'publication history index'),
  )
  assertNormalizedFile(
    historyPath,
    history,
    'publication history index',
  )

  const expectedCompiler = lockedCangjieCompilerIdentity(
    loadCangjieToolchainLock().lock,
  )
  const snapshots = history.entries.map((_, index) =>
    readSnapshot(
      directory,
      history,
      index,
      index === history.entries.length - 1
      && !options.allowLegacyHeadForMigration
        ? expectedCompiler
        : undefined,
    ))
  for (let index = 1; index < snapshots.length; index += 1) {
    for (const locale of locales) {
      assertRetainsPublishedArtifact(
        snapshots[index].artifacts[locale],
        snapshots[index - 1].artifacts[locale],
      )
    }
  }
  return { history, snapshots }
}

export interface VerifiedRepositoryPublication
  extends VerifiedPublicationSnapshot {
  history: ContentPackPublicationHistory
  integrityHead: VerifiedPublicationSnapshot
}

/**
 * Require all current checked-in files to be the exact repository history head.
 * Missing locale artifacts fail even if generation could rebuild them.
 */
export function readVerifiedRepositoryPublication(
  directory = generatedContentPackDirectory,
): VerifiedRepositoryPublication {
  const verifiedHistory = readVerifiedPublicationHistory(directory)
  const head = verifiedHistory.snapshots.at(-1)
  if (!head)
    throw new Error('Content Pack publication history is empty')

  const manifestPath = join(directory, 'manifest.json')
  const receiptPath = join(directory, 'validation-receipt.json')
  const reviewDeclarationPath = join(
    directory,
    'repository-review-declaration.json',
  )
  const manifest = generatedContentPackManifestSchema.parse(
    readRequiredJson(manifestPath, 'current publication manifest'),
  )
  const receipt = contentPackValidationReceiptSchema.parse(
    readRequiredJson(receiptPath, 'current validation receipt'),
  )
  const reviewDeclaration = contentPackRepositoryReviewDeclarationSchema.parse(
    readRequiredJson(
      reviewDeclarationPath,
      'current repository review declaration',
    ),
  )
  const artifacts = {} as Record<'en' | 'zh', GeneratedContentPackArtifact>

  assertNormalizedFile(manifestPath, manifest, 'current publication manifest')
  assertNormalizedFile(receiptPath, receipt, 'current validation receipt')
  assertNormalizedFile(
    reviewDeclarationPath,
    reviewDeclaration,
    'current repository review declaration',
  )
  for (const locale of locales) {
    const artifactPath = join(directory, `${locale}.json`)
    const artifact = generatedContentPackArtifactSchema.parse(
      readRequiredJson(
        artifactPath,
        `current ${locale} Content Pack artifact`,
      ),
    )
    artifacts[locale] = artifact
    assertNormalizedFile(
      artifactPath,
      artifact,
      `current ${locale} Content Pack artifact`,
    )
    projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      receipt,
      verifiedHistory.history,
      lockedCangjieCompilerIdentity(loadCangjieToolchainLock().lock),
    )
    assertRetainsPublishedArtifact(artifact, head.artifacts[locale])
  }
  assertBilingualLearningContractArtifacts(artifacts.en, artifacts.zh)

  return {
    reviewDeclaration,
    artifacts,
    entry: head.entry,
    history: verifiedHistory.history,
    manifest,
    receipt,
    integrityHead: head,
  }
}

export function readCheckedInValidationReceipt(): ContentPackValidationReceipt {
  return readVerifiedRepositoryPublication().receipt
}

/**
 * Rebuild the candidate artifacts and expose every fully classified current
 * or historical pack that the next receipt must compile. This mirrors
 * generation so historical approvals can be carried forward with fresh,
 * exact executable evidence.
 */
export async function buildExpectedContentPackExecutableValidationPacks():
Promise<ContentPackPacksByLocale> {
  const publication = readVerifiedRepositoryPublication()
  const artifacts = {} as Record<'en' | 'zh', GeneratedContentPackArtifact>
  for (const locale of locales) {
    const currentPacks = await buildCurrentCourseContentPacks(locale)
    artifacts[locale] = mergeGeneratedContentPackArtifact(
      locale,
      currentPacks,
      publication.integrityHead.artifacts[locale],
    ).artifact
  }
  return {
    en: artifacts.en.packs,
    zh: artifacts.zh.packs,
  }
}

export interface ExpectedReferenceValidation {
  compiler: ContentPackCompilerIdentity
  codeSamples: ContentPackCodeSampleValidation[]
  templates: ContentPackReferenceValidation[]
}

/**
 * Rebuild all source-derived bytes and verify the immutable publication chain.
 * This does not execute cjc; callers choose either checked-in receipt hashes or
 * freshly compiled reference-validation results.
 */
export async function verifyContentPackPublication(
  expectedValidation: ExpectedReferenceValidation,
): Promise<{ codeSamples: number, templates: number }> {
  const publication = readVerifiedRepositoryPublication()
  const expectedArtifacts = {} as Record<
    'zh' | 'en',
    GeneratedContentPackArtifact
  >
  const expectedManifest: GeneratedContentPackManifest = {
    schemaVersion: 1,
    locales: {
      en: { artifactSha256: '', currentVersions: {} },
      zh: { artifactSha256: '', currentVersions: {} },
    },
  }
  const currentPacks: Record<'en' | 'zh', CourseContentPack[]> = {
    en: [],
    zh: [],
  }

  for (const locale of locales) {
    const artifactPath = join(
      generatedContentPackDirectory,
      `${locale}.json`,
    )
    const localePacks = await buildCurrentCourseContentPacks(locale)
    currentPacks[locale] = localePacks
    const { artifact, currentVersions } = mergeGeneratedContentPackArtifact(
      locale,
      localePacks,
      publication.integrityHead.artifacts[locale],
    )
    expectedArtifacts[locale] = artifact
    expectedManifest.locales[locale] = {
      artifactSha256: contentPackArtifactSha256(artifact),
      currentVersions,
    }

    if (
      readRequiredText(
        artifactPath,
        `current ${locale} Content Pack artifact`,
      ) !== formatGeneratedJson(expectedArtifacts[locale])
    ) {
      throw new Error(
        `${locale} Content Pack artifact is stale; `
        + 'run pnpm content-packs:generate',
      )
    }
  }
  assertBilingualLearningContractArtifacts(
    expectedArtifacts.en,
    expectedArtifacts.zh,
  )

  if (
    readRequiredText(
      join(generatedContentPackDirectory, 'manifest.json'),
      'current publication manifest',
    ) !== formatGeneratedJson(expectedManifest)
  ) {
    throw new Error(
      'Content Pack manifest is stale; run pnpm content-packs:generate',
    )
  }

  const executableValidationPacks = {
    en: expectedArtifacts.en.packs,
    zh: expectedArtifacts.zh.packs,
  }
  const codeSamples = getReceiptBoundContentPackCodeSampleValidations(
    executableValidationPacks,
    expectedValidation.codeSamples,
  )
  const expectedReceipt: ContentPackValidationReceipt = {
    schemaVersion: 5,
    validationProtocol: 'cjc-content-pack-executables-v3',
    compiler: expectedValidation.compiler,
    templates: expectedValidation.templates,
    codeSamples,
    artifacts: {
      en: expectedManifest.locales.en.artifactSha256,
      zh: expectedManifest.locales.zh.artifactSha256,
    },
  }
  if (
    readRequiredText(
      join(generatedContentPackDirectory, 'validation-receipt.json'),
      'current validation receipt',
    ) !== formatGeneratedJson(expectedReceipt)
  ) {
    throw new Error(
      'Content Pack validation receipt is stale; '
      + 'run pnpm content-packs:generate',
    )
  }

  for (const locale of locales) {
    projectIntegrityCheckedRepositoryArtifact(
      expectedArtifacts[locale],
      expectedManifest,
      publication.reviewDeclaration,
      expectedReceipt,
      publication.history,
      lockedCangjieCompilerIdentity(loadCangjieToolchainLock().lock),
    )
  }
  return {
    codeSamples: codeSamples.length,
    templates: expectedValidation.templates.length,
  }
}
