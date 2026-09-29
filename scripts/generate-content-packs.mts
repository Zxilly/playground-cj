import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  assertBilingualLearningContractArtifacts,
  createGeneratedContentPackArtifacts,
  formatGeneratedJson,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  buildCurrentCourseContentPacks,
} from '../src/lib/teach/classroom/content-pack-generation'

const generatedDirectory = join(
  resolve(process.cwd()),
  'src',
  'lib',
  'teach',
  'classroom',
  'generated',
  'content-packs',
)

async function main(): Promise<void> {
  const artifacts = createGeneratedContentPackArtifacts({
    en: await buildCurrentCourseContentPacks('en'),
    zh: await buildCurrentCourseContentPacks('zh'),
  })
  assertBilingualLearningContractArtifacts(artifacts.en, artifacts.zh)
  mkdirSync(generatedDirectory, { recursive: true })

  for (const locale of ['en', 'zh'] as const) {
    const output = formatGeneratedJson(artifacts[locale])
    writeFileSync(join(generatedDirectory, `${locale}.json`), output, 'utf8')
    console.log(`${locale}: ${artifacts[locale].packs.length} packs, ${Buffer.byteLength(output)} bytes`)
  }
}

void main()
