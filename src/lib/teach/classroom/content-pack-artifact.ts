import { Buffer } from 'node:buffer'
import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto'
import { z } from 'zod'
import type {
  ContentPacksResponse,
  CourseContentPack,
} from './content-packs'
import {
  contentPackIdSchema,
  contentPacksResponseSchema,
  contentVersionSchema,
  courseContentPackSchema,
} from './content-packs'
import {
  assignBilingualLearningContractVersions,
  assignImmutableContentVersion,
  canonicalJson,
  sha256Canonical,
} from './content-pack-version'

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const currentVersionsSchema = z.record(
  contentPackIdSchema,
  contentVersionSchema,
)
const localeDigestsSchema = z.object({
  en: sha256Schema,
  zh: sha256Schema,
}).strict()

export const generatedContentPackArtifactSchema = z.object({
  schemaVersion: z.literal(2),
  locale: z.enum(['zh', 'en']),
  packs: z.array(courseContentPackSchema).min(1),
  currentVersions: currentVersionsSchema,
}).strict().superRefine((artifact, ctx) => {
  const identities = new Set<string>()
  for (const [index, pack] of artifact.packs.entries()) {
    const identity = `${pack.concept.id}\0${pack.version}`
    if (identities.has(identity)) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index],
        message: `duplicate Concept Version ${pack.concept.id}@${pack.version}`,
      })
    }
    identities.add(identity)
    if (
      pack.review.status !== 'pending'
      || 'reviewedBy' in pack.review
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index, 'review'],
        message: 'generated artifacts must remain pending repository review',
      })
    }
    const addressedVersion = assignImmutableContentVersion(
      pack,
      artifact.locale,
    ).version
    if (pack.version !== addressedVersion) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index, 'version'],
        message: `Content Version does not match ${artifact.locale} pack content`,
      })
    }
  }
  const response = contentPacksResponseSchema.safeParse({
    packs: artifact.packs,
    currentVersions: artifact.currentVersions,
  })
  if (!response.success) {
    for (const issue of response.error.issues) {
      ctx.addIssue({
        code: 'custom',
        path: issue.path,
        message: issue.message,
      })
    }
  }
})
export type GeneratedContentPackArtifact
  = z.infer<typeof generatedContentPackArtifactSchema>

const localeManifestSchema = z.object({
  artifactSha256: sha256Schema,
  currentVersions: currentVersionsSchema,
}).strict()

export const generatedContentPackManifestSchema = z.object({
  schemaVersion: z.literal(1),
  locales: z.object({
    en: localeManifestSchema,
    zh: localeManifestSchema,
  }).strict(),
}).strict()
export type GeneratedContentPackManifest
  = z.infer<typeof generatedContentPackManifestSchema>

export const contentPackRepositoryReviewDeclarationSchema = z.object({
  schemaVersion: z.literal(3),
  generator: z.object({
    command: z.literal('pnpm content-packs:generate'),
  }).strict(),
  declaration: z.object({
    kind: z.literal('repository-review-declaration'),
    reviewerLabel: z.string().trim().min(1).max(160),
    declaredAt: z.iso.date(),
    scope: z.literal('artifact-diff-and-validation-chain'),
    trustModel: z.literal('repository-code-review'),
    provenance: z.literal('self-asserted-repository-metadata'),
    externalTrustAnchor: z.literal(false),
  }).strict(),
  previousHistoryEntrySha256: sha256Schema.nullable(),
  manifestSha256: sha256Schema,
  validationReceiptSha256: sha256Schema,
  artifacts: localeDigestsSchema,
}).strict()
export type ContentPackRepositoryReviewDeclaration = z.infer<
  typeof contentPackRepositoryReviewDeclarationSchema
>

const externalReviewApprovedPackSchema = z.object({
  locale: z.enum(['en', 'zh']),
  conceptId: contentPackIdSchema,
  contentVersion: contentVersionSchema,
}).strict()

const contentPackExternalReviewAttestationUnsignedSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('external-content-pack-review-attestation'),
  algorithm: z.literal('Ed25519'),
  keyId: z.string().regex(/^[\w.-]{1,64}$/),
  issuedAt: z.iso.datetime({ offset: true }),
  subject: z.object({
    publicationEntrySha256: sha256Schema,
    manifestSha256: sha256Schema,
    validationReceiptSha256: sha256Schema,
    artifacts: localeDigestsSchema,
    // One locale artifact may retain 1,024 exact versions. A bilingual
    // attestation must be able to carry approval for both artifacts.
    approvedPacks: z.array(externalReviewApprovedPackSchema).min(1).max(2_048),
  }).strict(),
}).strict().superRefine((attestation, ctx) => {
  const identities = new Set<string>()
  for (const [index, pack] of attestation.subject.approvedPacks.entries()) {
    const identity = `${pack.locale}\0${pack.conceptId}\0${pack.contentVersion}`
    if (identities.has(identity)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject', 'approvedPacks', index],
        message: 'duplicate externally approved Content Pack identity',
      })
    }
    identities.add(identity)
  }
})

export const contentPackExternalReviewAttestationSchema
  = contentPackExternalReviewAttestationUnsignedSchema.safeExtend({
    signature: z.string().regex(/^[A-Z0-9+/]+={0,2}$/i).max(1_024),
  }).strict()
export type ContentPackExternalReviewAttestation
  = z.infer<typeof contentPackExternalReviewAttestationSchema>
export type ContentPackExternalReviewAttestationUnsigned
  = z.infer<typeof contentPackExternalReviewAttestationUnsignedSchema>

const externalReviewAttestationDomain
  = 'playground-cj/content-pack-external-review-attestation/v1'

export function contentPackExternalReviewAttestationSigningPayload(
  input: ContentPackExternalReviewAttestationUnsigned,
): string {
  const attestation
    = contentPackExternalReviewAttestationUnsignedSchema.parse(input)
  return canonicalJson({
    domain: externalReviewAttestationDomain,
    attestation,
  })
}

const referenceValidationSchema = z.object({
  templateId: contentPackIdSchema,
  validationInputSha256: sha256Schema,
  validationResultSha256: sha256Schema,
}).strict()

const legacyCompilerIdentitySchema = z.object({
  name: z.literal('cjc'),
  version: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/i),
  backend: z.literal('cjnative'),
}).strict()

const toolchainProvenanceSchema = z.object({
  release: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/i),
  sdkArchiveSha256: sha256Schema,
  compilerExecutableSha256: sha256Schema,
  lockFileSha256: sha256Schema,
}).strict()

const compilerIdentitySchema = legacyCompilerIdentitySchema.safeExtend({
  target: z.literal('x86_64-unknown-linux-gnu'),
  toolchain: toolchainProvenanceSchema,
}).strict()

