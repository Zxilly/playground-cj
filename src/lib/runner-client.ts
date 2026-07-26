import type {
  RunnerFormatResponse,
  RunnerRunResponse,
} from './runner-contract'
import {
  parseRunnerFormatResponse,
  parseRunnerRunResponse,
} from './runner-contract'

export interface RunnerRunOptions {
  stdin?: string
  signal?: AbortSignal
}

export interface RunnerRequestOptions {
  signal?: AbortSignal
}

export interface RunnerClient {
  run: (code: string, options?: RunnerRunOptions) => Promise<RunnerRunResponse>
  format: (code: string, options?: RunnerRequestOptions) => Promise<RunnerFormatResponse>
}

type RunnerAction = 'run' | 'format'

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
  action: 'run',
  code: string,
  options?: RunnerRunOptions,
): Promise<RunnerRunResponse>
async function requestRunner(
  action: 'format',
  code: string,
  options?: RunnerRequestOptions,
): Promise<RunnerFormatResponse>
async function requestRunner(
  action: RunnerAction,
  code: string,
  options?: RunnerRunOptions,
): Promise<RunnerRunResponse | RunnerFormatResponse> {
  const hasStdin = action === 'run' && options?.stdin !== undefined
  const response = await fetch(`/api/${action}`, {
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
  const parsed = action === 'run'
    ? parseRunnerRunResponse(payload)
    : parseRunnerFormatResponse(payload)
  if (!parsed)
    throw new Error('Remote action failed: runner returned an invalid response')
  return parsed
}

export const browserRunnerClient: RunnerClient = {
  run: (code, options) => requestRunner('run', code, options),
  format: (code, options) => requestRunner('format', code, options),
}
