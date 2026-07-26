import type {
  RunnerRunResponse,
} from '@/lib/runner-contract'
import { parseRunnerRunResponse } from '@/lib/runner-contract'
import { isUserAbort } from '../abort'

/** Why a run could not be evaluated. Currently only the runner being offline. */
export type RunFailureKind = 'runner_unavailable'

/**
 * Normalised outcome of compiling and running a Cangjie snippet on the remote
 * runner. `ok` is true only when both compilation and execution succeed.
 */
interface RunResultOutputs {
  /** Executed program stdout. Never contains compiler or runtime stderr. */
  stdout: string
  /** True when the runner omitted bytes from stdout. */
  stdoutTruncated: boolean
  /** Executed program stderr. Never contains compiler output. */
  stderr: string
  /** True when the runner omitted bytes from stderr. */
  stderrTruncated: boolean
  /** Compiler stdout/stderr diagnostics, kept separate from program streams. */
  compilerOutput: string
  /** True when the runner omitted bytes from compiler output. */
  compilerOutputTruncated: boolean
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

/** Compile-and-run capability injected into classroom and Playground surfaces. */
export interface CangjieRunner {
  run: (code: string, signal?: AbortSignal) => Promise<RunResult>
}

/**
 * Minimal remote-run client contract. The default implementation POSTs the
 * source to the backend `/run` endpoint; tests inject a fake. Kept local to the
 * feedback module so it does not depend on the legacy tour-ai stack.
 */
export type RemoteRunRequest = (
  code: string,
  opts?: { stdin?: string, signal?: AbortSignal },
) => Promise<RunnerRunResponse>

const defaultRequest: RemoteRunRequest = async (code, opts) => {
  // When stdin is provided the backend needs a structured body so it can route
  // the input to the program; plain compile-and-run uses the `/run` endpoint's
  // canonical text/plain request shape.
  const hasStdin = opts?.stdin != null
  const resp = await fetch(`/api/run`, {
    method: 'POST',
    headers: {
      'Content-Type': hasStdin
        ? 'application/json; charset=utf-8'
        : 'text/plain; charset=utf-8',
    },
    body: hasStdin ? JSON.stringify({ code, stdin: opts!.stdin }) : code,
    signal: opts?.signal,
  })

  if (!resp.ok) {
    const text = await resp.text()
    let msg = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error)
        msg = parsed.error
    }
    catch {
      // non-JSON body, use as-is
    }
    throw new Error(`Remote action failed: ${msg}`)
  }

  const payload: unknown = await resp.json()
  const parsed = parseRunnerRunResponse(payload)
  if (!parsed)
    throw new Error('Remote action failed: runner returned an invalid response')
  return parsed
}

export interface RunCangjieCodeDeps {
  /** Injected remote-run client; defaults to a backend `/run` POST. */
  request?: RemoteRunRequest
  /**
   * Standard input piped to the running program. When set, the default request
   * switches to a JSON body so the backend can route the input. Omitted for
   * plain compile-and-run.
   */
  stdin?: string
  /** Injected clock for measuring elapsed time; defaults to {@link Date.now}. */
  now?: () => number
  /**
   * Abort signal for the run. When it fires the underlying request is cancelled
   * and the abort is re-thrown (rather than reported as `runner_unavailable`) so
   * a teacher tool call can surface a "User aborted" result.
   */
  signal?: AbortSignal
}

/**
 * Compile and run a Cangjie snippet on the remote runner, returning a
 * normalised {@link RunResult}. When the runner is unreachable the result is
 * `ok: false` with `failureKind: 'runner_unavailable'` rather than throwing, so
 * callers can render a graceful degraded state.
 */
export async function runCangjieCode(code: string, deps: RunCangjieCodeDeps = {}): Promise<RunResult> {
  const request = deps.request ?? defaultRequest
  const now = deps.now ?? Date.now
  const startedAt = now()

  try {
    const data = await request(code, { stdin: deps.stdin, signal: deps.signal })
    const durationMs = now() - startedAt
    if (data.phase === 'compile') {
      return {
        ok: false,
        phase: data.phase,
        stdout: data.bin_stdout,
        stdoutTruncated: data.bin_stdout_truncated,
        stderr: data.bin_stderr,
        stderrTruncated: data.bin_stderr_truncated,
        compilerOutput: data.compiler_output,
        compilerOutputTruncated: data.compiler_output_truncated,
        exitCode: data.bin_code,
        durationMs,
      }
    }
    return {
      ok: data.compiler_code === 0 && data.bin_code === 0,
      phase: data.phase,
      stdout: data.bin_stdout,
      stdoutTruncated: data.bin_stdout_truncated,
      stderr: data.bin_stderr,
      stderrTruncated: data.bin_stderr_truncated,
      exitCode: data.bin_code,
      durationMs,
      compilerOutput: data.compiler_output,
      compilerOutputTruncated: data.compiler_output_truncated,
    }
  }
  catch (error) {
    // A user abort must propagate so the caller yields a "User aborted" result;
    // any other failure degrades to a runner-unavailable run result.
    if (isUserAbort(error, deps.signal))
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

/**
 * The default runner used when the workspace injects none. Adapts
 * {@link runCangjieCode} to the teacher's `{ run(code, signal) }` runner shape,
 * routing the abort signal through the deps object so a stopped turn cancels the
 * run. Kept here so that adaptation lives in one place rather than inline at each
 * call site.
 */
export const defaultRunner: CangjieRunner = {
  run: (code: string, signal?: AbortSignal): Promise<RunResult> => runCangjieCode(code, { signal }),
}