export function contentPackCodeSampleSourceSha256(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

export function contentPackCodeSampleOutputSha256(
  normalizedStdout: string,
): string {
  return createHash('sha256').update(normalizedStdout, 'utf8').digest('hex')
}

export function contentPackCodeSampleValidationResultSha256(
  sourceSha256: string,
  normalizedStdoutSha256: string,
): string {
  return sha256Canonical({
    compileStatus: 'success',
    normalizedStdoutSha256,
    runStatus: 'success',
    sourceSha256,
    validationProtocol: 'cjc-content-pack-executables-v3',
  })
}

const codeSampleValidationSchema = z.object({
  locale: z.enum(['en', 'zh']),
  conceptId: contentPackIdSchema,
  contentVersion: contentVersionSchema,
  blockId: contentPackIdSchema,
  sourceSha256: sha256Schema,
  normalizedStdoutSha256: sha256Schema,
  validationResultSha256: sha256Schema,
}).strict()
export type ContentPackCodeSampleValidation
  = z.infer<typeof codeSampleValidationSchema>

const legacyContentPackValidationReceiptSchema = z.object({
  schemaVersion: z.literal(4),
  validationProtocol: z.literal('cjc-content-pack-executables-v3'),
  compiler: legacyCompilerIdentitySchema,
  templates: z.array(referenceValidationSchema).min(1),
  codeSamples: z.array(codeSampleValidationSchema).max(100_000),
  artifacts: localeDigestsSchema,
}).strict()

export const currentContentPackValidationReceiptSchema = z.object({
  schemaVersion: z.literal(5),
  validationProtocol: z.literal('cjc-content-pack-executables-v3'),
  compiler: compilerIdentitySchema,
  templates: z.array(referenceValidationSchema).min(1),
  codeSamples: z.array(codeSampleValidationSchema).max(100_000),
  artifacts: localeDigestsSchema,
}).strict()
export type CurrentContentPackValidationReceipt
  = z.infer<typeof currentContentPackValidationReceiptSchema>
export type CurrentContentPackCompilerIdentity
  = CurrentContentPackValidationReceipt['compiler']

export const contentPackValidationReceiptSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    legacyContentPackValidationReceiptSchema,
    currentContentPackValidationReceiptSchema,
  ],
).superRefine((receipt, ctx) => {
  const templateIds = new Set<string>()
  for (const [index, template] of receipt.templates.entries()) {
    if (templateIds.has(template.templateId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['templates', index, 'templateId'],
        message: `duplicate validated template ${template.templateId}`,
      })
    }
    templateIds.add(template.templateId)
  }
  const codeSampleIdentities = new Set<string>()
  for (const [index, sample] of receipt.codeSamples.entries()) {
    const identity = [
      sample.locale,
      sample.conceptId,
      sample.contentVersion,
      sample.blockId,
    ].join('\0')
    if (codeSampleIdentities.has(identity)) {
      ctx.addIssue({
        code: 'custom',
        path: ['codeSamples', index],
        message: `duplicate validated code sample ${identity.replaceAll('\0', '/')}`,
      })
    }
    codeSampleIdentities.add(identity)
    const expectedResult = contentPackCodeSampleValidationResultSha256(
      sample.sourceSha256,
      sample.normalizedStdoutSha256,
    )
    if (sample.validationResultSha256 !== expectedResult) {
      ctx.addIssue({
        code: 'custom',
        path: ['codeSamples', index, 'validationResultSha256'],
        message: 'code sample validation result does not match its source and output',
      })
    }
  }
})
export type ContentPackValidationReceipt
  = z.infer<typeof contentPackValidationReceiptSchema>

export function assertCurrentContentPackValidationReceipt(
  receiptInput: unknown,
  expectedCompilerInput: unknown,
): CurrentContentPackValidationReceipt {
  const receipt = currentContentPackValidationReceiptSchema.parse(receiptInput)
  const expectedCompiler = compilerIdentitySchema.parse(expectedCompilerInput)
  if (canonicalJson(receipt.compiler) !== canonicalJson(expectedCompiler)) {
    throw new Error(
      'Content Pack validation receipt does not match the locked Cangjie toolchain',
    )
  }
  return receipt
}

const publicationHistoryEntryCoreSchema = z.object({
  sequence: z.number().int().positive(),
  previousEntrySha256: sha256Schema.nullable(),
  snapshotDirectory: z.string().regex(/^\d{4}$/),
  artifacts: localeDigestsSchema,
  manifestSha256: sha256Schema,
  validationReceiptSha256: sha256Schema,
  reviewDeclarationSha256: sha256Schema,
}).strict()

const publicationHistoryEntrySchema = publicationHistoryEntryCoreSchema.extend({
  entrySha256: sha256Schema,
}).strict()

export const contentPackPublicationHistorySchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(publicationHistoryEntrySchema).min(1),
}).strict().superRefine((history, ctx) => {
  for (const [index, entry] of history.entries.entries()) {
    const expectedSequence = index + 1
    const expectedPrevious = index === 0
      ? null
      : history.entries[index - 1].entrySha256
    if (entry.sequence !== expectedSequence) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'sequence'],
        message: `expected contiguous repository history sequence ${expectedSequence}`,
      })
    }
    if (entry.previousEntrySha256 !== expectedPrevious) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'previousEntrySha256'],
        message: 'publication history chain is broken',
      })
    }
    if (entry.snapshotDirectory !== String(expectedSequence).padStart(4, '0')) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'snapshotDirectory'],
        message: 'publication snapshot directory does not match its sequence',
      })
    }
    if (entry.entrySha256 !== contentPackHistoryEntrySha256(entry)) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'entrySha256'],
        message: 'publication history entry digest does not match its record',
      })
    }
  }
})
export type ContentPackPublicationHistory
  = z.infer<typeof contentPackPublicationHistorySchema>
export type ContentPackPublicationHistoryEntry
  = z.infer<typeof publicationHistoryEntrySchema>

export function contentPackArtifactSha256(
  artifact: GeneratedContentPackArtifact,
): string {
  const normalizedBytes = formatGeneratedJson(
    generatedContentPackArtifactSchema.parse(artifact),
  )
  return createHash('sha256').update(normalizedBytes, 'utf8').digest('hex')
}

export function formatGeneratedJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function contentPackValidationReceiptSha256(
  receipt: ContentPackValidationReceipt,
): string {
  const normalizedBytes = formatGeneratedJson(
    contentPackValidationReceiptSchema.parse(receipt),
  )
  return createHash('sha256').update(normalizedBytes, 'utf8').digest('hex')
}

export function contentPackManifestSha256(
  manifest: GeneratedContentPackManifest,
): string {
  const normalizedBytes = formatGeneratedJson(
    generatedContentPackManifestSchema.parse(manifest),
  )
  return createHash('sha256').update(normalizedBytes, 'utf8').digest('hex')
}

export function contentPackRepositoryReviewDeclarationSha256(
  declaration: ContentPackRepositoryReviewDeclaration,
): string {
  const normalizedBytes = formatGeneratedJson(
    contentPackRepositoryReviewDeclarationSchema.parse(declaration),
  )
  return createHash('sha256').update(normalizedBytes, 'utf8').digest('hex')
}

export function contentPackHistoryEntrySha256(
  entryInput:
    | ContentPackPublicationHistoryEntry
    | z.input<typeof publicationHistoryEntryCoreSchema>,
): string {
  const {
    entrySha256: _entrySha256,
    ...entry
  } = entryInput as ContentPackPublicationHistoryEntry
  const normalized = publicationHistoryEntryCoreSchema.parse(entry)
  return createHash('sha256')
    .update(canonicalJson(normalized), 'utf8')
    .digest('hex')
}

