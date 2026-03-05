import { BACKEND_URL } from '@/const'
import { t } from '@lingui/core/macro'

interface FormatMessage {
  formatted: string
  formatter_output: string
  formatter_code: number
}

interface RunMessage {
  compiler_output: string
  compiler_code: number
  bin_output: string
  bin_code: number
}

export async function requestRemoteAction<
  T extends 'run' | 'format',
>(
  code: string,
  action: T,
): Promise<T extends 'run' ? RunMessage : FormatMessage> {
  const resp = await fetch(`${BACKEND_URL}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: new TextEncoder().encode(code),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Remote action failed: ${text}`)
  }

  return resp.json()
}

export interface Actions {
  setToolOutput: (content: string) => void
  setProgramOutput: (content: string) => void
}

function buildOutput(content: string, code: number): string {
  const trailing = content.endsWith('\n') ? '' : '\n'
  return `${content}${trailing}----------\n${t`exit code ${code}`}`
}

export async function remoteRun(code: string, actions: Actions): Promise<void> {
  actions.setToolOutput(t`编译中`)
  actions.setProgramOutput(t`运行中`)

  const data = await requestRemoteAction(code, 'run')

  actions.setToolOutput(buildOutput(data.compiler_output, data.compiler_code))
  if (data.compiler_code !== 0) {
    actions.setProgramOutput('')
    throw new Error(t`编译失败`)
  }

  actions.setProgramOutput(buildOutput(data.bin_output, data.bin_code))

  if (data.bin_code !== 0) {
    throw new Error(t`运行失败`)
  }
}
