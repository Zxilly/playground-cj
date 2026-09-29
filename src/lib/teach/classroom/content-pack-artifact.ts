import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { CourseContentPack } from './content-packs'
import {
  courseContentPackSchema,
  courseVersionSchema,
  validateContentPack,
} from './content-packs'
import {
  assignBilingualLearningContractVersions,
  assignImmutableContentVersion,
  sha256Canonical,
} from './content-pack-version'
import { CURRENT_COURSE_CONCEPT_IDS } from './course-definition'

/**
 * The generated course module contains only the current Git-tracked curriculum.
 * Git history owns prior revisions; the application does not carry a second
 * publication log, validation receipt, or compatibility archive.
 */
export const generatedContentPackArtifactSchema = z.object({
  schemaVersion: z.literal(4),
  locale: z.enum(['zh', 'en']),
  courseVersion: courseVersionSchema,
  packs: z.array(courseContentPackSchema).min(1),
}).strict().superRefine((artifact, ctx) => {
  if (artifact.packs.length !== CURRENT_COURSE_CONCEPT_IDS.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['packs'],
      message: 'generated artifact does not contain the complete current Course',
    })
  }
  const concepts = new Set<string>()
  for (const [index, pack] of artifact.packs.entries()) {
    if (pack.concept.id !== CURRENT_COURSE_CONCEPT_IDS[index]) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index, 'concept', 'id'],
        message: 'generated artifact differs from the current Course order',
      })
    }
    if (concepts.has(pack.concept.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index],
        message: `duplicate current Concept ${pack.concept.id}`,
      })
    }
    const validation = validateContentPack(pack)
    if (validation.status !== 'ready') {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index],
        message: validation.status === 'invalid'
          ? `invalid Course module: ${validation.issues.join('; ')}`
          : 'Course module has no complete evidence loop',
      })
    }
    const unmet = pack.concept.prerequisites.filter(prerequisite =>
      !concepts.has(prerequisite))
    if (unmet.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs', index, 'concept', 'prerequisites'],
        message: `Course prerequisite graph is not buildable: ${unmet.join(', ')}`,
      })
    }
    concepts.add(pack.concept.id)
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

export function currentCourseVersion(
  packs: Readonly<Record<'en' | 'zh', readonly CourseContentPack[]>>,
): string {
  return `course:sha256:${sha256Canonical({
    protocol: 'bilingual-current-course-v1',
    en: packs.en.map(pack => ({
      conceptId: pack.concept.id,
      contentVersion: pack.version,
    })),
    zh: packs.zh.map(pack => ({
      conceptId: pack.concept.id,
      contentVersion: pack.version,
    })),
  })}`
}

export function createGeneratedContentPackArtifacts(
  packs: Readonly<Record<'en' | 'zh', CourseContentPack[]>>,
): Record<'en' | 'zh', GeneratedContentPackArtifact> {
  const courseVersion = currentCourseVersion(packs)
  return {
    en: generatedContentPackArtifactSchema.parse({
      schemaVersion: 4,
      locale: 'en',
      courseVersion,
      packs: packs.en,
    }),
    zh: generatedContentPackArtifactSchema.parse({
      schemaVersion: 4,
      locale: 'zh',
      courseVersion,
      packs: packs.zh,
    }),
  }
}

export function assertBilingualLearningContractArtifacts(
  englishInput: unknown,
  chineseInput: unknown,
): void {
  const english = generatedContentPackArtifactSchema.parse(englishInput)
  const chinese = generatedContentPackArtifactSchema.parse(chineseInput)
  if (english.locale !== 'en' || chinese.locale !== 'zh')
    throw new Error('Bilingual Learning Contract validation requires en and zh artifacts')
  const expectedCourseVersion = currentCourseVersion({
    en: english.packs,
    zh: chinese.packs,
  })
  if (
    english.courseVersion !== expectedCourseVersion
    || chinese.courseVersion !== expectedCourseVersion
  ) {
    throw new Error('Bilingual artifacts do not share their logical Course Version')
  }

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
