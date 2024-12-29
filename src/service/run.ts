import { BACKEND_URL } from '@/const'

interface SandboxResponse {
  id: string
  ok: boolean
  duration: number
  stdout: string
  stderr: string
}

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

export async function remoteRun(code: string, actions: Actions): Promise<void> {
  actions.setToolOutput('编译中')
  actions.setProgramOutput('运行中')

  const [data, status] = await requestRemoteAction(code, 'run')

  switch (status) {
    case SandboxStatus.UNKNOWN_ERROR:
      actions.setToolOutput('未知错误')
      actions.setProgramOutput('')
      throw new Error('未知错误')
  }

  actions.setToolOutput(data.compiler_output)
  if (data.compiler_code !== 0) {
    actions.setProgramOutput('')
    throw new Error('编译失败')
  }

  actions.setProgramOutput(data.bin_output)

  if (data.bin_code !== 0) {
    throw new Error('运行失败')
  }
}
