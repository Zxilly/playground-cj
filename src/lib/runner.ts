import type { RunnerRunResponse } from './runner-contract'
import type { RunFailureKind, RunnerClient } from './runner-client'
import { browserRunnerClient, RunnerRequestError } from './runner-client'

export type { RunFailureKind } from './runner-client'

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
    failureReason?: never
    failureMessage?: never
    httpStatus?: never
    retryAfterSeconds?: never
    errorCode?: never
  }
  | RunResultOutputs & {
    ok: boolean
    phase: 'run'
    exitCode: number
    failureKind?: never
    failureReason?: never
    failureMessage?: never
    httpStatus?: never
    retryAfterSeconds?: never
    errorCode?: never
  }
  | RunResultOutputs & {
    ok: false
    phase: null
    exitCode: null
    /** Kept as `'runner_unavailable'` for strict persisted classroom schemas; inspect `failureReason` (via `getRunFailureKind`) for granular classification. */
    failureKind: 'runner_unavailable'
    /** Granular failure classification (rate limit, payload too large, timeout, service busy, offline, network error). */
    failureReason?: RunFailureKind
    failureMessage: string
    httpStatus?: number
    retryAfterSeconds?: number
    errorCode?: string
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

export function getRunFailureKind(result: RunResult | null | undefined): RunFailureKind | undefined {
  if (!result || result.phase !== null)
    return undefined
  return result.failureReason ?? result.failureKind
}

export function formatRunFailureMessage(
  result: Extract<RunResult, { phase: null }>,
  locale: string = 'zh',
): string {
  const kind = result.failureReason ?? result.failureKind
  const isEnglish = locale === 'en'
  const retryAfter = result.retryAfterSeconds

  switch (kind) {
    case 'rate_limited':
      if (retryAfter) {
        return isEnglish
          ? `Too many requests (429). Please wait about ${retryAfter} seconds before running again.`
          : `请求过于频繁（429），请等待约 ${retryAfter} 秒后再试。`
      }
      return isEnglish
        ? 'Too many requests (429). Please wait a moment before running again.'
        : '请求过于频繁（429），请稍后再试。'
    case 'payload_too_large':
      return isEnglish
        ? 'Code or standard input exceeds the 256 KB limit (413). Please shorten it and retry.'
        : '代码或标准输入体积超出 256 KB 上限（413），请精简内容后重试。'
    case 'timeout':
      return isEnglish
        ? 'Execution timed out (504). Check for infinite loops or long-running computations and try again.'
        : '编译或运行超时（504），请检查是否存在死循环或耗时过长的计算后重试。'
    case 'service_busy':
      if (retryAfter) {
        return isEnglish
          ? `Runner service is busy (503). Please retry in about ${retryAfter} seconds.`
          : `运行服务当前较繁忙（503），请约 ${retryAfter} 秒后重试。`
      }
      return isEnglish
        ? 'Runner service is busy (503). Please try again shortly.'
        : '运行服务当前较繁忙（503），请稍后重试。'
    case 'offline':
      return isEnglish
        ? 'You appear to be offline. Check your internet connection and try again.'
        : '当前似乎处于离线状态，请检查网络连接后重试。'
    case 'network_error':
      return isEnglish
        ? 'Network request failed. Check your connection or proxy settings and try again.'
        : '网络请求失败，请检查网络连接或代理设置后重试。'
    case 'runner_unavailable':
    default:
      return isEnglish
        ? 'The code runner is temporarily unavailable. Please try again later.'
        : '代码运行服务暂时不可用，请稍后重试。'
  }
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
    if (error instanceof RunnerRequestError) {
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
        failureReason: error.failureKind,
        failureMessage: error.message,
        ...(error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}),
        ...(error.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        ...(error.errorCode !== undefined ? { errorCode: error.errorCode } : {}),
      }
    }
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
      failureReason: 'runner_unavailable',
      failureMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

export const defaultRunner: CangjieRunner = {
  run: (code, signal) => runCangjieCode(code, { signal }),
}
