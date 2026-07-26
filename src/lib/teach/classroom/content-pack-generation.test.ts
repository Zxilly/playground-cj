// @vitest-environment node

import {
  chmodSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ContentPackReferenceValidationCase } from './content-pack-builder'
import {
  getReceiptBoundContentPackCodeSampleValidations,
  resolveExecutableFromPath,
  validateContentPackReferenceCase,
  verifyContentPackExecutables,
} from './content-pack-generation'
import {
  contentPackCodeSampleOutputSha256,
  contentPackCodeSampleSourceSha256,
  contentPackCodeSampleValidationResultSha256,
} from './content-pack-artifact'
import type { CourseContentPack } from './content-packs'

function successfulRun(stdout: string) {
  return {
    compileStatus: 'success' as const,
    normalizedOutput: stdout,
    runStatus: 'success' as const,
  }
}

function validationCase(
  overrides: Partial<ContentPackReferenceValidationCase> = {},
): ContentPackReferenceValidationCase {
  return {
    conceptId: 'cj.program.main',
    taskType: 'code_output',
    templateId: 'template:cj.program.main:practice',
    starterCode: '// TODO',
    expectedOutput: '42',
    matchMode: 'exact',
    sourceRequirements: [{ type: 'top_level_main' }],
    referenceSolution: 'main() {\n    println(42)\n}',
    ...overrides,
  }
}

describe('content Pack executable validation', () => {
  it('checks compiler bytes against the lock before querying its identity', () => {
    const previousCompiler = process.env.CJC
    process.env.CJC = process.execPath
    try {
      expect(() => verifyContentPackExecutables({ en: [], zh: [] }))
        .toThrow(
          'Cangjie compiler executable bytes do not match the toolchain lock',
        )
    }
    finally {
      if (previousCompiler === undefined)
        delete process.env.CJC
      else
        process.env.CJC = previousCompiler
    }
  })

  it('resolves a bare compiler name to the exact executable on PATH', () => {
    const directory = mkdtempSync(join(tmpdir(), 'playground-cj-path-cjc-'))
    const executable = join(
      directory,
      process.platform === 'win32' ? 'cjc.exe' : 'cjc',
    )
    try {
      writeFileSync(executable, 'compiler fixture', 'utf8')
      chmodSync(executable, 0o700)

      expect(resolveExecutableFromPath('cjc', directory, '.EXE'))
        .toBe(realpathSync.native(executable))
      expect(resolveExecutableFromPath('missing-cjc', directory, '.EXE'))
        .toBeUndefined()
    }
    finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('binds every program block while explicitly excluding classified snippets', () => {
    const source = 'main() {\n    println("ok")\n}'
    const pack = {
      id: 'pack:test',
      version: `cv:sha256:${'a'.repeat(64)}`,
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
      concept: {
        id: 'concept:test',
        title: 'Test',
        summary: 'Test',
        prerequisites: [],
      },
      blocks: [
        {
          id: 'block:program',
          type: 'code_sample',
          code: source,
          language: 'cangjie',
          sampleType: 'program',
          sourceReferences: [{
            sourceId: 'static-tour',
            ref: '01-test/01-test/01',
            title: 'Test',
          }],
        },
        {
          id: 'block:snippet',
          type: 'code_sample',
          code: 'let fragment = 1',
          language: 'cangjie',
          sampleType: 'snippet',
          sourceReferences: [{
            sourceId: 'static-tour',
            ref: '01-test/01-test/02',
            title: 'Test',
          }],
        },
      ],
      learningSkills: [],
      exerciseTemplates: [],
      review: { status: 'pending' },
    } satisfies CourseContentPack
    const sourceSha256 = contentPackCodeSampleSourceSha256(source)
    const normalizedStdoutSha256 = contentPackCodeSampleOutputSha256('ok')
    const receiptEntry = {
      locale: 'en' as const,
      conceptId: pack.concept.id,
      contentVersion: pack.version,
      blockId: 'block:program',
      sourceSha256,
      normalizedStdoutSha256,
      validationResultSha256:
        contentPackCodeSampleValidationResultSha256(
          sourceSha256,
          normalizedStdoutSha256,
        ),
    }

    expect(getReceiptBoundContentPackCodeSampleValidations(
      { en: [pack], zh: [] },
      [receiptEntry],
    )).toEqual([receiptEntry])
    expect(() => getReceiptBoundContentPackCodeSampleValidations(
      { en: [pack], zh: [] },
      [{ ...receiptEntry, sourceSha256: 'f'.repeat(64) }],
    )).toThrow(/source hash/i)
    expect(() => getReceiptBoundContentPackCodeSampleValidations(
      { en: [pack], zh: [] },
      [],
    )).toThrow(/missing.*code sample/i)
  })

  it('rejects a starter that already passes the deterministic evaluator', () => {
    const source = 'main() {\n    println(42)\n}'
    const testCase = validationCase({ starterCode: source })

    expect(() => validateContentPackReferenceCase(
      testCase,
      successfulRun('42'),
      successfulRun('42'),
    )).toThrow(/starter.*already passes/i)
  })

  it('rejects a pre-solved starter when exact expected output is empty', () => {
    const source = 'main() {}'
    const testCase = validationCase({
      starterCode: source,
      expectedOutput: '',
      referenceSolution: source,
    })

    expect(() => validateContentPackReferenceCase(
      testCase,
      successfulRun(''),
      successfulRun(''),
    )).toThrow(/starter.*already passes/i)
  })

  it('accepts a starter only when the same evaluator rejects its output or source', () => {
    const testCase = validationCase({
      starterCode: 'main() {\n    println(42)\n}',
      sourceRequirements: [
        { type: 'binding', binding: 'let', name: 'answer' },
        { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
      ],
      referenceSolution: [
        'main() {',
        '    let answer = 42',
        '    println(answer)',
        '}',
      ].join('\n'),
    })

    expect(validateContentPackReferenceCase(
      testCase,
      successfulRun('42'),
      successfulRun('42'),
    )).toMatchObject({ templateId: testCase.templateId })
  })

  it('accepts an incomplete starter that does not compile', () => {
    const testCase = validationCase()

    expect(validateContentPackReferenceCase(
      testCase,
      successfulRun('42'),
      {
        compileStatus: 'failure',
        normalizedOutput: '',
        runStatus: 'not_run',
      },
    )).toMatchObject({ templateId: testCase.templateId })
  })

  it('binds starter code and the full evaluator contract into the receipt input hash', () => {
    const base = validationCase({
      referenceSolution: [
        'main() {',
        '    let answer = 42',
        '    println(answer)',
        '}',
      ].join('\n'),
    })
    const referenceExecution = successfulRun('42')
    const starterExecution = {
      compileStatus: 'failure' as const,
      normalizedOutput: '',
      runStatus: 'not_run' as const,
    }
    const digest = (testCase: ContentPackReferenceValidationCase) =>
      validateContentPackReferenceCase(
        testCase,
        referenceExecution,
        starterExecution,
      ).validationInputSha256

    expect(digest({
      ...base,
      starterCode: '// a different incomplete starter',
    })).not.toBe(digest(base))
    expect(digest({
      ...base,
      matchMode: 'contains',
    })).not.toBe(digest(base))
    expect(digest({
      ...base,
      sourceRequirements: [
        { type: 'top_level_main' },
        { type: 'binding', binding: 'let', name: 'answer' },
      ],
    })).not.toBe(digest(base))
  })
})
