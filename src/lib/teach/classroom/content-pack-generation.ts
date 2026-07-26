import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path'
import { getAllConcepts } from '@/lib/ai/concept-graph/loader'
import {
  assertLockedCangjieCompiler,
  loadCangjieToolchainLock,
} from './cangjie-toolchain'
import type {
  CangjieToolchainProvenance,
} from './cangjie-toolchain'
import { evaluateOutput } from '../feedback/evaluate'
import {
  contentPackCodeSampleOutputSha256,
  contentPackCodeSampleSourceSha256,
  contentPackCodeSampleValidationResultSha256,
} from './content-pack-artifact'
import type {
  ContentPackCodeSampleValidation,
} from './content-pack-artifact'
import {
  buildCourseContentPacks,
  getContentPackReferenceValidationCases,
} from './content-pack-builder'
import type {
  ContentPackLanguage,
  CourseContentPack,
} from './content-packs'
import { satisfiesSourceRequirements } from './source-requirements'
import { loadStaticTourContentSections } from './static-tour-content-source'
import {
  assignBilingualLearningContractVersions,
  assignImmutableContentVersion,
  sha256Canonical,
} from './content-pack-version'

interface CommandResult {
  status: number | null
  stderr: string
  stdout: string
}

export interface ContentPackProgramExecution {
  compileStatus: 'failure' | 'success'
  normalizedOutput: string
  runStatus: 'failure' | 'not_run' | 'success'
}

interface ExecutedContentPackProgram extends ContentPackProgramExecution {
  diagnostic: string
}

function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  executableDirectories: string[] = [],
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: executableDirectories.length > 0
      ? {
          ...process.env,
          PATH: [
            ...executableDirectories,
            process.env.PATH ?? '',
          ].join(delimiter),
        }
      : process.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  })
  return {
    status: result.status,
    stderr: result.stderr || result.error?.message || '',
    stdout: result.stdout || '',
  }
}

function childDirectories(directory: string): string[] {
  if (!existsSync(directory))
    return []
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(directory, entry.name))
}

function cangjieExecutableDirectories(compiler: string): string[] {
  const compilerDirectory = dirname(resolve(compiler))
  const root = dirname(compilerDirectory)
  return [
    join(root, 'tools', 'lib'),
    join(root, 'tools', 'bin'),
    compilerDirectory,
    ...childDirectories(join(root, 'lib')),
    join(root, 'lib'),
    ...childDirectories(join(root, 'runtime', 'lib')),
  ].filter(existsSync)
}

function compilerCandidates(): string[] {
  const executable = process.platform === 'win32' ? 'cjc.exe' : 'cjc'
  const candidates = [
    process.env.CJC,
    process.env.CANGJIE_HOME
      ? join(process.env.CANGJIE_HOME, 'bin', executable)
      : undefined,
    process.env.CJV_HOME
      ? join(process.env.CJV_HOME, 'bin', executable)
      : undefined,
    process.env.USERPROFILE
      ? join(process.env.USERPROFILE, '.cjv', 'bin', executable)
      : undefined,
    process.env.HOME
      ? join(process.env.HOME, '.cjv', 'bin', executable)
      : undefined,
    'cjc',
  ]
  return [...new Set(candidates.filter(
    (candidate): candidate is string => Boolean(candidate),
  ))]
}

function isExecutableFile(path: string): boolean {
  try {
    const stat = statSync(path)
    if (!stat.isFile())
      return false
    accessSync(path, constants.X_OK)
    return true
  }
  catch {
    return false
  }
}

/**
 * Resolve the exact executable that the OS would select before either invoking
 * or hashing it. In particular, a bare `cjc` must never be converted to
 * `<cwd>/cjc`, which is not PATH resolution.
 */