function samePack(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

/**
 * Fail closed when a published historical identity is absent or changed.
 * The comparison input must come from an integrity-checked repository snapshot,
 * never from the current candidate artifact. This is not an external trust
 * anchor: a repository writer can rewrite both the log and its snapshots.
 */
export function assertRetainsPublishedArtifact(
  candidateInput: unknown,
  integrityCheckedHistoricalInput: unknown,
): void {
  const candidate = generatedContentPackArtifactSchema.parse(candidateInput)
  const historical = generatedContentPackArtifactSchema.parse(
    integrityCheckedHistoricalInput,
  )
  if (candidate.locale !== historical.locale) {
    throw new Error(
      `Cannot compare ${candidate.locale} Content Packs with `
      + `${historical.locale} publication history`,
    )
  }
  const candidatesByIdentity = new Map(candidate.packs.map(pack => [
    `${pack.concept.id}\0${pack.version}`,
    pack,
  ]))
  for (const historicalPack of historical.packs) {
    const identity = `${historicalPack.concept.id}\0${historicalPack.version}`
    const candidatePack = candidatesByIdentity.get(identity)
    if (!candidatePack) {
      throw new Error(
        `Candidate deleted published Content Pack `
        + `${historicalPack.concept.id}@${historicalPack.version}`,
      )
    }
    if (!samePack(candidatePack, historicalPack)) {
      throw new Error(
        `Candidate changed published Content Pack `
        + `${historicalPack.concept.id}@${historicalPack.version}`,
      )
    }
  }
}

/**
 * Add newly generated current packs while retaining every immutable
 * historical version already checked into the locale artifact.
 */
export function mergeGeneratedContentPackArtifact(
  locale: 'zh' | 'en',
  currentPacks: CourseContentPack[],
  integrityCheckedHistorical?: unknown,
): {
  artifact: GeneratedContentPackArtifact
  currentVersions: Record<string, string>
} {
  const currentVersions: Record<string, string> = {}
  const currentIdentities = new Map<string, CourseContentPack>()
  for (const pack of currentPacks) {
    if (
      pack.review.status !== 'pending'
      || 'reviewedBy' in pack.review
    ) {
      throw new Error(
        `Content Pack generator marked ${pack.concept.id} as already reviewed`,
      )
    }
    if (currentVersions[pack.concept.id]) {
      throw new Error(
        `Content Pack generator produced multiple current versions for ${pack.concept.id}`,
      )
    }
    currentVersions[pack.concept.id] = pack.version
    currentIdentities.set(`${pack.concept.id}\0${pack.version}`, pack)
  }

  const historical: CourseContentPack[] = []
  let parsedHistorical: GeneratedContentPackArtifact | undefined
  if (integrityCheckedHistorical !== undefined) {
    const parsed = generatedContentPackArtifactSchema.parse(
      integrityCheckedHistorical,
    )
    parsedHistorical = parsed
    if (parsed.locale !== locale)
      throw new Error(`Expected ${locale} Content Pack artifact, received ${parsed.locale}`)
    for (const pack of parsed.packs) {
      const current = currentIdentities.get(
        `${pack.concept.id}\0${pack.version}`,
      )
      if (current) {
        if (!samePack(current, pack)) {
          throw new Error(
            `Immutable generated Content Pack collision for ${pack.concept.id}@${pack.version}`,
          )
        }
        continue
      }
      historical.push(pack)
    }
  }

  const artifact = generatedContentPackArtifactSchema.parse({
    schemaVersion: 2,
    locale,
    packs: [...currentPacks, ...historical],
    currentVersions,
  })
  if (parsedHistorical)
    assertRetainsPublishedArtifact(artifact, parsedHistorical)
  return { artifact, currentVersions }
}

/**
 * Validate the cross-locale half of schema v2. A locale artifact is never
 * sufficient on its own because recall answers and quiz options are localized
 * evaluator vocabulary derived from one canonical English contract.
 */
export function assertBilingualLearningContractArtifacts(
  englishInput: unknown,
  chineseInput: unknown,
): void {
  const english = generatedContentPackArtifactSchema.parse(englishInput)
  const chinese = generatedContentPackArtifactSchema.parse(chineseInput)
  if (english.locale !== 'en' || chinese.locale !== 'zh')
    throw new Error('Bilingual Learning Contract validation requires en and zh artifacts')

  const currentPack = (
    artifact: GeneratedContentPackArtifact,
    conceptId: string,
  ): CourseContentPack | undefined => artifact.packs.find(pack =>
    pack.concept.id === conceptId
    && pack.version === artifact.currentVersions[conceptId])
  const englishCurrent = Object.keys(english.currentVersions)
    .map(conceptId => currentPack(english, conceptId))
    .filter((pack): pack is CourseContentPack => pack !== undefined)
  const chineseCurrent = Object.keys(chinese.currentVersions)
    .map(conceptId => currentPack(chinese, conceptId))
    .filter((pack): pack is CourseContentPack => pack !== undefined)
  const assigned = assignBilingualLearningContractVersions(
    englishCurrent,
    chineseCurrent,
  )
  for (const locale of ['en', 'zh'] as const) {
    const artifact = locale === 'en' ? english : chinese
    const expected = new Map(assigned[locale].map(pack => [
      pack.concept.id,
      pack.learningContractVersion,
    ]))
    for (const pack of locale === 'en' ? englishCurrent : chineseCurrent) {
      const expectedVersion = expected.get(pack.concept.id)
      if (pack.learningContractVersion !== expectedVersion) {
        throw new Error(
          `${locale} current Learning Contract Version differs for ${pack.concept.id}`,
        )
      }
    }

    const contractSets = new Map<string, Set<string>>()
    for (const pack of artifact.packs) {
      const contracts = contractSets.get(pack.concept.id) ?? new Set<string>()
      contracts.add(pack.learningContractVersion)
      contractSets.set(pack.concept.id, contracts)
    }
    const counterpart = locale === 'en' ? chinese : english
    for (const [conceptId, contracts] of contractSets) {
      const counterpartContracts = new Set(counterpart.packs
        .filter(pack => pack.concept.id === conceptId)
        .map(pack => pack.learningContractVersion))
      for (const contract of contracts) {
        if (!counterpartContracts.has(contract)) {
          throw new Error(
            `Bilingual Learning Contract ${conceptId}@${contract} is missing from `
            + `${counterpart.locale}`,
          )
        }
      }
    }
  }
}

function assertRepositoryReviewedArtifactEnvelope(
  artifact: GeneratedContentPackArtifact,
  manifestInput: unknown,
  reviewDeclarationInput: unknown,
  receiptInput: unknown,
  historyInput: unknown,
  expectedCompilerInput?: unknown,
): ContentPackPublicationHistoryEntry {
  const manifest = generatedContentPackManifestSchema.parse(manifestInput)
  const reviewDeclaration = contentPackRepositoryReviewDeclarationSchema.parse(
    reviewDeclarationInput,
  )
  const receipt = expectedCompilerInput === undefined
    ? contentPackValidationReceiptSchema.parse(receiptInput)
    : assertCurrentContentPackValidationReceipt(
        receiptInput,
        expectedCompilerInput,
      )
  const history = contentPackPublicationHistorySchema.parse(historyInput)
  const digest = contentPackArtifactSha256(artifact)
  const manifestEntry = manifest.locales[artifact.locale]
  const receiptDigest = contentPackValidationReceiptSha256(receipt)
  const manifestDigest = contentPackManifestSha256(manifest)
  const reviewDeclarationDigest
    = contentPackRepositoryReviewDeclarationSha256(reviewDeclaration)
  const historyHead = history.entries.at(-1)
  if (!historyHead)
    throw new Error('Content Pack publication history has no repository-reviewed entry')

  if (manifestEntry.artifactSha256 !== digest) {
    throw new Error(
      `${artifact.locale} Content Pack artifact does not match its generated manifest`,
    )
  }
  if (reviewDeclaration.artifacts[artifact.locale] !== digest) {
    throw new Error(
      `${artifact.locale} Content Pack artifact has no matching repository review declaration`,
    )
  }
  if (receipt.artifacts[artifact.locale] !== digest) {
    throw new Error(
      `${artifact.locale} Content Pack artifact is absent from its validation receipt`,
    )
  }
  if (reviewDeclaration.validationReceiptSha256 !== receiptDigest) {
    throw new Error(
      `${artifact.locale} Content Pack review declaration does not match the validation receipt`,
    )
  }
  if (reviewDeclaration.manifestSha256 !== manifestDigest) {
    throw new Error('Content Pack review declaration does not match the manifest')
  }
  if (
    canonicalJson(historyHead.artifacts)
    !== canonicalJson(reviewDeclaration.artifacts)
    || canonicalJson(historyHead.artifacts)
    !== canonicalJson(receipt.artifacts)
  ) {
    throw new Error(
      'Content Pack artifact digests disagree across history, review declaration, and receipt',
    )
  }
  if (
    manifest.locales.en.artifactSha256 !== historyHead.artifacts.en
    || manifest.locales.zh.artifactSha256 !== historyHead.artifacts.zh
  ) {
    throw new Error(
      'Content Pack artifact digests disagree between manifest and publication history',
    )
  }
  if (historyHead.artifacts[artifact.locale] !== digest) {
    throw new Error(
      `${artifact.locale} Content Pack artifact does not match publication history`,
    )
  }
  if (
    historyHead.previousEntrySha256
    !== reviewDeclaration.previousHistoryEntrySha256
  ) {
    throw new Error(
      'Content Pack review declaration does not extend the recorded history head',
    )
  }
  if (historyHead.manifestSha256 !== manifestDigest) {
    throw new Error('Content Pack manifest does not match publication history')
  }
  if (historyHead.validationReceiptSha256 !== receiptDigest) {
    throw new Error(
      'Content Pack validation receipt does not match publication history',
    )
  }
  if (
    historyHead.reviewDeclarationSha256
    !== reviewDeclarationDigest
  ) {
    throw new Error(
      'Content Pack review declaration does not match publication history',
    )
  }
  if (
    canonicalJson(manifestEntry.currentVersions)
    !== canonicalJson(artifact.currentVersions)
  ) {
    throw new Error(
      `${artifact.locale} Content Pack current versions do not match the reviewed artifact`,
    )
  }
  return historyHead
}

export function projectIntegrityCheckedRepositoryArtifact(
  artifactInput: unknown,
  manifestInput: unknown,
  reviewDeclarationInput: unknown,
  receiptInput: unknown,
  historyInput: unknown,
  expectedCompilerInput: unknown,
): ContentPacksResponse {
  const artifact = generatedContentPackArtifactSchema.parse(artifactInput)
  assertRepositoryReviewedArtifactEnvelope(
    artifact,
    manifestInput,
    reviewDeclarationInput,
    receiptInput,
    historyInput,
    expectedCompilerInput,
  )
  return contentPacksResponseSchema.parse({
    currentVersions: artifact.currentVersions,
    packs: artifact.packs.map(pack => ({
      ...pack,
      review: {
        status: 'pending' as const,
      },
    })),
  })
}

/**
 * Verify an immutable publication snapshot without claiming that its compiler
 * is the repository's current lock. This is intentionally limited to history
 * readers; current/head/runtime publication must use
 * projectIntegrityCheckedRepositoryArtifact instead.
 */
export function projectIntegrityCheckedHistoricalRepositoryArtifact(
  artifactInput: unknown,
  manifestInput: unknown,
  reviewDeclarationInput: unknown,
  receiptInput: unknown,
  historyInput: unknown,
): ContentPacksResponse {
  const artifact = generatedContentPackArtifactSchema.parse(artifactInput)
  assertRepositoryReviewedArtifactEnvelope(
    artifact,
    manifestInput,
    reviewDeclarationInput,
    receiptInput,
    historyInput,
  )
  return contentPacksResponseSchema.parse({
    currentVersions: artifact.currentVersions,
    packs: artifact.packs.map(pack => ({
      ...pack,
      review: {
        status: 'pending' as const,
      },
    })),
  })
}

export function publishExternallyAttestedArtifact(
  artifactInput: unknown,
  manifestInput: unknown,
  reviewDeclarationInput: unknown,
  receiptInput: unknown,
  historyInput: unknown,
  attestationInput: unknown,
  trustedReviewKeys: Readonly<Record<string, string>>,
  expectedCompilerInput: unknown,
): ContentPacksResponse {
  const artifact = generatedContentPackArtifactSchema.parse(artifactInput)
  const manifest = generatedContentPackManifestSchema.parse(manifestInput)
  const receipt = assertCurrentContentPackValidationReceipt(
    receiptInput,
    expectedCompilerInput,
  )
  const attestation = contentPackExternalReviewAttestationSchema.parse(
    attestationInput,
  )
  const historyHead = assertRepositoryReviewedArtifactEnvelope(
    artifact,
    manifest,
    reviewDeclarationInput,
    receipt,
    historyInput,
    expectedCompilerInput,
  )
  const trustedKey = Object.hasOwn(trustedReviewKeys, attestation.keyId)
    ? trustedReviewKeys[attestation.keyId]
    : undefined
  if (typeof trustedKey !== 'string' || trustedKey.trim().length === 0) {
    throw new Error(
      `Missing trusted external review key ${attestation.keyId}`,
    )
  }
  let publicKey: ReturnType<typeof createPublicKey>
  try {
    publicKey = createPublicKey(trustedKey)
  }
  catch (error) {
    throw new Error(
      `Invalid trusted external review key ${attestation.keyId}`,
      { cause: error },
    )
  }
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(
      `Trusted external review key ${attestation.keyId} is not Ed25519`,
    )
  }
  const {
    signature,
    ...unsignedAttestation
  } = attestation
  const signatureBytes = Buffer.from(signature, 'base64')
  if (
    signatureBytes.toString('base64') !== signature
    || !verifySignature(
      null,
      Buffer.from(
        contentPackExternalReviewAttestationSigningPayload(
          unsignedAttestation,
        ),
        'utf8',
      ),
      publicKey,
      signatureBytes,
    )
  ) {
    throw new Error('External Content Pack review attestation signature is invalid')
  }

  const expectedSubject = {
    publicationEntrySha256: historyHead.entrySha256,
    manifestSha256: contentPackManifestSha256(manifest),
    validationReceiptSha256: contentPackValidationReceiptSha256(receipt),
    artifacts: {
      en: manifest.locales.en.artifactSha256,
      zh: manifest.locales.zh.artifactSha256,
    },
  }
  const {
    approvedPacks,
    ...signedPublicationSubject
  } = attestation.subject
  if (canonicalJson(signedPublicationSubject) !== canonicalJson(expectedSubject)) {
    throw new Error(
      'External Content Pack review attestation does not match the publication',
    )
  }

  const approvedIdentities = new Set<string>()
  for (const approved of approvedPacks) {
    if (approved.locale !== artifact.locale)
      continue
    const pack = artifact.packs.find(candidate =>
      candidate.concept.id === approved.conceptId
      && candidate.version === approved.contentVersion)
    if (!pack) {
      throw new Error(
        `Externally approved Content Pack is absent: `
        + `${approved.conceptId}@${approved.contentVersion}`,
      )
    }
    const runnableSamples = pack.blocks.flatMap(block =>
      block.type === 'code_sample' && block.sampleType === 'program'
        ? [block]
        : [])
    if (runnableSamples.length === 0) {
      throw new Error(
        `External review cannot approve ${approved.conceptId} without `
        + 'a runnable program code sample',
      )
    }
    for (const block of runnableSamples) {
      const evidence = receipt.codeSamples.find(sample =>
        sample.locale === artifact.locale
        && sample.conceptId === pack.concept.id
        && sample.contentVersion === pack.version
        && sample.blockId === block.id)
      if (
        !evidence
        || evidence.sourceSha256
        !== contentPackCodeSampleSourceSha256(block.code)
      ) {
        throw new Error(
          `Missing code sample receipt evidence for `
          + `${artifact.locale}/${pack.concept.id}/${block.id}`,
        )
      }
    }
    approvedIdentities.add(
      `${approved.conceptId}\0${approved.contentVersion}`,
    )
  }
  const attestationDigest = sha256Canonical(unsignedAttestation)
  return contentPacksResponseSchema.parse({
    currentVersions: artifact.currentVersions,
    packs: artifact.packs.map((pack) => {
      const approved = approvedIdentities.has(
        `${pack.concept.id}\0${pack.version}`,
      )
      return {
        ...pack,
        review: approved
          ? {
              status: 'approved' as const,
              reviewedBy:
                `external-review-attestation:${attestation.keyId}:${
                  attestationDigest}`,
            }
          : { status: 'pending' as const },
      }
    }),
  })
}
