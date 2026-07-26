import { Buffer } from 'node:buffer'
import {
  generateKeyPairSync,
  sign,
} from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { CourseContentPack } from './content-packs'
import {
  assertBilingualLearningContractArtifacts,
  assertRetainsPublishedArtifact,
  contentPackArtifactSha256,
  contentPackCodeSampleOutputSha256,
  contentPackCodeSampleSourceSha256,
  contentPackCodeSampleValidationResultSha256,
  contentPackExternalReviewAttestationSigningPayload,
  contentPackHistoryEntrySha256,
  contentPackManifestSha256,
  contentPackPublicationHistorySchema,
  contentPackRepositoryReviewDeclarationSchema,
  contentPackRepositoryReviewDeclarationSha256,
  contentPackValidationReceiptSchema,
  contentPackValidationReceiptSha256,
  mergeGeneratedContentPackArtifact,
  projectIntegrityCheckedRepositoryArtifact,
  publishExternallyAttestedArtifact,
} from './content-pack-artifact'
import type { GeneratedContentPackArtifact } from './content-pack-artifact'
import {
  assignBilingualLearningContractVersions,
  assignImmutableContentVersion,
} from './content-pack-version'

function pendingPack(
  markdown = 'Immutable content.',
): CourseContentPack {
  const unversioned: CourseContentPack = {
    id: 'pack:concept:test',
    version: `cv:sha256:${'0'.repeat(64)}`,
    learningContractVersion: `lc:sha256:${'0'.repeat(64)}`,
    concept: {
      id: 'concept:test',
      title: 'Test',
      summary: 'Test.',
      prerequisites: [],
    },
    blocks: [
      {
        id: 'block:test',
        type: 'prose',
        markdown,
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '01-test/01-test/01',
          title: 'Test',
        }],
      },
      {
        id: 'block:test:program',
        type: 'code_sample',
        code: 'main() {\n    println("ok")\n}',
        language: 'cangjie',
        sampleType: 'program',
        sourceReferences: [{
          sourceId: 'static-tour',
          ref: '01-test/01-test/01',
          title: 'Test',
        }],
      },
    ],
    learningSkills: [],
    exerciseTemplates: [],
    review: { status: 'pending' },
  }
  const assigned = assignBilingualLearningContractVersions(
    [unversioned],
    [structuredClone(unversioned)],
  ).en[0]
  return assignImmutableContentVersion(assigned, 'en')
}

