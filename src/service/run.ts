import type {
  RunnerTruncationState,
} from '@/lib/runner-contract'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import { runCangjieCode } from '@/lib/runner'
import type { RunResult } from '@/lib/runner'
import { t } from '@lingui/core/macro'

export interface Actions {
  setToolOutput: (content: string) => void
  setProgramOutput: (content: string) => void
  setTruncation: (state: RunnerTruncationState) => void
  setResult?: (result: RunResult | null) => void
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

/** Text adapter for native Output channels and existing console views. */
export async function remoteRun(code: string, actions: Actions, signal?: AbortSignal): Promise<RunResult> {
  signal?.throwIfAborted()
  actions.setResult?.(null)
  actions.setTruncation(NO_RUNNER_TRUNCATION)
  actions.setToolOutput(t`编译中`)
  actions.setProgramOutput(t`运行中`)

  const data = await runCangjieCode(code, { signal })
  signal?.throwIfAborted()
  actions.setResult?.(data)

  actions.setTruncation({
    compilerOutput: data.compilerOutputTruncated,
    programStdout: data.stdoutTruncated,
    programStderr: data.stderrTruncated,
  })
  if (data.phase === null) {
    actions.setToolOutput(t`代码运行服务暂时不可用，请稍后重试。`)
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
