import type { ExerciseTask } from './content-packs'
import { describe, expect, it } from 'vitest'
import { evaluateDeterministicSubmission } from './integrity'

describe('evaluateDeterministicSubmission', () => {
  it.each([
    { matchMode: 'exact' as const, stdout: '42' },
    { matchMode: 'contains' as const, stdout: '42 followed by omitted output' },
  ])('fails closed for truncated $matchMode stdout even when retained text matches', ({
    matchMode,
    stdout,
  }) => {
    const task: ExerciseTask = {
      type: 'code_output',
      prompt: 'Print 42.',
      starterCode: 'main() {}',
      expectedOutput: '42',
      matchMode,
      sourceRequirements: [{ type: 'top_level_main' }],
      hints: [],
    }
    const submission = {
      type: 'code_output' as const,
      code: 'main() { println(42) }',
    }

    expect(evaluateDeterministicSubmission(task, submission, {
      runnerOk: true,
      stdout,
      stdoutTruncated: false,
    })).toBe(true)
    expect(evaluateDeterministicSubmission(task, submission, {
      runnerOk: true,
      stdout,
      stdoutTruncated: true,
    })).toBe(false)
  })
})