function publicationInputs(
  artifact: GeneratedContentPackArtifact,
  includeCodeSamples = true,
) {
  const digest = contentPackArtifactSha256(artifact)
  const manifest = {
    schemaVersion: 1 as const,
    locales: {
      en: {
        artifactSha256: digest,
        currentVersions: artifact.currentVersions,
      },
      zh: { artifactSha256: '0'.repeat(64), currentVersions: {} },
    },
  }
  const receipt = {
    schemaVersion: 5 as const,
    validationProtocol: 'cjc-content-pack-executables-v3' as const,
    compiler: {
      name: 'cjc' as const,
      version: '1.0.5',
      backend: 'cjnative' as const,
      target: 'x86_64-unknown-linux-gnu' as const,
      toolchain: {
        release: '1.0.5',
        sdkArchiveSha256: '1'.repeat(64),
        compilerExecutableSha256: '2'.repeat(64),
        lockFileSha256: '3'.repeat(64),
      },
    },
    templates: [{
      templateId: 'template:test',
      validationInputSha256: 'a'.repeat(64),
      validationResultSha256: 'b'.repeat(64),
    }],
    codeSamples: includeCodeSamples
      ? artifact.packs.flatMap(pack =>
          pack.blocks.flatMap(block => block.type === 'code_sample'
            && block.sampleType === 'program'
            ? [{
                locale: artifact.locale,
                conceptId: pack.concept.id,
                contentVersion: pack.version,
                blockId: block.id,
                sourceSha256: contentPackCodeSampleSourceSha256(block.code),
                normalizedStdoutSha256: contentPackCodeSampleOutputSha256('ok'),
                validationResultSha256:
              contentPackCodeSampleValidationResultSha256(
                contentPackCodeSampleSourceSha256(block.code),
                contentPackCodeSampleOutputSha256('ok'),
              ),
              }]
            : []))
      : [],
    artifacts: {
      en: digest,
      zh: '0'.repeat(64),
    },
  }
  const receiptDigest = contentPackValidationReceiptSha256(receipt)
  const reviewDeclaration = {
    schemaVersion: 3 as const,
    generator: {
      command: 'pnpm content-packs:generate' as const,
    },
    declaration: {
      kind: 'repository-review-declaration' as const,
      reviewerLabel: 'codex-agent:artifact-adversarial-review',
      declaredAt: '2026-07-26',
      scope: 'artifact-diff-and-validation-chain' as const,
      trustModel: 'repository-code-review' as const,
      provenance: 'self-asserted-repository-metadata' as const,
      externalTrustAnchor: false as const,
    },
    previousHistoryEntrySha256: null,
    manifestSha256: contentPackManifestSha256(manifest),
    validationReceiptSha256: receiptDigest,
    artifacts: receipt.artifacts,
  }
  const entryCore = {
    sequence: 1,
    previousEntrySha256: null,
    snapshotDirectory: '0001',
    artifacts: receipt.artifacts,
    manifestSha256: contentPackManifestSha256(manifest),
    validationReceiptSha256: receiptDigest,
    reviewDeclarationSha256:
      contentPackRepositoryReviewDeclarationSha256(reviewDeclaration),
  }
  const history = {
    schemaVersion: 1 as const,
    entries: [{
      ...entryCore,
      entrySha256: contentPackHistoryEntrySha256(entryCore),
    }],
  }
  return { history, manifest, receipt, reviewDeclaration }
}

function publishForTest(artifact: GeneratedContentPackArtifact) {
  const {
    reviewDeclaration,
    history,
    manifest,
    receipt,
  } = publicationInputs(artifact)
  return projectIntegrityCheckedRepositoryArtifact(
    artifact,
    manifest,
    reviewDeclaration,
    receipt,
    history,
    receipt.compiler,
  )
}

