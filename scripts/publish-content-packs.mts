import { randomUUID } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  join,
  resolve,
} from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  assertBilingualLearningContractArtifacts,
  assertCurrentContentPackValidationReceipt,
  assertRetainsPublishedArtifact,
  contentPackArtifactSha256,
  contentPackHistoryEntrySha256,
  contentPackManifestSha256,
  contentPackPublicationHistorySchema,
  contentPackRepositoryReviewDeclarationSchema,
  contentPackRepositoryReviewDeclarationSha256,
  contentPackValidationReceiptSha256,
  currentContentPackValidationReceiptSchema,
  formatGeneratedJson,
  generatedContentPackArtifactSchema,
  generatedContentPackManifestSchema,
} from '../src/lib/teach/classroom/content-pack-artifact'
import type {
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
import { canonicalJson } from '../src/lib/teach/classroom/canonical-json'
import {
  generatedContentPackDirectory,
  readVerifiedPublicationHistory,
  readVerifiedRepositoryPublication,
} from './content-pack-verification.mts'

const locales = ['en', 'zh'] as const
const supportedReviewScope = 'artifact-diff-and-validation-chain' as const

interface PublicationCandidate {
  artifacts: Record<'en' | 'zh', GeneratedContentPackArtifact>
  manifest: GeneratedContentPackManifest
  receipt: ContentPackValidationReceipt
}

export interface FinalizeContentPackPublicationOptions {
  declaredAt?: string
  directory?: string
  dryRun?: boolean
  reviewerLabel: string
  reviewScope: typeof supportedReviewScope
}

export interface ContentPackPublicationResult {
  dryRun: boolean
  entrySha256: string
  sequence: number
  snapshotDirectory: string
}

export interface ContentPackPublicationCliArgs {
  dryRun: boolean
  reviewerLabel: string
  reviewScope: typeof supportedReviewScope
}

function readCliValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--'))
    throw new Error(`${flag} requires a non-empty value`)
  const trimmed = value.trim()
  if (!trimmed)
    throw new Error(`${flag} requires a non-empty value`)
  return trimmed
}

export function parseContentPackPublicationCliArgs(
  args: readonly string[],
): ContentPackPublicationCliArgs {
  let dryRun = false
  let reviewerLabel: string | undefined
  let reviewScope: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--dry-run') {
      if (dryRun)
        throw new Error('Duplicate --dry-run argument')
      dryRun = true
      continue
    }
    if (argument === '--reviewer-label') {
      if (reviewerLabel !== undefined)
        throw new Error('Duplicate --reviewer-label argument')
      reviewerLabel = readCliValue(args, index, argument)
      index += 1
      continue
    }
    if (argument === '--review-scope') {
      if (reviewScope !== undefined)
        throw new Error('Duplicate --review-scope argument')
      reviewScope = readCliValue(args, index, argument)
      index += 1
      continue
    }
    throw new Error(`Unknown Content Pack publication argument: ${argument}`)
  }

  if (reviewerLabel === undefined)
    throw new Error('Missing required --reviewer-label argument')
  if (reviewScope === undefined)
    throw new Error('Missing required --review-scope argument')
  if (reviewScope !== supportedReviewScope) {
    throw new Error(
      `Unsupported --review-scope; expected ${supportedReviewScope}`,
    )
  }
  return {
    dryRun,
    reviewerLabel,
    reviewScope,
  }
}

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

