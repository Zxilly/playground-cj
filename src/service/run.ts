import type {
  RunnerFormatResponse,
  RunnerRunResponse,
  RunnerTruncationState,
} from '@/lib/runner-contract'
import {
  NO_RUNNER_TRUNCATION,
  parseRunnerFormatResponse,
  parseRunnerRunResponse,
} from '@/lib/runner-contract'
import { t } from '@lingui/core/macro'

type RunMessage = RunnerRunResponse

export function requestRemoteAction(
  code: string,
  action: 'run',
): Promise<RunMessage>
export function requestRemoteAction(
  code: string,
  action: 'format',
): Promise<RunnerFormatResponse>
export async function requestRemoteAction(
  code: string,
  action: 'run' | 'format',
): Promise<RunMessage | RunnerFormatResponse> {
  const resp = await fetch(`/api/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: code,
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
  const parsed = action === 'run'
    ? parseRunnerRunResponse(payload)
    : parseRunnerFormatResponse(payload)
  if (!parsed)
    throw new Error('Remote action failed: runner returned an invalid response')
  return parsed
}

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

  const data = await requestRemoteAction(code, 'run')

  actions.setTruncation({
    compilerOutput: data.compiler_output_truncated,
    programStdout: data.bin_stdout_truncated,
    programStderr: data.bin_stderr_truncated,
    formattedSource: false,
    formatterOutput: false,
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
