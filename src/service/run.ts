import type {
  RunnerTruncationState,
} from '@/lib/runner-contract'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import { getRunFailureKind, runCangjieCode } from '@/lib/runner'
import type { RunResult } from '@/lib/runner'
import { t } from '@lingui/core/macro'

export interface Actions {
  setToolOutput: (content: string) => void
  setProgramOutput: (content: string) => void
  setTruncation: (state: RunnerTruncationState) => void
  setResult?: (result: RunResult | null) => void
  /** Optional provider for standard input; omitted or empty skips stdin payload. */
  getStdin?: () => string | undefined
}

function buildOutput(content: string, code: number): string {
  const trailing = content.endsWith('\n') ? '' : '\n'
  return `${content}${trailing}----------\n${t`exit code ${code}`}`
}

function buildProgramOutput(stdout: string, stderr: string, code: number): string {
  const content = stderr
    ? `${stdout}${stdout && !stdout.endsWith('\n') ? '\n' : ''}[stderr]\n${stderr}`
    : stdout
  return buildOutput(content, code)
}

export function formatLocalizedRunFailure(data: Extract<RunResult, { phase: null }>): string {
  const kind = getRunFailureKind(data)
  const retryAfter = data.retryAfterSeconds

  switch (kind) {
    case 'rate_limited':
      return retryAfter
        ? t`请求过于频繁（429），请等待约 ${retryAfter} 秒后再试。`
        : t`请求过于频繁（429），请稍后再试。`
    case 'payload_too_large':
      return t`代码或标准输入体积超出 256 KB 上限（413），请精简内容后重试。`
    case 'timeout':
      return t`编译或运行超时（504），请检查是否存在死循环或耗时过长的计算后重试。`
    case 'service_busy':
      return retryAfter
        ? t`运行服务当前较繁忙（503），请约 ${retryAfter} 秒后重试。`
        : t`运行服务当前较繁忙（503），请稍后重试。`
    case 'offline':
      return t`当前似乎处于离线状态，请检查网络连接后重试。`
    case 'network_error':
      return t`网络请求失败，请检查网络连接或代理设置后重试。`
    case 'runner_unavailable':
    default:
      return t`代码运行服务暂时不可用，请稍后重试。`
  }
}

/** Text adapter for native Output channels and existing console views. */
export async function remoteRun(code: string, actions: Actions, signal?: AbortSignal): Promise<RunResult> {
  signal?.throwIfAborted()
  actions.setResult?.(null)
  actions.setTruncation(NO_RUNNER_TRUNCATION)
  actions.setToolOutput(t`编译中`)
  actions.setProgramOutput(t`运行中`)

  const stdin = actions.getStdin?.()
  const data = await runCangjieCode(code, {
    ...(stdin !== undefined ? { stdin } : {}),
    signal,
  })
  signal?.throwIfAborted()
  actions.setResult?.(data)

  actions.setTruncation({
    compilerOutput: data.compilerOutputTruncated,
    programStdout: data.stdoutTruncated,
    programStderr: data.stderrTruncated,
  })
  if (data.phase === null) {
    actions.setToolOutput(formatLocalizedRunFailure(data))
    actions.setProgramOutput('')
    throw new Error(data.failureMessage)
  }
  actions.setToolOutput(buildOutput(data.compilerOutput, data.compilerExitCode ?? (data.phase === 'compile' ? 1 : 0)))
  if (data.phase === 'compile') {
    actions.setProgramOutput('')
    throw new Error(t`编译失败`)
  }

  actions.setProgramOutput(buildProgramOutput(
    data.stdout,
    data.stderr,
    data.exitCode,
  ))

  if (!data.ok) {
    throw new Error(t`运行失败`)
  }
  return data
}
