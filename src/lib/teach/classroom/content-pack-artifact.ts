import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { CourseContentPack } from './content-packs'
import {
  contentPackIdSchema,
  contentVersionSchema,
  courseContentPackSchema,
} from './content-packs'
import {
  assignBilingualLearningContractVersions,
  assignImmutableContentVersion,
  sha256Canonical,
} from './content-pack-version'

const currentVersionsSchema = z.record(
  contentPackIdSchema,
  contentVersionSchema,
)

/**
 * The generated course module contains only the current Git-tracked curriculum.
 * Git history owns prior revisions; the application does not carry a second
 * publication log, validation receipt, or compatibility archive.
 */
export const generatedContentPackArtifactSchema = z.object({
  schemaVersion: z.literal(3),
  locale: z.enum(['zh', 'en']),
  packs: z.array(courseContentPackSchema).min(1),
  currentVersions: currentVersionsSchema,
}).strict().superRefine((artifact, ctx) => {
  if (artifact.packs.length !== Object.keys(artifact.currentVersions).length) {
    ctx.addIssue({
      code: 'custom',
      path: ['packs'],
      message: 'generated course must contain exactly one current pack per Concept',
    })
  }
  const concepts = new Set<string>()
  for (const [index, pack] of artifact.packs.entries()) {
    if (concepts.has(pack.concept.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index],
        message: `duplicate current Concept ${pack.concept.id}`,
      })
    }
    concepts.add(pack.concept.id)
    if (artifact.currentVersions[pack.concept.id] !== pack.version) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentVersions', pack.concept.id],
        message: `current Content Version does not match ${pack.concept.id}`,
      })
    }
    if (assignImmutableContentVersion(pack, artifact.locale).version !== pack.version) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index, 'version'],
        message: `Content Version does not match ${artifact.locale} pack content`,
      })
    }
  }
})

export type GeneratedContentPackArtifact
  = z.infer<typeof generatedContentPackArtifactSchema>

export function createGeneratedContentPackArtifact(
  locale: 'zh' | 'en',
  packs: CourseContentPack[],
): GeneratedContentPackArtifact {
  return generatedContentPackArtifactSchema.parse({
    schemaVersion: 3,
    locale,
    packs,
    currentVersions: Object.fromEntries(packs.map(pack => [
      pack.concept.id,
      pack.version,
    ])),
  })
}

export function assertBilingualLearningContractArtifacts(
  englishInput: unknown,
  chineseInput: unknown,
): void {
  const english = generatedContentPackArtifactSchema.parse(englishInput)
  const chinese = generatedContentPackArtifactSchema.parse(chineseInput)
  if (english.locale !== 'en' || chinese.locale !== 'zh')
    throw new Error('Bilingual Learning Contract validation requires en and zh artifacts')

  const assigned = assignBilingualLearningContractVersions(
    english.packs,
    chinese.packs,
  )
  for (const locale of ['en', 'zh'] as const) {
    const actual = locale === 'en' ? english.packs : chinese.packs
    const expected = new Map(assigned[locale].map(pack => [
      pack.concept.id,
      pack.learningContractVersion,
    ]))
    for (const pack of actual) {
      if (pack.learningContractVersion !== expected.get(pack.concept.id)) {
        throw new Error(
          `${locale} current Learning Contract Version differs for ${pack.concept.id}`,
        )
      }
    }
  }
}

export function formatGeneratedJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function contentPackArtifactSha256(
  artifact: GeneratedContentPackArtifact,
): string {
  return createHash('sha256')
    .update(formatGeneratedJson(generatedContentPackArtifactSchema.parse(artifact)))
    .digest('hex')
}

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

export interface ContentPackCodeSampleValidation {
  locale: 'en' | 'zh'
  conceptId: string
  contentVersion: string
  blockId: string
  sourceSha256: string
  normalizedStdoutSha256: string
  validationResultSha256: string
}
