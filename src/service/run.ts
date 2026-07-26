import type {
  RunnerTruncationState,
} from '@/lib/runner-contract'
import {
  NO_RUNNER_TRUNCATION,
} from '@/lib/runner-contract'
import { browserRunnerClient } from '@/lib/runner-client'
import { t } from '@lingui/core/macro'

export interface Actions {
  setToolOutput: (content: string) => void
  setProgramOutput: (content: string) => void
  setTruncation: (state: RunnerTruncationState) => void
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

export async function remoteRun(code: string, actions: Actions): Promise<void> {
  actions.setTruncation(NO_RUNNER_TRUNCATION)
  actions.setToolOutput(t`编译中`)
  actions.setProgramOutput(t`运行中`)

  const data = await browserRunnerClient.run(code)

  actions.setTruncation({
    compilerOutput: data.compiler_output_truncated,
    programStdout: data.bin_stdout_truncated,
    programStderr: data.bin_stderr_truncated,
  })
  actions.setToolOutput(buildOutput(data.compiler_output, data.compiler_code))
  if (data.phase === 'compile') {
    actions.setProgramOutput('')
    throw new Error(t`编译失败`)
  }

  actions.setProgramOutput(buildProgramOutput(
    data.bin_stdout,
    data.bin_stderr,
    data.bin_code,
  ))

  if (data.bin_code !== 0) {
    throw new Error(t`运行失败`)
  }
}
