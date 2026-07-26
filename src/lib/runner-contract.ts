/**
 * Maximum UTF-8 size of every textual field returned by the runner.
 *
 * The Go runner enforces the same value independently. Truncation is carried
 * out-of-band by explicit booleans; it must never be inferred from, or encoded
 * into, the returned text.
 */
export const MAX_RUNNER_OUTPUT_BYTES = 1_000_000

export type RunnerExecutionPhase = 'compile' | 'run'

interface RunnerRunResponseBase {
  compiler_output: string
  compiler_output_truncated: boolean
  bin_stdout: string
  bin_stdout_truncated: boolean
  bin_stderr: string
  bin_stderr_truncated: boolean
}

export type RunnerRunResponse
  = | RunnerRunResponseBase & {
    phase: 'compile'
    compiler_code: number
    bin_code: null
  }
  | RunnerRunResponseBase & {
    phase: 'run'
    compiler_code: 0
    bin_code: number
  }

export interface RunnerTruncationState {
  readonly compilerOutput: boolean
  readonly programStdout: boolean
  readonly programStderr: boolean
}

export const NO_RUNNER_TRUNCATION: RunnerTruncationState = {
  compilerOutput: false,
  programStdout: false,
  programStderr: false,
}

const RUN_RESPONSE_FIELDS = new Set([
  'phase',
  'compiler_output',
  'compiler_output_truncated',
  'compiler_code',
  'bin_stdout',
  'bin_stdout_truncated',
  'bin_stderr',
  'bin_stderr_truncated',
  'bin_code',
])

export function runnerOutputByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function isWithinRunnerOutputLimit(value: string): boolean {
  return value.length <= MAX_RUNNER_OUTPUT_BYTES
    && runnerOutputByteLength(value) <= MAX_RUNNER_OUTPUT_BYTES
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactFields(
  value: Record<string, unknown>,
  fields: ReadonlySet<string>,
): boolean {
  const keys = Object.keys(value)
  return keys.length === fields.size && keys.every(key => fields.has(key))
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/**
 * Parse the canonical successful `/run` response. Unknown or missing fields
 * are rejected so protocol drift cannot silently change evaluation semantics.
 */
export function parseRunnerRunResponse(value: unknown): RunnerRunResponse | null {
  if (!isObject(value) || !hasExactFields(value, RUN_RESPONSE_FIELDS))
    return null

  if (
    (value.phase !== 'compile' && value.phase !== 'run')
    || typeof value.compiler_output !== 'string'
    || !isWithinRunnerOutputLimit(value.compiler_output)
    || typeof value.compiler_output_truncated !== 'boolean'
    || !isSafeInteger(value.compiler_code)
    || typeof value.bin_stdout !== 'string'
    || !isWithinRunnerOutputLimit(value.bin_stdout)
    || typeof value.bin_stdout_truncated !== 'boolean'
    || typeof value.bin_stderr !== 'string'
    || !isWithinRunnerOutputLimit(value.bin_stderr)
    || typeof value.bin_stderr_truncated !== 'boolean'
  ) {
    return null
  }

  if (value.phase === 'compile') {
    if (
      value.compiler_code === 0
      || value.bin_stdout !== ''
      || value.bin_stdout_truncated
      || value.bin_stderr !== ''
      || value.bin_stderr_truncated
      || value.bin_code !== null
    ) {
      return null
    }
    return {
      phase: value.phase,
      compiler_output: value.compiler_output,
      compiler_output_truncated: value.compiler_output_truncated,
      compiler_code: value.compiler_code,
      bin_stdout: value.bin_stdout,
      bin_stdout_truncated: value.bin_stdout_truncated,
      bin_stderr: value.bin_stderr,
      bin_stderr_truncated: value.bin_stderr_truncated,
      bin_code: value.bin_code,
    }
  }

  if (value.compiler_code !== 0 || !isSafeInteger(value.bin_code))
    return null
  return {
    phase: value.phase,
    compiler_output: value.compiler_output,
    compiler_output_truncated: value.compiler_output_truncated,
    compiler_code: value.compiler_code,
    bin_stdout: value.bin_stdout,
    bin_stdout_truncated: value.bin_stdout_truncated,
    bin_stderr: value.bin_stderr,
    bin_stderr_truncated: value.bin_stderr_truncated,
    bin_code: value.bin_code,
  }
}
