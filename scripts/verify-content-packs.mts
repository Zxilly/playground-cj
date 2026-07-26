import {
  verifyContentPackExecutables,
} from '../src/lib/teach/classroom/content-pack-generation'
import {
  buildExpectedContentPackExecutableValidationPacks,
  verifyContentPackPublication,
} from './content-pack-verification.mts'

async function main(): Promise<void> {
  const validationPacks
    = await buildExpectedContentPackExecutableValidationPacks()
  const compiled = verifyContentPackExecutables(validationPacks)
  const count = await verifyContentPackPublication({
    compiler: compiled.compiler,
    codeSamples: compiled.verifiedCodeSamples,
    templates: compiled.verifiedTemplates,
  })
  console.log(
    `Verified immutable Content Pack artifacts, repository review declaration, and `
    + `${count.templates} freshly compiled reference/starter pairs plus `
    + `${count.codeSamples} freshly compiled runnable code samples.`,
  )
}

void main()
