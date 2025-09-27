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

export enum SandboxStatus {
  OK = 0,
  UNKNOWN_ERROR = 1,
}

export async function requestRemoteAction<
  T extends 'run' | 'format',
>(
  code: string,
  action: T,
): Promise<[T extends 'run' ? RunMessage : FormatMessage, SandboxStatus]> {
  const encoder = new TextEncoder()

  const resp = await fetch(`${BACKEND_URL}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: encoder.encode(code),
  })

  const data: T extends 'run' ? RunMessage : FormatMessage = await resp.json()

  if (resp.ok) {
    return [data, SandboxStatus.OK]
  }
  else {
    console.error(await resp.text())
    return [data, SandboxStatus.UNKNOWN_ERROR]
  }
}

type ContentSetter = (content: string) => void

export interface Actions {
  setToolOutput: ContentSetter
  setProgramOutput: ContentSetter
}

function buildOutput(content: string, code: number): string {
  let ret = content
  if (!ret.endsWith('\n')) {
    ret += '\n'
  }
  ret += '----------\n'
  ret += t`exit code ${code}`
  return ret
}

export async function remoteRun(code: string, actions: Actions): Promise<void> {
  actions.setToolOutput(t`编译中`)
  actions.setProgramOutput(t`运行中`)

  const [data, status] = await requestRemoteAction(code, 'run')

  switch (status) {
    case SandboxStatus.UNKNOWN_ERROR:
      actions.setToolOutput(t`未知错误`)
      actions.setProgramOutput('')
      throw new Error(t`未知错误`)
  }

  actions.setToolOutput(buildOutput(data.compiler_output, data.compiler_code))
  if (data.compiler_code !== 0) {
    actions.setProgramOutput('')
    throw new Error(t`编译失败`)
  }

  actions.setProgramOutput(buildOutput(data.bin_output, data.compiler_code))

  if (data.bin_code !== 0) {
    throw new Error(t`运行失败`)
  }
}