export function resolveExecutableFromPath(
  candidate: string,
  pathValue = process.env.PATH ?? '',
  pathExtensions = process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD',
): string | undefined {
  const explicitPath = isAbsolute(candidate)
    || candidate.includes('/')
    || candidate.includes('\\')
  const possiblePaths: string[] = []
  if (explicitPath) {
    possiblePaths.push(resolve(candidate))
  }
  else {
    const names = process.platform === 'win32'
      && !candidate.includes('.')
      ? [
          candidate,
          ...pathExtensions
            .split(';')
            .filter(Boolean)
            .map(extension => `${candidate}${extension.toLowerCase()}`),
        ]
      : [candidate]
    for (const rawDirectory of pathValue.split(delimiter)) {
      const directory = rawDirectory.replace(/^"(.*)"$/, '$1')
      for (const name of names)
        possiblePaths.push(resolve(directory || '.', name))
    }
  }

  for (const possiblePath of possiblePaths) {
    if (!isExecutableFile(possiblePath))
      continue
    return realpathSync.native(possiblePath)
  }
  return undefined
}

function requireCangjieCompiler(): string {
  for (const candidate of compilerCandidates()) {
    const executable = resolveExecutableFromPath(candidate)
    if (executable)
      return executable
  }
  throw new Error(
    'Cangjie compiler is required to verify Course Content Pack reference solutions; '
    + 'put cjc on PATH or set CJC/CANGJIE_HOME',
  )
}

function assertLockedCompilerBytesBeforeExecution(compiler: string): void {
  const { lock } = loadCangjieToolchainLock()
  const executableSha256 = createHash('sha256')
    .update(readFileSync(compiler))
    .digest('hex')
  if (executableSha256 !== lock.compiler.executableSha256) {
    throw new Error(
      'Cangjie compiler executable bytes do not match the toolchain lock',
    )
  }
}

function normalizedProgramOutput(stdout: string): string {
  return stdout
    .replace(/\r\n?/g, '\n')
    .replace(/\s+$/u, '')
}

function compileAndRunContentPackProgram(
  compiler: string,
  executableDirectories: string[],
  temporaryRoot: string,
  source: string,
  identity: string,
): ExecutedContentPackProgram {
  const sourcePath = join(temporaryRoot, `${identity}.cj`)
  const executablePath = join(
    temporaryRoot,
    `${identity}${process.platform === 'win32' ? '.exe' : ''}`,
  )
  writeFileSync(sourcePath, source, 'utf8')
  const compile = runCommand(
    compiler,
    [sourcePath, '-o', executablePath],
    temporaryRoot,
    executableDirectories,
  )
  if (compile.status !== 0) {
    return {
      compileStatus: 'failure',
      diagnostic: (compile.stderr || compile.stdout).trim(),
      normalizedOutput: '',
      runStatus: 'not_run',
    }
  }

  const run = runCommand(
    executablePath,
    [],
    temporaryRoot,
    executableDirectories,
  )
  return {
    compileStatus: 'success',
    diagnostic: run.status === 0
      ? ''
      : (run.stderr || run.stdout).trim(),
    normalizedOutput: normalizedProgramOutput(run.stdout),
    runStatus: run.status === 0 ? 'success' : 'failure',
  }
}

/**
 * Compile and run every checked-in reference/starter pair and every current
 * Core Content Block classified as a standalone program. Snippets are skipped
 * only after their explicit classification has been validated. A missing
 * compiler or failed program aborts generation; there is no unverified
 * fallback.
 */
