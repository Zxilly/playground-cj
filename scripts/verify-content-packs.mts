import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  assertBilingualLearningContractArtifacts,
  createGeneratedContentPackArtifact,
  formatGeneratedJson,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  buildCurrentCourseContentPacks,
  verifyContentPackExecutables,
} from '../src/lib/teach/classroom/content-pack-generation'

async function main(): Promise<void> {
  const artifacts = {
    en: createGeneratedContentPackArtifact(
      'en',
      await buildCurrentCourseContentPacks('en'),
    ),
    zh: createGeneratedContentPackArtifact(
      'zh',
      await buildCurrentCourseContentPacks('zh'),
    ),
  }
  assertBilingualLearningContractArtifacts(artifacts.en, artifacts.zh)

  const generatedDirectory = join(
    resolve(process.cwd()),
    'src',
    'lib',
    'teach',
    'classroom',
    'generated',
    'content-packs',
  )
  for (const locale of ['en', 'zh'] as const) {
    const checkedIn = readFileSync(
      join(generatedDirectory, `${locale}.json`),
      'utf8',
    )
    if (checkedIn !== formatGeneratedJson(artifacts[locale])) {
      throw new Error(
        `${locale} course module is stale; run pnpm content-packs:generate`,
      )
    }
  }

  const verification = verifyContentPackExecutables({
    en: artifacts.en.packs,
    zh: artifacts.zh.packs,
  })
  console.log(
    `Verified ${artifacts.en.packs.length} bilingual course modules, `
    + `${verification.verifiedTemplates.length} exercise programs, and `
    + `${verification.verifiedCodeSamples.length} runnable code samples `
    + `with cjc ${verification.compiler.version}.`,
  )
}

void main()
