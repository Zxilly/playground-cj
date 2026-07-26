import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserRunnerClient } from './runner-client'

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