export function verifyContentPackExecutables(
  packsByLocale: ContentPackPacksByLocale,
): {
  compiler: ContentPackCompilerIdentity
  verifiedCodeSamples: ContentPackCodeSampleValidation[]
  verifiedTemplates: ContentPackReferenceValidation[]
} {
  const programSamples = contentPackProgramValidationInputs(packsByLocale)
  const compiler = requireCangjieCompiler()
  assertLockedCompilerBytesBeforeExecution(compiler)
  const executableDirectories = cangjieExecutableDirectories(compiler)
  const cases = getContentPackReferenceValidationCases()
  const compilerVersionResult = runCommand(
    compiler,
    ['--version'],
    undefined,
    executableDirectories,
  )
  const compilerVersionOutput = [
    compilerVersionResult.stdout,
    compilerVersionResult.stderr,
  ].join('\n').trim()
  if (compilerVersionResult.status !== 0 || !compilerVersionOutput)
    throw new Error('Cangjie compiler did not report a usable version')
  const reportedCompilerIdentity = parseCangjieCompilerIdentity(
    compilerVersionOutput,
  )
  const toolchain = assertLockedCangjieCompiler(
    compiler,
    reportedCompilerIdentity,
  )
  const compilerIdentity: ContentPackCompilerIdentity = {
    ...reportedCompilerIdentity,
    toolchain,
  }
  const temporaryRoot = mkdtempSync(
    join(resolve(tmpdir()), 'playground-cj-content-pack-'),
  )
  const verifiedTemplates: ContentPackReferenceValidation[] = []
  const verifiedCodeSamples: ContentPackCodeSampleValidation[] = []

  try {
    for (const [index, testCase] of cases.entries()) {
      const referenceExecution = compileAndRunContentPackProgram(
        compiler,
        executableDirectories,
        temporaryRoot,
        testCase.referenceSolution,
        `exercise-${index}-reference`,
      )
      const starterExecution = compileAndRunContentPackProgram(
        compiler,
        executableDirectories,
        temporaryRoot,
        testCase.starterCode,
        `exercise-${index}-starter`,
      )
      if (referenceExecution.compileStatus !== 'success') {
        throw new Error(
          `Reference solution failed to compile for ${testCase.templateId}: ${
            referenceExecution.diagnostic}`,
        )
      }
      if (referenceExecution.runStatus !== 'success') {
        throw new Error(
          `Reference solution failed to run for ${testCase.templateId}: ${
            referenceExecution.diagnostic}`,
        )
      }
      verifiedTemplates.push(validateContentPackReferenceCase(
        testCase,
        referenceExecution,
        starterExecution,
      ))
    }

    const executions = new Map<string, ExecutedContentPackProgram>()
    for (const [index, sample] of programSamples.entries()) {
      const executionIdentity = `${sample.locale}\0${sample.sourceSha256}`
      let execution = executions.get(executionIdentity)
      if (!execution) {
        execution = compileAndRunContentPackProgram(
          compiler,
          executableDirectories,
          temporaryRoot,
          sample.source,
          `content-sample-${index}`,
        )
        executions.set(executionIdentity, execution)
      }
      const displayIdentity = [
        sample.locale,
        sample.conceptId,
        sample.contentVersion,
        sample.blockId,
      ].join('/')
      if (execution.compileStatus !== 'success') {
        throw new Error(
          `Code sample failed to compile for ${displayIdentity}: ${
            execution.diagnostic}`,
        )
      }
      if (execution.runStatus !== 'success') {
        throw new Error(
          `Code sample failed to run for ${displayIdentity}: ${
            execution.diagnostic}`,
        )
      }
      const normalizedStdoutSha256 = contentPackCodeSampleOutputSha256(
        execution.normalizedOutput,
      )
      verifiedCodeSamples.push({
        locale: sample.locale,
        conceptId: sample.conceptId,
        contentVersion: sample.contentVersion,
        blockId: sample.blockId,
        sourceSha256: sample.sourceSha256,
        normalizedStdoutSha256,
        validationResultSha256:
          contentPackCodeSampleValidationResultSha256(
            sample.sourceSha256,
            normalizedStdoutSha256,
          ),
      })
    }
  }
  finally {
    const resolvedTemporaryRoot = resolve(temporaryRoot)
    const resolvedSystemTemp = resolve(tmpdir())
    if (
      resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}\\`)
      || resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}/`)
    ) {
      rmSync(resolvedTemporaryRoot, { recursive: true, force: true })
    }
  }

  return {
    compiler: compilerIdentity,
    verifiedCodeSamples,
    verifiedTemplates,
  }
}

export interface ContentPackCompilerIdentity {
  name: 'cjc'
  version: string
  backend: 'cjnative'
  target: 'x86_64-unknown-linux-gnu'
  toolchain: CangjieToolchainProvenance
}

export interface ContentPackReferenceValidation {
  templateId: string
  validationInputSha256: string
  validationResultSha256: string
}

