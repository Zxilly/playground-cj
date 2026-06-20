/**
 * Backend base URL for the remote runner. Read from the environment directly
 * (mirroring `@/const`) so this module stays free of the heavy const barrel,
 * which statically imports `.cj` example assets.
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://cj-api.learningman.top'

/** Why a run could not be evaluated. Currently only the runner being offline. */
export type RunFailureKind = 'runner_unavailable'

/**
 * Normalised outcome of compiling and running a Cangjie snippet on the remote
 * runner. `ok` is true only when both compilation and execution succeed.
 */
export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs?: number
  compilerOutput?: string
  failureKind?: RunFailureKind
}

/** Raw payload returned by the backend `/run` endpoint. */
interface RemoteRunMessage {
  compiler_output: string
  compiler_code: number
  bin_output: string
  bin_code: number
}

/**
 * Minimal remote-run client contract. The default implementation POSTs the
 * source to the backend `/run` endpoint; tests inject a fake. Kept local to the
 * feedback module so it does not depend on the legacy tour-ai stack.
 */
export type RemoteRunRequest = (code: string, signal?: AbortSignal) => Promise<RemoteRunMessage>

const defaultRequest: RemoteRunRequest = async (code, signal) => {
  const resp = await fetch(`${BACKEND_URL}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: code,
    signal,
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

  return resp.json() as Promise<RemoteRunMessage>
}

export interface RunCangjieCodeDeps {
  /** Injected remote-run client; defaults to a backend `/run` POST. */
  request?: RemoteRunRequest
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
    const data = await request(code, deps.signal)
    return {
      ok: data.compiler_code === 0 && data.bin_code === 0,
      stdout: data.bin_output,
      stderr: data.compiler_output,
      exitCode: data.bin_code,
      durationMs: now() - startedAt,
      compilerOutput: data.compiler_output,
    }
  }
  catch (error) {
    // A user abort must propagate so the caller yields a "User aborted" result;
    // any other failure degrades to a runner-unavailable run result.
    if (deps.signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
      throw error
    return {
      ok: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: null,
      durationMs: now() - startedAt,
      failureKind: 'runner_unavailable',
    }
  }
}
