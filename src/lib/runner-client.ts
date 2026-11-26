import type { RunnerRunResponse } from './runner-contract'
import { parseRunnerRunResponse } from './runner-contract'

export type RunFailureKind
  = | 'runner_unavailable'
    | 'rate_limited'
    | 'payload_too_large'
    | 'timeout'
    | 'service_busy'
    | 'offline'
    | 'network_error'

export interface RunnerRunOptions {
  stdin?: string
  signal?: AbortSignal
}

export interface RunnerClient {
  run: (code: string, options?: RunnerRunOptions) => Promise<RunnerRunResponse>
}

export interface RunnerRequestErrorOptions {
  failureKind: RunFailureKind
  detail?: string
  httpStatus?: number
  retryAfterSeconds?: number
  errorCode?: string
  cause?: unknown
}

export class RunnerRequestError extends Error {
  readonly failureKind: RunFailureKind
  readonly detail: string
  readonly httpStatus?: number
  readonly retryAfterSeconds?: number
  readonly errorCode?: string

  constructor(message: string, options: RunnerRequestErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'RunnerRequestError'
    this.failureKind = options.failureKind
    this.detail = options.detail ?? message
    this.httpStatus = options.httpStatus
    this.retryAfterSeconds = options.retryAfterSeconds
    this.errorCode = options.errorCode
  }
}

interface ParsedRunnerError {
  detail: string
  errorCode?: string
}

async function readRunnerError(response: Response): Promise<ParsedRunnerError> {
  const text = await response.text()
  try {
    const payload: unknown = JSON.parse(text)
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>
      const detail = typeof record.error === 'string' ? record.error : text
      const errorCode = typeof record.code === 'string' ? record.code : undefined
      return { detail, errorCode }
    }
  }
  catch {
    // The same-origin gateway may return a platform-generated text response.
  }
  return { detail: text }
}

export function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header)
    return undefined
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
  }
  const timestamp = Date.parse(trimmed)
  if (!Number.isNaN(timestamp)) {
    const deltaSeconds = Math.ceil((timestamp - Date.now()) / 1000)
    return deltaSeconds > 0 ? deltaSeconds : undefined
  }
  return undefined
}

export function classifyRunnerHttpFailure(
  status: number,
  errorCode?: string,
  retryAfterSeconds?: number,
): RunFailureKind {
  if (status === 429 || errorCode === 'runner_rate_limit_exceeded')
    return 'rate_limited'
  if (status === 413 || errorCode === 'request_body_too_large')
    return 'payload_too_large'
  if (
    status === 504
    || status === 408
    || errorCode === 'runner_timeout'
    || errorCode === 'request_body_timeout'
  ) {
    return 'timeout'
  }
  if (
    status === 503
    && (
      errorCode === 'runner_proxy_busy'
      || errorCode === 'runner_dependency_cancellation_pending'
      || retryAfterSeconds !== undefined
    )
  ) {
    return 'service_busy'
  }
  return 'runner_unavailable'
}

async function requestRunner(
  code: string,
  options?: RunnerRunOptions,
): Promise<RunnerRunResponse> {
  const hasStdin = options?.stdin !== undefined
  let response: Response
  try {
    response = await fetch('/api/run', {
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
  }
  catch (error) {
    if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
      throw error
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const detail = error instanceof Error ? error.message : 'Browser is offline'
      throw new RunnerRequestError(detail, {
        failureKind: 'offline',
        detail,
        cause: error,
      })
    }
    if (error instanceof TypeError) {
      throw new RunnerRequestError(error.message, {
        failureKind: 'network_error',
        detail: error.message,
        cause: error,
      })
    }
    throw error
  }

  if (!response.ok) {
    const { detail, errorCode } = await readRunnerError(response)
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'))
    const failureKind = classifyRunnerHttpFailure(response.status, errorCode, retryAfterSeconds)
    throw new RunnerRequestError(`Remote action failed: ${detail}`, {
      failureKind,
      detail,
      httpStatus: response.status,
      retryAfterSeconds,
      errorCode,
    })
  }

  const payload: unknown = await response.json()
  const parsed = parseRunnerRunResponse(payload)
  if (!parsed) {
    throw new RunnerRequestError('Remote action failed: runner returned an invalid response', {
      failureKind: 'runner_unavailable',
      detail: 'runner returned an invalid response',
      httpStatus: response.status,
    })
  }
  return parsed
}

export const browserRunnerClient: RunnerClient = {
  run: (code, options) => requestRunner(code, options),
}
