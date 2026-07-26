import type {
  ContentPackLanguage,
  ContentPacksResponse,
} from './content-packs'
import toolchainLock from '../../../../cj-runner/cangjie-toolchain.lock.json'
import enArtifact from './generated/content-packs/en.json'
import manifest from './generated/content-packs/manifest.json'
import publicationHistory from './generated/content-packs/publication-history.json'
import reviewDeclaration from './generated/content-packs/repository-review-declaration.json'
import validationReceipt from './generated/content-packs/validation-receipt.json'
import zhArtifact from './generated/content-packs/zh.json'
import {
  assertBilingualLearningContractArtifacts,
  projectIntegrityCheckedRepositoryArtifact,
  publishExternallyAttestedArtifact,
} from './content-pack-artifact'
import { lockedCangjieCompilerIdentity } from './cangjie-toolchain'

assertBilingualLearningContractArtifacts(enArtifact, zhArtifact)
const expectedCompiler = lockedCangjieCompilerIdentity(toolchainLock)
export interface ExternalContentPackReviewConfiguration {
  attestationJson?: string
  trustedReviewKeysJson?: string
}

function parseExternalReviewConfiguration(
  configuration: ExternalContentPackReviewConfiguration,
): {
  attestation: unknown
  trustedReviewKeys: Record<string, string>
} | undefined {
  const hasAttestation = configuration.attestationJson !== undefined
  const hasTrustedKeys = configuration.trustedReviewKeysJson !== undefined
  if (!hasAttestation && !hasTrustedKeys)
    return undefined
  if (!hasAttestation || !hasTrustedKeys) {
    throw new Error(
      'External Content Pack review requires both attestation and trusted keys',
    )
  }

  let attestation: unknown
  let parsedKeys: unknown
  try {
    attestation = JSON.parse(configuration.attestationJson!)
    parsedKeys = JSON.parse(configuration.trustedReviewKeysJson!)
  }
  catch (error) {
    throw new Error('External Content Pack review configuration is invalid JSON', {
      cause: error,
    })
  }
  if (
    parsedKeys === null
    || typeof parsedKeys !== 'object'
    || Array.isArray(parsedKeys)
  ) {
    throw new Error('External Content Pack trusted keys must be a JSON object')
  }
  const trustedReviewKeys: Record<string, string> = {}
  for (const [keyId, value] of Object.entries(parsedKeys)) {
    if (
      !/^[\w.-]{1,64}$/.test(keyId)
      || typeof value !== 'string'
      || value.trim().length === 0
    ) {
      throw new Error(
        'External Content Pack trusted keys require valid key IDs and PEM strings',
      )
    }
    trustedReviewKeys[keyId] = value
  }
  return { attestation, trustedReviewKeys }
}

export function loadConfiguredCourseContentPacks(
  lang: ContentPackLanguage,
  configuration: ExternalContentPackReviewConfiguration,
): ContentPacksResponse {
  const configuredReview = parseExternalReviewConfiguration(configuration)
  const artifact = lang === 'en' ? enArtifact : zhArtifact
  if (!configuredReview) {
    return projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      validationReceipt,
      publicationHistory,
      expectedCompiler,
    )
  }
  return publishExternallyAttestedArtifact(
    artifact,
    manifest,
    reviewDeclaration,
    validationReceipt,
    publicationHistory,
    configuredReview.attestation,
    configuredReview.trustedReviewKeys,
    expectedCompiler,
  )
}

const externalReviewConfiguration: ExternalContentPackReviewConfiguration = {
  attestationJson:
    process.env.CONTENT_PACK_EXTERNAL_REVIEW_ATTESTATION_JSON,
  trustedReviewKeysJson:
    process.env.CONTENT_PACK_TRUSTED_EXTERNAL_REVIEW_KEYS_JSON,
}
const publishedArtifacts: Record<ContentPackLanguage, ContentPacksResponse> = {
  en: loadConfiguredCourseContentPacks('en', externalReviewConfiguration),
  zh: loadConfiguredCourseContentPacks('zh', externalReviewConfiguration),
}

/**
 * Serve checked-in artifacts only after their integrity log and reproducibility
 * receipt agree. Repository-local declarations remain pending. Approval is
 * possible only when deployment supplies both an external Ed25519 attestation
 * and its independently trusted public key. Tour extraction, conversion,
 * versioning, and cjc execution remain offline.
 */
export async function loadCourseContentPacks(
  lang: ContentPackLanguage,
): Promise<ContentPacksResponse> {
  return structuredClone(publishedArtifacts[lang])
}