function assertNormalized(
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

function readPublicationCandidate(
  directory: string,
  historyHead?: ReturnType<
    typeof readVerifiedPublicationHistory
  >['snapshots'][number],
): PublicationCandidate {
  const manifestPath = join(directory, 'manifest.json')
  const receiptPath = join(directory, 'validation-receipt.json')
  const manifest = generatedContentPackManifestSchema.parse(
    readRequiredJson(manifestPath, 'candidate manifest'),
  )
  const receipt = assertCurrentContentPackValidationReceipt(
    currentContentPackValidationReceiptSchema.parse(
      readRequiredJson(receiptPath, 'candidate validation receipt'),
    ),
    lockedCangjieCompilerIdentity(loadCangjieToolchainLock().lock),
  )
  const artifacts = {} as Record<
    'en' | 'zh',
    GeneratedContentPackArtifact
  >

  assertNormalized(manifestPath, manifest, 'candidate manifest')
  assertNormalized(receiptPath, receipt, 'candidate validation receipt')
  for (const locale of locales) {
    const artifactPath = join(directory, `${locale}.json`)
    const artifact = generatedContentPackArtifactSchema.parse(
      readRequiredJson(artifactPath, `candidate ${locale} artifact`),
    )
    artifacts[locale] = artifact
    assertNormalized(
      artifactPath,
      artifact,
      `candidate ${locale} artifact`,
    )
    if (artifact.locale !== locale) {
      throw new Error(
        `Candidate stores ${artifact.locale} Content Packs at ${locale}.json`,
      )
    }
    const artifactDigest = contentPackArtifactSha256(artifact)
    if (manifest.locales[locale].artifactSha256 !== artifactDigest) {
      throw new Error(
        `Candidate ${locale} artifact does not match its manifest digest`,
      )
    }
    if (receipt.artifacts[locale] !== artifactDigest) {
      throw new Error(
        `Candidate ${locale} artifact does not match its validation receipt digest`,
      )
    }
    if (
      canonicalJson(manifest.locales[locale].currentVersions)
      !== canonicalJson(artifact.currentVersions)
    ) {
      throw new Error(
        `Candidate ${locale} current versions do not match its manifest`,
      )
    }
    if (historyHead) {
      assertRetainsPublishedArtifact(
        artifact,
        historyHead.artifacts[locale],
      )
    }
  }
  assertBilingualLearningContractArtifacts(artifacts.en, artifacts.zh)

  return { artifacts, manifest, receipt }
}

function buildPublicationRecords(
  candidate: PublicationCandidate,
  history: ContentPackPublicationHistory | undefined,
  reviewerLabel: string,
  reviewScope: typeof supportedReviewScope,
  declaredAt: string,
): {
  declaration: ContentPackRepositoryReviewDeclaration
  entry: ContentPackPublicationHistoryEntry
  history: ContentPackPublicationHistory
} {
  const previousEntry = history?.entries.at(-1)
  const sequence = previousEntry === undefined
    ? 1
    : previousEntry.sequence + 1
  const snapshotDirectory = String(sequence).padStart(4, '0')
  const manifestSha256 = contentPackManifestSha256(candidate.manifest)
  const validationReceiptSha256
    = contentPackValidationReceiptSha256(candidate.receipt)
  const artifacts = {
    en: contentPackArtifactSha256(candidate.artifacts.en),
    zh: contentPackArtifactSha256(candidate.artifacts.zh),
  }
  const declaration = contentPackRepositoryReviewDeclarationSchema.parse({
    schemaVersion: 3,
    generator: {
      command: 'pnpm content-packs:generate',
    },
    declaration: {
      kind: 'repository-review-declaration',
      reviewerLabel,
      declaredAt,
      scope: reviewScope,
      trustModel: 'repository-code-review',
      provenance: 'self-asserted-repository-metadata',
      externalTrustAnchor: false,
    },
    previousHistoryEntrySha256: previousEntry?.entrySha256 ?? null,
    manifestSha256,
    validationReceiptSha256,
    artifacts,
  })
  const entryCore = {
    sequence,
    previousEntrySha256: previousEntry?.entrySha256 ?? null,
    snapshotDirectory,
    artifacts,
    manifestSha256,
    validationReceiptSha256,
    reviewDeclarationSha256:
      contentPackRepositoryReviewDeclarationSha256(declaration),
  }
  const entry = {
    ...entryCore,
    entrySha256: contentPackHistoryEntrySha256(entryCore),
  }
  const nextHistory = contentPackPublicationHistorySchema.parse({
    schemaVersion: 1,
    entries: [...(history?.entries ?? []), entry],
  })
  return { declaration, entry, history: nextHistory }
}

function writePublicationToStaging(
  sourceDirectory: string,
  stagingDirectory: string,
  candidate: PublicationCandidate,
  declaration: ContentPackRepositoryReviewDeclaration,
  history: ContentPackPublicationHistory,
  entry: ContentPackPublicationHistoryEntry,
): void {
  cpSync(sourceDirectory, stagingDirectory, { recursive: true })
  const snapshotDirectory = join(
    stagingDirectory,
    'history',
    entry.snapshotDirectory,
  )
  mkdirSync(snapshotDirectory, { recursive: true })
  for (const locale of locales) {
    writeFileSync(
      join(snapshotDirectory, `${locale}.json`),
      formatGeneratedJson(candidate.artifacts[locale]),
      'utf8',
    )
  }
  writeFileSync(
    join(snapshotDirectory, 'manifest.json'),
    formatGeneratedJson(candidate.manifest),
    'utf8',
  )
  writeFileSync(
    join(snapshotDirectory, 'validation-receipt.json'),
    formatGeneratedJson(candidate.receipt),
    'utf8',
  )
  const declarationBytes = formatGeneratedJson(declaration)
  writeFileSync(
    join(snapshotDirectory, 'repository-review-declaration.json'),
    declarationBytes,
    'utf8',
  )
  writeFileSync(
    join(stagingDirectory, 'repository-review-declaration.json'),
    declarationBytes,
    'utf8',
  )
  writeFileSync(
    join(stagingDirectory, 'publication-history.json'),
    formatGeneratedJson(history),
    'utf8',
  )
}

function atomicReplaceText(file: string, text: string): void {
  const temporaryFile = join(
    dirname(file),
    `.${basename(file)}.${process.pid}.${randomUUID()}.tmp`,
  )
  try {
    writeFileSync(temporaryFile, text, {
      encoding: 'utf8',
      flag: 'wx',
    })
    renameSync(temporaryFile, file)
  }
  finally {
    rmSync(temporaryFile, { force: true })
  }
}

function restoreText(file: string, previous: string | undefined): void {
  if (previous === undefined) {
    rmSync(file, { force: true })
    return
  }
  atomicReplaceText(file, previous)
}

function commitStagedPublication(
  directory: string,
  stagingDirectory: string,
  entry: ContentPackPublicationHistoryEntry,
): void {
  const snapshotSource = join(
    stagingDirectory,
    'history',
    entry.snapshotDirectory,
  )
  const snapshotTarget = join(
    directory,
    'history',
    entry.snapshotDirectory,
  )
  const declarationPath = join(
    directory,
    'repository-review-declaration.json',
  )
  const historyPath = join(directory, 'publication-history.json')
  const previousDeclaration = existsSync(declarationPath)
    ? readFileSync(declarationPath, 'utf8')
    : undefined
  const previousHistory = existsSync(historyPath)
    ? readFileSync(historyPath, 'utf8')
    : undefined
  let snapshotCommitted = false
  let declarationCommitted = false
  let historyCommitted = false
  let historyDirectoryCreated = false

  try {
    const historyDirectory = dirname(snapshotTarget)
    if (!existsSync(historyDirectory)) {
      mkdirSync(historyDirectory)
      historyDirectoryCreated = true
    }
    renameSync(snapshotSource, snapshotTarget)
    snapshotCommitted = true
    atomicReplaceText(
      declarationPath,
      readFileSync(
        join(stagingDirectory, 'repository-review-declaration.json'),
        'utf8',
      ),
    )
    declarationCommitted = true
    atomicReplaceText(
      historyPath,
      readFileSync(
        join(stagingDirectory, 'publication-history.json'),
        'utf8',
      ),
    )
    historyCommitted = true
    readVerifiedRepositoryPublication(directory)
  }
  catch (error) {
    const rollbackErrors: unknown[] = []
    try {
      if (historyCommitted)
        restoreText(historyPath, previousHistory)
    }
    catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
    try {
      if (declarationCommitted)
        restoreText(declarationPath, previousDeclaration)
    }
    catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
    try {
      if (snapshotCommitted)
        rmSync(snapshotTarget, { force: true, recursive: true })
      if (historyDirectoryCreated)
        rmSync(dirname(snapshotTarget), { force: true })
    }
    catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Content Pack publication failed and rollback was incomplete',
      )
    }
    throw error
  }
}