export type ContentPackPacksByLocale = Readonly<
  Record<ContentPackLanguage, readonly CourseContentPack[]>
>

interface ContentPackProgramValidationInput {
  locale: ContentPackLanguage
  conceptId: string
  contentVersion: string
  blockId: string
  source: string
  sourceSha256: string
}

function codeSampleIdentity(
  sample: Pick<
    ContentPackCodeSampleValidation,
    'blockId' | 'conceptId' | 'contentVersion' | 'locale'
  >,
): string {
  return [
    sample.locale,
    sample.conceptId,
    sample.contentVersion,
    sample.blockId,
  ].join('\0')
}

function contentPackProgramValidationInputs(
  packsByLocale: ContentPackPacksByLocale,
): ContentPackProgramValidationInput[] {
  const inputs: ContentPackProgramValidationInput[] = []
  const identities = new Set<string>()
  for (const locale of ['en', 'zh'] as const) {
    for (const pack of packsByLocale[locale]) {
      for (const block of pack.blocks) {
        if (block.type !== 'code_sample')
          continue
        if (block.sampleType === 'snippet')
          continue
        const input: ContentPackProgramValidationInput = {
          locale,
          conceptId: pack.concept.id,
          contentVersion: pack.version,
          blockId: block.id,
          source: block.code,
          sourceSha256: contentPackCodeSampleSourceSha256(block.code),
        }
        const identity = codeSampleIdentity(input)
        if (identities.has(identity)) {
          throw new Error(
            `Duplicate current code sample ${identity.replaceAll('\0', '/')}`,
          )
        }
        identities.add(identity)
        inputs.push(input)
      }
    }
  }
  return inputs.sort((left, right) =>
    codeSampleIdentity(left).localeCompare(codeSampleIdentity(right)))
}

/**
 * Bind freshly rebuilt program sources to successful results in a checked-in
 * receipt without invoking cjc. Missing, extra, reclassified, or changed
 * program blocks fail closed.
 */
export function getReceiptBoundContentPackCodeSampleValidations(
  packsByLocale: ContentPackPacksByLocale,
  receiptSamples: readonly ContentPackCodeSampleValidation[],
): ContentPackCodeSampleValidation[] {
  const expected = contentPackProgramValidationInputs(packsByLocale)
  const available = new Map<string, ContentPackCodeSampleValidation>()
  for (const sample of receiptSamples) {
    const identity = codeSampleIdentity(sample)
    if (available.has(identity)) {
      throw new Error(
        `Duplicate receipt-bound code sample ${identity.replaceAll('\0', '/')}`,
      )
    }
    available.set(identity, sample)
  }

  const bound: ContentPackCodeSampleValidation[] = []
  for (const input of expected) {
    const identity = codeSampleIdentity(input)
    const receipt = available.get(identity)
    if (!receipt) {
      throw new Error(
        `Missing receipt-bound code sample ${identity.replaceAll('\0', '/')}`,
      )
    }
    if (receipt.sourceSha256 !== input.sourceSha256) {
      throw new Error(
        `Code sample source hash changed for ${identity.replaceAll('\0', '/')}`,
      )
    }
    const expectedResult = contentPackCodeSampleValidationResultSha256(
      input.sourceSha256,
      receipt.normalizedStdoutSha256,
    )
    if (receipt.validationResultSha256 !== expectedResult) {
      throw new Error(
        `Code sample result hash changed for ${identity.replaceAll('\0', '/')}`,
      )
    }
    available.delete(identity)
    bound.push(receipt)
  }
  const extra = available.keys().next().value as string | undefined
  if (extra) {
    throw new Error(
      `Validation receipt contains an unexpected code sample ${
        extra.replaceAll('\0', '/')}`,
    )
  }
  return bound
}

function passesDeterministicCodeEvaluator(
  testCase: ReturnType<typeof getContentPackReferenceValidationCases>[number],
  source: string,
  execution: ContentPackProgramExecution,
): boolean {
  return execution.compileStatus === 'success'
    && execution.runStatus === 'success'
    && evaluateOutput(
      execution.normalizedOutput,
      testCase.expectedOutput,
      testCase.matchMode,
    )
    && satisfiesSourceRequirements(source, testCase.sourceRequirements)
}

