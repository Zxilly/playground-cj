import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserRunnerClient, RunnerRequestError } from './runner-client'

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), init)
}

describe('browserRunnerClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses a structured run body only when stdin is supplied', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    const controller = new AbortController()

    await browserRunnerClient.run('main() {}', {
      stdin: '',
      signal: controller.signal,
    })

    expect(fetch).toHaveBeenCalledWith('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ code: 'main() {}', stdin: '' }),
      signal: controller.signal,
    })
  })

  it('uses JSON error messages when the gateway rejects a request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(
      { error: 'runner unavailable' },
      { status: 503 },
    ))

    await expect(browserRunnerClient.run('main()')).rejects.toThrow(
      'Remote action failed: runner unavailable',
    )
  })

  it('uses raw text for platform-generated errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('gateway timeout', { status: 504 }),
    )

    await expect(browserRunnerClient.run('main()')).rejects.toThrow(
      'Remote action failed: gateway timeout',
    )
  })

  it('classifies structured HTTP errors including 429 Retry-After, 413, 504, and 503 busy', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Too many requests', code: 'runner_rate_limit_exceeded' },
        { status: 429, headers: { 'Retry-After': '45' } },
      ))
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Too large', code: 'request_body_too_large' },
        { status: 413 },
      ))
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Timed out', code: 'runner_timeout' },
        { status: 504 },
      ))
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Busy', code: 'runner_proxy_busy' },
        { status: 503, headers: { 'Retry-After': '3' } },
      ))

    await expect(browserRunnerClient.run('main()')).rejects.toMatchObject({
      name: 'RunnerRequestError',
      failureKind: 'rate_limited',
      httpStatus: 429,
      retryAfterSeconds: 45,
      errorCode: 'runner_rate_limit_exceeded',
    })

    await expect(browserRunnerClient.run('main()')).rejects.toMatchObject({
      name: 'RunnerRequestError',
      failureKind: 'payload_too_large',
      httpStatus: 413,
    })

    await expect(browserRunnerClient.run('main()')).rejects.toMatchObject({
      name: 'RunnerRequestError',
      failureKind: 'timeout',
      httpStatus: 504,
    })

    await expect(browserRunnerClient.run('main()')).rejects.toMatchObject({
      name: 'RunnerRequestError',
      failureKind: 'service_busy',
      httpStatus: 503,
      retryAfterSeconds: 3,
    })
  })

  it('classifies fetch TypeError as network_error or offline', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    try {
      await browserRunnerClient.run('main()')
      expect.unreachable()
    }
    catch (error) {
      expect(error).toBeInstanceOf(RunnerRequestError)
      expect((error as RunnerRequestError).failureKind).toBe('network_error')
    }
  })

  it('rejects successful responses outside the canonical contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))

    await expect(browserRunnerClient.run('main()')).rejects.toThrow(
      'runner returned an invalid response',
    )
  })
})