export function finalizeContentPackPublication(
  options: FinalizeContentPackPublicationOptions,
): ContentPackPublicationResult {
  const directory = resolve(options.directory ?? generatedContentPackDirectory)

  // Historical snapshots are the only authority for immutable published
  // versions. Validate them before reading any mutable generated candidate.
  // With no publication metadata at all, this is the repository genesis.
  const historyPath = join(directory, 'publication-history.json')
  const declarationPath = join(
    directory,
    'repository-review-declaration.json',
  )
  const historyDirectory = join(directory, 'history')
  const hasHistory = existsSync(historyPath)
  if (
    !hasHistory
    && (existsSync(declarationPath) || existsSync(historyDirectory))
  ) {
    throw new Error(
      'Incomplete Content Pack publication metadata cannot be used as genesis',
    )
  }
  const verifiedHistory = hasHistory
    ? readVerifiedPublicationHistory(directory, {
        allowLegacyHeadForMigration: true,
      })
    : undefined
  const historyHead = verifiedHistory?.snapshots.at(-1)
  if (hasHistory && !historyHead)
    throw new Error('Content Pack publication history is empty')

  const candidate = readPublicationCandidate(directory, historyHead)
  if (
    historyHead
    && locales.every(locale =>
      contentPackArtifactSha256(candidate.artifacts[locale])
      === historyHead.entry.artifacts[locale])
    && contentPackManifestSha256(candidate.manifest)
    === historyHead.entry.manifestSha256
    && contentPackValidationReceiptSha256(candidate.receipt)
    === historyHead.entry.validationReceiptSha256
  ) {
    throw new Error('This Content Pack validation envelope is already published')
  }
  const declaredAt = options.declaredAt
    ?? new Date().toISOString().slice(0, 10)
  const records = buildPublicationRecords(
    candidate,
    verifiedHistory?.history,
    options.reviewerLabel,
    options.reviewScope,
    declaredAt,
  )
  const snapshotTarget = join(
    directory,
    'history',
    records.entry.snapshotDirectory,
  )
  if (existsSync(snapshotTarget)) {
    throw new Error(
      `Publication snapshot already exists: ${snapshotTarget}`,
    )
  }

  const stagingParent = mkdtempSync(
    join(dirname(directory), `.${basename(directory)}-publication-`),
  )
  const stagingDirectory = join(stagingParent, basename(directory))
  try {
    writePublicationToStaging(
      directory,
      stagingDirectory,
      candidate,
      records.declaration,
      records.history,
      records.entry,
    )
    readVerifiedRepositoryPublication(stagingDirectory)
    if (!options.dryRun) {
      commitStagedPublication(
        directory,
        stagingDirectory,
        records.entry,
      )
    }
  }
  finally {
    rmSync(stagingParent, { force: true, recursive: true })
  }

  return {
    dryRun: options.dryRun === true,
    entrySha256: records.entry.entrySha256,
    sequence: records.entry.sequence,
    snapshotDirectory: records.entry.snapshotDirectory,
  }
}

function runCli(args: readonly string[]): void {
  const options = parseContentPackPublicationCliArgs(args)
  const result = finalizeContentPackPublication(options)
  const action = result.dryRun ? 'Dry-run validated' : 'Published'
  console.log(
    `${action} repository-local Content Pack publication `
    + `${result.sequence} (${result.snapshotDirectory}, `
    + `${result.entrySha256}).`,
  )
  console.log(
    'The reviewer label is self-asserted repository metadata; '
    + 'this record has no external trust anchor.',
  )
}

const entryPoint = process.argv[1]
if (
  entryPoint !== undefined
  && import.meta.url === pathToFileURL(resolve(entryPoint)).href
) {
  try {
    runCli(process.argv.slice(2))
  }
  catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = 1
  }
}

export { supportedReviewScope }