/**
 * Apply the exact browser evaluator contract to the compiled reference and
 * starter programs. A starter may fail to compile or run, but it must never
 * satisfy both the observable-output and structural-source requirements.
 */
export function validateContentPackReferenceCase(
  testCase: ReturnType<typeof getContentPackReferenceValidationCases>[number],
  referenceExecution: ContentPackProgramExecution,
  starterExecution: ContentPackProgramExecution,
): ContentPackReferenceValidation {
  if (referenceExecution.compileStatus !== 'success') {
    throw new Error(
      `Reference solution failed to compile for ${testCase.templateId}`,
    )
  }
  if (referenceExecution.runStatus !== 'success') {
    throw new Error(
      `Reference solution failed to run for ${testCase.templateId}`,
    )
  }
  if (!passesDeterministicCodeEvaluator(
    testCase,
    testCase.referenceSolution,
    referenceExecution,
  )) {
    throw new Error(
      `Reference solution failed the deterministic evaluator for ${testCase.templateId}`,
    )
  }
  if (passesDeterministicCodeEvaluator(
    testCase,
    testCase.starterCode,
    starterExecution,
  )) {
    throw new Error(
      `Exercise starter already passes the deterministic evaluator for ${testCase.templateId}`,
    )
  }
  return contentPackReferenceValidation(testCase)
}

function parseCangjieCompilerIdentity(
  versionOutput: string,
): Omit<ContentPackCompilerIdentity, 'toolchain'> {
  const firstLine = versionOutput.split(/\r?\n/, 1)[0].trim()
  const targetLine = versionOutput.split(/\r?\n/, 2)[1]?.trim()
  const match = /^Cangjie Compiler:\s+(\S+)\s+\(([^)]+)\)$/.exec(firstLine)
  if (
    !match
    || match[2] !== 'cjnative'
    || targetLine !== 'Target: x86_64-unknown-linux-gnu'
  ) {
    throw new Error(
      `Unsupported Cangjie compiler identity: ${JSON.stringify(firstLine)}`,
    )
  }
  return {
    name: 'cjc',
    version: match[1],
    backend: 'cjnative',
    target: 'x86_64-unknown-linux-gnu',
  }
}

function contentPackReferenceValidation(
  testCase: ReturnType<typeof getContentPackReferenceValidationCases>[number],
): ContentPackReferenceValidation {
  return {
    templateId: testCase.templateId,
    validationInputSha256: sha256Canonical({
      conceptId: testCase.conceptId,
      referenceSolution: testCase.referenceSolution,
      task: {
        type: testCase.taskType,
        expectedOutput: testCase.expectedOutput,
        matchMode: testCase.matchMode,
        sourceRequirements: testCase.sourceRequirements,
        starterCode: testCase.starterCode,
      },
      templateId: testCase.templateId,
      validationProtocol: 'cjc-code-task-evaluator-v2',
    }),
    validationResultSha256: sha256Canonical({
      referenceSolutionPassed: true,
      starterCodePassed: false,
      validationProtocol: 'cjc-code-task-evaluator-v2',
    }),
  }
}

export function getContentPackReferenceValidations(): ContentPackReferenceValidation[] {
  return getContentPackReferenceValidationCases()
    .map(testCase => contentPackReferenceValidation(testCase))
}

/** Offline-only projection from repository curriculum sources. */
export async function buildCurrentCourseContentPacks(
  lang: ContentPackLanguage,
): Promise<CourseContentPack[]> {
  const sections = loadStaticTourContentSections()
  const concepts = getAllConcepts()
  const bilingual = assignBilingualLearningContractVersions(
    buildCourseContentPacks(sections, concepts, 'en'),
    buildCourseContentPacks(sections, concepts, 'zh'),
  )
  return bilingual[lang]
    .map(pack => assignImmutableContentVersion(pack, lang))
}
