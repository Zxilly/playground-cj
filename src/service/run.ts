interface SandboxResponse {
  id: string
  ok: boolean
  duration: number
  stdout: string
  stderr: string
}

function getSendPayload(code: string, action: string): string {
  return JSON.stringify({
    "sandbox": "cangjie",
    "command": action,
    "files": {
      "": code
    }
  })
}

export async function requestRemoteAction(code: string, action: string): Promise<SandboxResponse> {
  return await fetch("https://cj-api.learningman.top/v1/exec",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: getSendPayload(code, action)
    }
  ).then(res => res.json())
}

type ContentSetter = (content: string) => void

export type Actions = {
  setToolOutput: ContentSetter
  setProgramOutput: ContentSetter
}

export async function remoteRun(code: string, actions: Actions): Promise<void> {
  actions.setToolOutput("Compiling...")
  actions.setProgramOutput("Running...")

  const response = await requestRemoteAction(code, "run")
  if (!response.ok) {
    actions.setToolOutput(response.stderr)
  } else {
    if (response.stderr.length > 0) {
      actions.setToolOutput(response.stderr)
    } else {
      actions.setToolOutput("Compiled successfully")
    }
    actions.setProgramOutput(response.stdout)
  }
}
