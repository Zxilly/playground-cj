import { BACKEND_URL } from '@/const'

interface SandboxResponse {
  id: string
  ok: boolean
  duration: number
  stdout: string
  stderr: string
}

export enum SandboxStatus {
  OK = 0,
  RATE_LIMIT = 1,
  UNKNOWN_ERROR = 2,
}

function getSendPayload(code: string, action: string): string {
  return JSON.stringify({
    sandbox: 'cangjie',
    command: action,
    files: {
      '': code,
    },
  })
}

export async function requestRemoteAction(code: string, action: string): Promise<[SandboxResponse, SandboxStatus]> {
  const resp = await fetch(`${BACKEND_URL}/v1/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: getSendPayload(code, action),
  })

  const data = await resp.json()

  if (resp.ok) {
    return [data, SandboxStatus.OK]
  }
  else {
    if (resp.status === 429) {
      return [data, SandboxStatus.RATE_LIMIT]
    }
    else {
      return [data, SandboxStatus.UNKNOWN_ERROR]
    }
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
    case SandboxStatus.RATE_LIMIT:
      actions.setToolOutput('后端负载过大，请稍后再试')
      actions.setProgramOutput('')
      throw new Error('后端负载过大，请稍后再试')
    case SandboxStatus.UNKNOWN_ERROR:
      actions.setToolOutput('未知错误')
      actions.setProgramOutput('')
      throw new Error('未知错误')
  }

  if (!data.ok) {
    actions.setToolOutput(data.stderr)
    actions.setProgramOutput('')
    throw new Error('编译运行失败')
  }
  else {
    if (data.stderr.length > 0) {
      actions.setToolOutput(data.stderr)
    }
    else {
      actions.setToolOutput('编译运行成功')
    }
    actions.setProgramOutput(data.stdout)
  }
}
