import type { RunnerRunResponse } from './runner-contract'
import type { RunnerClient } from './runner-client'
import { browserRunnerClient } from './runner-client'

export type RunFailureKind = 'runner_unavailable'

interface RunResultOutputs {
  /** Program streams remain separate from compiler diagnostics. */
  stdout: string
  stdoutTruncated: boolean
  stderr: string
  stderrTruncated: boolean
  compilerOutput: string
  compilerOutputTruncated: boolean
  /** Optional for stored classroom results created before this field existed. */
  compilerExitCode?: number
  durationMs?: number
}

export type RunResult
  = | RunResultOutputs & {
    ok: false
    phase: 'compile'
    exitCode: null
    failureKind?: never
    failureMessage?: never
  }
  | RunResultOutputs & {
    ok: boolean
    phase: 'run'
    exitCode: number
    failureKind?: never
    failureMessage?: never
  }
  | RunResultOutputs & {
    ok: false
    phase: null
    exitCode: null
    failureKind: RunFailureKind
    failureMessage: string
  }

/** Shared execution capability; surfaces own their output and persistence policy. */
export interface CangjieRunner {
  run: (code: string, signal?: AbortSignal) => Promise<RunResult>
}

export interface RunCangjieCodeDeps {
  client?: Pick<RunnerClient, 'run'>
  stdin?: string
  now?: () => number
  signal?: AbortSignal
}

export function normalizeRunResult(data: RunnerRunResponse, durationMs?: number): RunResult {
  const outputs: RunResultOutputs = {
    stdout: data.bin_stdout,
    stdoutTruncated: data.bin_stdout_truncated,
    stderr: data.bin_stderr,
    stderrTruncated: data.bin_stderr_truncated,
    compilerOutput: data.compiler_output,
    compilerOutputTruncated: data.compiler_output_truncated,
    compilerExitCode: data.compiler_code,
    durationMs,
  }
  return data.phase === 'compile'
    ? { ...outputs, ok: false, phase: 'compile', exitCode: null }
    : { ...outputs, ok: data.compiler_code === 0 && data.bin_code === 0, phase: 'run', exitCode: data.bin_code }
}

/** Network failures are results; cancellation remains a rejected operation. */
export async function runCangjieCode(code: string, deps: RunCangjieCodeDeps = {}): Promise<RunResult> {
  const client = deps.client ?? browserRunnerClient
  const now = deps.now ?? Date.now
  const startedAt = now()
  try {
    deps.signal?.throwIfAborted()
    const data = await client.run(code, { stdin: deps.stdin, signal: deps.signal })
    // Also guard injected clients that complete after the owning view closes.
    deps.signal?.throwIfAborted()
    return normalizeRunResult(data, now() - startedAt)
  }
  catch (error) {
    if (deps.signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
      throw error
    return {
      ok: false,
      phase: null,
      stdout: '',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: null,
      durationMs: now() - startedAt,
      failureKind: 'runner_unavailable',
      failureMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

export const defaultRunner: CangjieRunner = {
  run: (code, signal) => runCangjieCode(code, { signal }),
}
