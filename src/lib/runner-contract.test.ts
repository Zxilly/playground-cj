import { describe, expect, it } from 'vitest'
import {
  parseRunnerFormatResponse,
  parseRunnerRunResponse,
} from './runner-contract'

const validRun = {
  phase: 'run',
  compiler_output: '',
  compiler_output_truncated: false,
  compiler_code: 0,
  bin_stdout: 'ok',
  bin_stdout_truncated: false,
  bin_stderr: '',
  bin_stderr_truncated: false,
  bin_code: 0,
} as const

describe('runner response contract', () => {
  it('requires exact run fields and phase invariants', () => {
    expect(parseRunnerRunResponse(validRun)).toEqual(validRun)
    expect(parseRunnerRunResponse({
      ...validRun,
      internal: 'not part of the protocol',
    })).toBeNull()
    expect(parseRunnerRunResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    })).toBeNull()
    expect(parseRunnerRunResponse({
      ...validRun,
      phase: 'compile',
      compiler_code: 1,
      bin_code: null,
      bin_stdout: '',
      bin_stdout_truncated: true,
    })).toBeNull()
    expect(parseRunnerRunResponse({
      ...validRun,
      bin_code: Number.MAX_SAFE_INTEGER + 1,
    })).toBeNull()
  })

  it('requires exact format fields, including both truncation facts', () => {
    const valid = {
      formatted: 'main() {}',
      formatted_truncated: false,
      formatter_output: '',
      formatter_output_truncated: false,
      formatter_code: 0,
    }
    expect(parseRunnerFormatResponse(valid)).toEqual(valid)
    expect(parseRunnerFormatResponse({
      ...valid,
      formatted_truncated: undefined,
    })).toBeNull()
    expect(parseRunnerFormatResponse({
      ...valid,
      unexpected: true,
    })).toBeNull()
  })
})