describe('generated Content Pack repository review declaration', () => {
  it('requires current bilingual artifacts to share the canonical contract', () => {
    const englishPack = pendingPack()
    const chinesePack = assignImmutableContentVersion(
      structuredClone(englishPack),
      'zh',
    )
    const english = mergeGeneratedContentPackArtifact(
      'en',
      [englishPack],
    ).artifact
    const chinese = mergeGeneratedContentPackArtifact(
      'zh',
      [chinesePack],
    ).artifact

    expect(() => assertBilingualLearningContractArtifacts(
      english,
      chinese,
    )).not.toThrow()

    const forgedContractPack = assignImmutableContentVersion({
      ...chinesePack,
      version: `cv:sha256:${'0'.repeat(64)}`,
      learningContractVersion: `lc:sha256:${'f'.repeat(64)}`,
      exerciseTemplates: chinesePack.exerciseTemplates.map(template => ({
        ...template,
        version: `cv:sha256:${'0'.repeat(64)}`,
      })),
    }, 'zh')
    const forgedChinese = mergeGeneratedContentPackArtifact(
      'zh',
      [forgedContractPack],
    ).artifact
    expect(() => assertBilingualLearningContractArtifacts(
      english,
      forgedChinese,
    )).toThrow(/Learning Contract/)
  })

  it('models repository review as an unanchored declaration, not external approval', () => {
    expect(contentPackRepositoryReviewDeclarationSchema).toBeDefined()
    expect(() => contentPackRepositoryReviewDeclarationSchema.parse({
      schemaVersion: 3,
      generator: {
        command: 'pnpm content-packs:generate',
      },
      declaration: {
        kind: 'repository-review-declaration',
        reviewerLabel: 'repository reviewer',
        declaredAt: '2026-07-26',
        scope: 'artifact-diff-and-validation-chain',
        trustModel: 'repository-code-review',
        provenance: 'self-asserted-repository-metadata',
        externalTrustAnchor: true,
      },
      previousHistoryEntrySha256: null,
      manifestSha256: '0'.repeat(64),
      validationReceiptSha256: '1'.repeat(64),
      artifacts: {
        en: '2'.repeat(64),
        zh: '3'.repeat(64),
      },
    })).toThrow()
  })

  it('retains old versions while an explicit manifest selects current', () => {
    const oldPack = pendingPack('Old content.')
    const oldArtifact = mergeGeneratedContentPackArtifact(
      'en',
      [oldPack],
    ).artifact
    const currentPack = pendingPack('Current content.')
    const merged = mergeGeneratedContentPackArtifact(
      'en',
      [currentPack],
      oldArtifact,
    )

    expect(merged.currentVersions).toEqual({
      'concept:test': currentPack.version,
    })
    expect(merged.artifact.packs).toEqual([currentPack, oldPack])
    const historicalAfterPublish = publishForTest(merged.artifact)
      .packs
      .find(pack => pack.version === oldPack.version)
    const originalPublication = publishForTest(oldArtifact).packs[0]
    expect({
      ...historicalAfterPublish,
      review: undefined,
    }).toEqual({
      ...originalPublication,
      review: undefined,
    })
    expect(historicalAfterPublish?.review.status).toBe('pending')
  })

  it('integrity-checks self-asserted metadata without granting approval', () => {
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack()],
    )
    const {
      history,
      manifest,
      receipt,
      reviewDeclaration,
    } = publicationInputs(artifact)

    expect(projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      receipt,
      history,
      receipt.compiler,
    ).packs[0].review).toEqual({
      status: 'pending',
    })
    expect(() => projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      {
        ...reviewDeclaration,
        artifacts: {
          ...reviewDeclaration.artifacts,
          en: 'f'.repeat(64),
        },
      },
      receipt,
      history,
      receipt.compiler,
    )).toThrow(/no matching repository review declaration/)
    const staleManifest = {
      ...manifest,
      locales: {
        ...manifest.locales,
        en: {
          ...manifest.locales.en,
          currentVersions: {
            'concept:test': `cv:sha256:${'9'.repeat(64)}`,
          },
        },
      },
    }
    const staleReviewDeclaration = {
      ...reviewDeclaration,
      manifestSha256: contentPackManifestSha256(staleManifest),
    }
    const staleEntryCore = {
      ...history.entries[0],
      manifestSha256: staleReviewDeclaration.manifestSha256,
      reviewDeclarationSha256:
        contentPackRepositoryReviewDeclarationSha256(staleReviewDeclaration),
    }
    const staleHistory = {
      ...history,
      entries: [{
        ...staleEntryCore,
        entrySha256: contentPackHistoryEntrySha256(staleEntryCore),
      }],
    }
    expect(() => projectIntegrityCheckedRepositoryArtifact(
      artifact,
      staleManifest,
      staleReviewDeclaration,
      receipt,
      staleHistory,
      receipt.compiler,
    )).toThrow(/current versions do not match the reviewed artifact/)
    expect(() => projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      {
        ...receipt,
        compiler: {
          ...receipt.compiler,
          version: '9.9.9',
        },
      },
      history,
      receipt.compiler,
    )).toThrow(/locked Cangjie toolchain/)
    expect(() => projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      {
        ...receipt,
        artifacts: {
          ...receipt.artifacts,
          en: 'e'.repeat(64),
        },
      },
      history,
      receipt.compiler,
    )).toThrow(/artifact digests disagree|validation receipt/)
  })

  it('grants approval only through a trusted external Ed25519 attestation', () => {
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack()],
    )
    const {
      history,
      manifest,
      receipt,
      reviewDeclaration,
    } = publicationInputs(artifact)
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const unsignedAttestation = {
      schemaVersion: 1 as const,
      kind: 'external-content-pack-review-attestation' as const,
      algorithm: 'Ed25519' as const,
      keyId: 'curriculum-review-key',
      issuedAt: '2026-07-26T00:00:00Z',
      subject: {
        publicationEntrySha256: history.entries[0].entrySha256,
        manifestSha256: contentPackManifestSha256(manifest),
        validationReceiptSha256:
          contentPackValidationReceiptSha256(receipt),
        artifacts: receipt.artifacts,
        approvedPacks: [{
          locale: 'en' as const,
          conceptId: artifact.packs[0].concept.id,
          contentVersion: artifact.packs[0].version,
        }],
      },
    }
    const attestation = {
      ...unsignedAttestation,
      signature: sign(
        null,
        Buffer.from(
          contentPackExternalReviewAttestationSigningPayload(
            unsignedAttestation,
          ),
          'utf8',
        ),
        privateKey,
      ).toString('base64'),
    }
    const trustedKeys = {
      'curriculum-review-key': publicKey.export({
        type: 'spki',
        format: 'pem',
      }).toString(),
    }

    expect(publishExternallyAttestedArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      receipt,
      history,
      attestation,
      trustedKeys,
      receipt.compiler,
    ).packs[0].review).toEqual({
      status: 'approved',
      reviewedBy: expect.stringMatching(
        /^external-review-attestation:curriculum-review-key:[a-f0-9]{64}$/,
      ),
    })
    expect(() => publishExternallyAttestedArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      receipt,
      history,
      attestation,
      {},
      receipt.compiler,
    )).toThrow(/trusted external review key/)
  })

  it('carries exact historical approvals forward without conflating Concept versions', () => {
    const versionOne = pendingPack('Version one content.')
    const historical = mergeGeneratedContentPackArtifact(
      'en',
      [versionOne],
    ).artifact
    const versionTwo = pendingPack('Version two content.')
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [versionTwo],
      historical,
    )
    const publication = publicationInputs(artifact)
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const unsignedAttestation = {
      schemaVersion: 1 as const,
      kind: 'external-content-pack-review-attestation' as const,
      algorithm: 'Ed25519' as const,
      keyId: 'curriculum-review-key',
      issuedAt: '2026-07-26T00:00:00Z',
      subject: {
        publicationEntrySha256: publication.history.entries[0].entrySha256,
        manifestSha256: contentPackManifestSha256(publication.manifest),
        validationReceiptSha256:
          contentPackValidationReceiptSha256(publication.receipt),
        artifacts: publication.receipt.artifacts,
        approvedPacks: artifact.packs.map(pack => ({
          locale: 'en' as const,
          conceptId: pack.concept.id,
          contentVersion: pack.version,
        })),
      },
    }
    const attestation = {
      ...unsignedAttestation,
      signature: sign(
        null,
        Buffer.from(
          contentPackExternalReviewAttestationSigningPayload(
            unsignedAttestation,
          ),
          'utf8',
        ),
        privateKey,
      ).toString('base64'),
    }
    const trustedKeys = {
      'curriculum-review-key': publicKey.export({
        type: 'spki',
        format: 'pem',
      }).toString(),
    }

    const published = publishExternallyAttestedArtifact(
      artifact,
      publication.manifest,
      publication.reviewDeclaration,
      publication.receipt,
      publication.history,
      attestation,
      trustedKeys,
      publication.receipt.compiler,
    )
    expect(published.packs).toHaveLength(2)
    expect(published.packs.every(pack =>
      pack.review.status === 'approved')).toBe(true)

    const currentOnlyUnsigned = {
      ...unsignedAttestation,
      subject: {
        ...unsignedAttestation.subject,
        approvedPacks: unsignedAttestation.subject.approvedPacks.filter(
          pack => pack.contentVersion === artifact.currentVersions[pack.conceptId],
        ),
      },
    }
    const currentOnly = publishExternallyAttestedArtifact(
      artifact,
      publication.manifest,
      publication.reviewDeclaration,
      publication.receipt,
      publication.history,
      {
        ...currentOnlyUnsigned,
        signature: sign(
          null,
          Buffer.from(
            contentPackExternalReviewAttestationSigningPayload(
              currentOnlyUnsigned,
            ),
            'utf8',
          ),
          privateKey,
        ).toString('base64'),
      },
      trustedKeys,
      publication.receipt.compiler,
    )
    expect(currentOnly.packs.find(pack =>
      pack.version === versionOne.version)?.review.status).toBe('pending')
    expect(currentOnly.packs.find(pack =>
      pack.version === versionTwo.version)?.review.status).toBe('approved')
  })

  it('rejects external approval when a runnable code sample lacks receipt evidence', () => {
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack()],
    )
    const publication = publicationInputs(artifact, false)
    const { receipt } = publication
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const unsignedAttestation = {
      schemaVersion: 1 as const,
      kind: 'external-content-pack-review-attestation' as const,
      algorithm: 'Ed25519' as const,
      keyId: 'curriculum-review-key',
      issuedAt: '2026-07-26T00:00:00Z',
      subject: {
        publicationEntrySha256: publication.history.entries[0].entrySha256,
        manifestSha256: contentPackManifestSha256(publication.manifest),
        validationReceiptSha256:
          contentPackValidationReceiptSha256(receipt),
        artifacts: receipt.artifacts,
        approvedPacks: [{
          locale: 'en' as const,
          conceptId: artifact.packs[0].concept.id,
          contentVersion: artifact.packs[0].version,
        }],
      },
    }
    const attestation = {
      ...unsignedAttestation,
      signature: sign(
        null,
        Buffer.from(
          contentPackExternalReviewAttestationSigningPayload(
            unsignedAttestation,
          ),
          'utf8',
        ),
        privateKey,
      ).toString('base64'),
    }

    expect(() => publishExternallyAttestedArtifact(
      artifact,
      publication.manifest,
      publication.reviewDeclaration,
      receipt,
      publication.history,
      attestation,
      {
        'curriculum-review-key': publicKey.export({
          type: 'spki',
          format: 'pem',
        }).toString(),
      },
      receipt.compiler,
    )).toThrow(/code sample receipt evidence/i)
  })

  it('rejects tampering with a receipt-bound validation-case hash', () => {
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack()],
    )
    const {
      history,
      manifest,
      receipt,
      reviewDeclaration,
    } = publicationInputs(artifact)

    expect(() => projectIntegrityCheckedRepositoryArtifact(
      artifact,
      manifest,
      reviewDeclaration,
      {
        ...receipt,
        templates: [{
          ...receipt.templates[0],
          validationInputSha256: 'f'.repeat(64),
        }],
      },
      history,
      receipt.compiler,
    )).toThrow(/review declaration does not match the validation receipt/)
  })

  it('rejects a code-sample result hash detached from its source and output', () => {
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack()],
    )
    const { receipt } = publicationInputs(artifact)

    expect(() => contentPackValidationReceiptSchema.parse({
      ...receipt,
      codeSamples: [{
        ...receipt.codeSamples[0],
        validationResultSha256: 'f'.repeat(64),
      }],
    })).toThrow(/result does not match its source and output/)
  })

  it('rejects a broken repository publication history digest', () => {
    const { artifact } = mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack()],
    )
    const { history } = publicationInputs(artifact)

    expect(() => contentPackPublicationHistorySchema.parse({
      ...history,
      entries: [{
        ...history.entries[0],
        entrySha256: 'f'.repeat(64),
      }],
    })).toThrow(/entry digest/)
  })

  it('rejects deletion from an integrity-checked publication snapshot', () => {
    const first = pendingPack('First immutable version.')
    const second = pendingPack('Second immutable version.')
    const historical = mergeGeneratedContentPackArtifact(
      'en',
      [first],
    ).artifact
    const candidate = mergeGeneratedContentPackArtifact(
      'en',
      [second],
    ).artifact

    expect(() => assertRetainsPublishedArtifact(
      candidate,
      historical,
    )).toThrow(/deleted published Content Pack/)
  })

  it('rejects payload mutation under an existing content-addressed version', () => {
    const current = pendingPack()
    const { artifact } = mergeGeneratedContentPackArtifact('en', [current])
    const mutated = {
      ...artifact,
      packs: [{
        ...current,
        blocks: [{
          ...current.blocks[0],
          markdown: 'Changed without a new Content Version.',
        }],
      }],
    }

    expect(() => mergeGeneratedContentPackArtifact(
      'en',
      [pendingPack('New current content.')],
      mutated,
    )).toThrow(/Content Version does not match/)
  })
})
