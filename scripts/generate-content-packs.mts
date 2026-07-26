import { Buffer } from 'node:buffer'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import {
  assertBilingualLearningContractArtifacts,
  contentPackArtifactSha256,
  formatGeneratedJson,
  mergeGeneratedContentPackArtifact,
} from '../src/lib/teach/classroom/content-pack-artifact'
import type {
  ContentPackValidationReceipt,
  GeneratedContentPackArtifact,
  GeneratedContentPackManifest,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  buildCurrentCourseContentPacks,
  verifyContentPackExecutables,
} from '../src/lib/teach/classroom/content-pack-generation'
import {
  readVerifiedPublicationHistory,
} from './content-pack-verification.mts'

const root = resolve(process.cwd())
const generatedDirectory = join(
  root,
  'src',
  'lib',
  'teach',
  'classroom',
  'generated',
  'content-packs',
)

async function main(): Promise<void> {
  const publicationHistoryPath = join(
    generatedDirectory,
    'publication-history.json',
  )
  const hasPublicationHistory = existsSync(publicationHistoryPath)
  if (
    !hasPublicationHistory
    && (
      existsSync(join(generatedDirectory, 'history'))
      || existsSync(join(
        generatedDirectory,
        'repository-review-declaration.json',
      ))
    )
  ) {
    throw new Error(
      'Incomplete Content Pack publication metadata cannot be used as genesis',
    )
  }
  const publicationHistory = hasPublicationHistory
    ? readVerifiedPublicationHistory(generatedDirectory, {
        allowLegacyHeadForMigration: true,
      })
    : undefined
  const historicalHead = publicationHistory?.snapshots.at(-1)
  if (hasPublicationHistory && !historicalHead)
    throw new Error('Content Pack publication history is empty')
  const currentPacks = {
    en: await buildCurrentCourseContentPacks('en'),
    zh: await buildCurrentCourseContentPacks('zh'),
  }
  const artifacts = {} as Record<'zh' | 'en', GeneratedContentPackArtifact>
  const manifest: GeneratedContentPackManifest = {
    schemaVersion: 1,
    locales: {
      en: { artifactSha256: '', currentVersions: {} },
      zh: { artifactSha256: '', currentVersions: {} },
    },
  }

  for (const locale of ['en', 'zh'] as const) {
    const { artifact, currentVersions } = mergeGeneratedContentPackArtifact(
      locale,
      currentPacks[locale],
      historicalHead?.artifacts[locale],
    )
    artifacts[locale] = artifact
    manifest.locales[locale] = {
      artifactSha256: contentPackArtifactSha256(artifact),
      currentVersions,
    }
  }
  assertBilingualLearningContractArtifacts(artifacts.en, artifacts.zh)
  const verification = verifyContentPackExecutables(
    {
      en: artifacts.en.packs,
      zh: artifacts.zh.packs,
    },
  )

  mkdirSync(generatedDirectory, { recursive: true })
  for (const locale of ['en', 'zh'] as const) {
    writeFileSync(
      join(generatedDirectory, `${locale}.json`),
      formatGeneratedJson(artifacts[locale]),
      'utf8',
    )
  }
  writeFileSync(
    join(generatedDirectory, 'manifest.json'),
    formatGeneratedJson(manifest),
    'utf8',
  )
  const receipt: ContentPackValidationReceipt = {
    schemaVersion: 5,
    validationProtocol: 'cjc-content-pack-executables-v3',
    compiler: verification.compiler,
    templates: verification.verifiedTemplates,
    codeSamples: verification.verifiedCodeSamples,
    artifacts: {
      en: manifest.locales.en.artifactSha256,
      zh: manifest.locales.zh.artifactSha256,
    },
  }
  writeFileSync(
    join(generatedDirectory, 'validation-receipt.json'),
    formatGeneratedJson(receipt),
    'utf8',
  )

  for (const locale of ['en', 'zh'] as const) {
    const bytes = Buffer.byteLength(formatGeneratedJson(artifacts[locale]))
    console.log(
      `${locale}: ${artifacts[locale].packs.length} packs, ${bytes} bytes, `
      + `${manifest.locales[locale].artifactSha256}`,
    )
  }
  console.log(
    `Verified ${verification.verifiedTemplates.length} reference/starter pairs `
    + `and ${verification.verifiedCodeSamples.length} runnable code samples `
    + `with cjc ${verification.compiler.version} `
    + `(${verification.compiler.backend}).`,
  )
}

void main()
