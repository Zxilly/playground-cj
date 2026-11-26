import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  assertBilingualLearningContractArtifacts,
  createGeneratedContentPackArtifacts,
  formatGeneratedJson,
} from '../src/lib/teach/classroom/content-pack-artifact'
import {
  buildCurrentCourseContentPacks,
  verifyContentPackExecutables,
} from '../src/lib/teach/classroom/content-pack-generation'

async function main(): Promise<void> {
  const artifacts = createGeneratedContentPackArtifacts({
    en: await buildCurrentCourseContentPacks('en'),
    zh: await buildCurrentCourseContentPacks('zh'),
  })
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

  const isLinux = process.platform === 'linux'
  const forceStrict = process.env.CI === 'true'
    || process.env.CONTENT_PACKS_STRICT_TOOLCHAIN === '1'
  const strictToolchainLock = isLinux || forceStrict

  if (!strictToolchainLock) {
    console.warn(
      `[content-packs:verify] Non-Linux host (${process.platform}) detected: `
      + 'skipping Linux x64 cjc SHA-256/target lock check (still strictly enforced on Linux/CI; '
      + 'set CONTENT_PACKS_STRICT_TOOLCHAIN=1 to require it). '
      + 'Compiling and executing all exercises and code samples with local cjc...',
    )
  }

  const verification = verifyContentPackExecutables({
    en: artifacts.en.packs,
    zh: artifacts.zh.packs,
  }, { strictToolchainLock })
  const lockMode = verification.toolchainLocked
    ? 'locked Linux x64 toolchain'
    : `local ${verification.compiler.target} compiler (non-Linux lock check skipped)`
  console.log(
    `Verified ${artifacts.en.packs.length} bilingual course modules, `
    + `${verification.verifiedTemplates.length} exercise programs, and `
    + `${verification.verifiedCodeSamples.length} runnable code samples `
    + `with cjc ${verification.compiler.version} (${lockMode}).`,
  )
}

void main()
