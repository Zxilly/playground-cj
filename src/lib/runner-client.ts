import type { RunnerRunResponse } from './runner-contract'
import { parseRunnerRunResponse } from './runner-contract'

export interface RunnerRunOptions {
  stdin?: string
  signal?: AbortSignal
}

export interface RunnerClient {
  run: (code: string, options?: RunnerRunOptions) => Promise<RunnerRunResponse>
}

async function readRunnerError(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const payload: unknown = JSON.parse(text)
    if (
      typeof payload === 'object'
      && payload !== null
      && 'error' in payload
      && typeof payload.error === 'string'
    ) {
      return payload.error
    }
  }
  catch {
    // The same-origin gateway may return a platform-generated text response.
  }
  return text
}

async function requestRunner(
  code: string,
  options?: RunnerRunOptions,
): Promise<RunnerRunResponse> {
  const hasStdin = options?.stdin !== undefined
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': hasStdin
        ? 'application/json; charset=utf-8'
        : 'text/plain; charset=utf-8',
    },
    body: hasStdin
      ? JSON.stringify({ code, stdin: options.stdin })
      : code,
    signal: options?.signal,
  })

  if (!response.ok) {
    throw new Error(`Remote action failed: ${await readRunnerError(response)}`)
  }

  const payload: unknown = await response.json()
  const parsed = parseRunnerRunResponse(payload)
  if (!parsed)
    throw new Error('Remote action failed: runner returned an invalid response')
  return parsed
}

export const browserRunnerClient: RunnerClient = {
  run: (code, options) => requestRunner(code, options),
}
