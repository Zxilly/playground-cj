import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consumeRunnerPermit = vi.hoisted(() => vi.fn())
const resolveRunnerIdentity = vi.hoisted(() => vi.fn())
const getRunnerAdmissionGate = vi.hoisted(() => vi.fn(() => ({
  consume: consumeRunnerPermit,
  resolveIdentity: resolveRunnerIdentity,
  timeoutMs: 2_000,
})))

vi.mock('./runner-admission', () => ({
  getRunnerAdmissionGate,
}))

const { MAX_RUNNER_OUTPUT_BYTES } = await import('./runner-contract')
const {
  MAX_CONCURRENT_RUNNER_REQUESTS,
  MAX_RUNNER_REQUEST_BYTES,
  MAX_RUNNER_RESPONSE_BYTES,
  MIN_RUNNER_SHARED_TOKEN_BYTES,
  proxyToRunner,
  RUNNER_TOOLCHAIN_LOCK_HEADER,
  RUNNER_TOOLCHAIN_LOCK_SHA256,
  RUNNER_REQUEST_BODY_TIMEOUT_MS,
  RUNNER_TOTAL_TIMEOUT_MS,
  RUNNER_UPSTREAM_TIMEOUT_MS,
} = await import('./runner-proxy')

function runnerRequest(
  body: BodyInit | null = 'main() {}',
  init: Omit<RequestInit, 'body'> = {},
): Request {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type'))
    headers.set('Content-Type', 'text/plain; charset=utf-8')
  if (!headers.has('Origin'))
    headers.set('Origin', 'http://localhost')

  return new Request('http://localhost/api/run', {
    method: 'POST',
    ...init,
    headers,
    body,
  })
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { ...init, headers })
}

describe('proxyToRunner', () => {
  beforeEach(() => {
    vi.stubEnv(
      'CJ_RUNNER_MODAL_URL',
      'https://workspace--runner.modal.run/internal/api/',
    )
    vi.stubEnv('CJ_RUNNER_SHARED_TOKEN', '0123456789abcdef0123456789abcdef')
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_KEY', 'wk-testModalProxyKey')
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_SECRET', 'ws-testModalProxySecret')
    consumeRunnerPermit.mockReset()
    consumeRunnerPermit.mockResolvedValue(true)
    resolveRunnerIdentity.mockReset()
    resolveRunnerIdentity.mockReturnValue('trusted-client')
    getRunnerAdmissionGate.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('does not accept the legacy generic runner configuration', async () => {
    vi.stubEnv('CJ_RUNNER_MODAL_URL', '')
    vi.stubEnv('CJ_RUNNER_URL', 'https://runner.example')
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_not_configured',
      error: expect.stringContaining('CJ_RUNNER_MODAL_URL'),
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects HTTPS runners outside Modal', async () => {
    vi.stubEnv('CJ_RUNNER_MODAL_URL', 'https://runner.example')
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_invalid_configuration',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails closed when the server-side runner URL is missing', async () => {
    vi.stubEnv('CJ_RUNNER_MODAL_URL', '')
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://legacy-public.example')
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_not_configured',
      error: expect.stringContaining('CJ_RUNNER_MODAL_URL'),
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'not a URL',
    'ftp://runner.example',
    'http://runner.example',
    'https://user:secret@runner.example',
    'https://runner.example?token=secret',
  ])('rejects an unsafe runner URL configuration: %s', async (url) => {
    vi.stubEnv('CJ_RUNNER_MODAL_URL', url)
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_invalid_configuration',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('forwards a bounded text request to the configured action and propagates cancellation', async () => {
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
    const request = runnerRequest('main() {}', { signal: controller.signal })

    const response = await proxyToRunner(request, 'run')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ bin_stdout: 'ok' })
    expect(fetch).toHaveBeenCalledOnce()
    const [input, init] = fetch.mock.calls[0]
    expect(String(input)).toBe(
      'https://workspace--runner.modal.run/internal/api/run',
    )
    expect(init).toMatchObject({
      method: 'POST',
      body: 'main() {}',
      redirect: 'error',
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(init?.signal?.aborted).toBe(false)
    expect(new Headers(init?.headers).get('content-type')).toBe('text/plain; charset=utf-8')
    expect(new Headers(init?.headers).get('authorization'))
      .toBe('Bearer 0123456789abcdef0123456789abcdef')
    expect(new Headers(init?.headers).get('modal-key'))
      .toBe('wk-testModalProxyKey')
    expect(new Headers(init?.headers).get('modal-secret'))
      .toBe('ws-testModalProxySecret')
    expect(new Headers(init?.headers).get(RUNNER_TOOLCHAIN_LOCK_HEADER))
      .toBe(RUNNER_TOOLCHAIN_LOCK_SHA256)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('requires and forwards Modal proxy authentication for Modal endpoints', async () => {
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_KEY', '')
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_SECRET', '')
    const fetch = vi.spyOn(globalThis, 'fetch')

    const missing = await proxyToRunner(runnerRequest(), 'run')
    expect(missing.status).toBe(503)
    await expect(missing.json()).resolves.toMatchObject({
      code: 'runner_invalid_modal_auth_configuration',
    })
    expect(fetch).not.toHaveBeenCalled()

    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_KEY', 'wk-testModalProxyKey')
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_SECRET', 'ws-testModalProxySecret')
    fetch.mockResolvedValue(jsonResponse({
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

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(200)
    const headers = new Headers(fetch.mock.calls[0][1]?.headers)
    expect(headers.get('modal-key')).toBe('wk-testModalProxyKey')
    expect(headers.get('modal-secret')).toBe('ws-testModalProxySecret')
  })

  it('rejects incomplete Modal proxy authentication', async () => {
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_KEY', 'wk-testModalProxyKey')
    vi.stubEnv('CJ_RUNNER_MODAL_PROXY_SECRET', '')
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_invalid_modal_auth_configuration',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves a runner toolchain mismatch as a deployment failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      code: 'runner_toolchain_mismatch',
      error: 'Runner toolchain does not match the requesting deployment.',
    }, {
      status: 503,
      headers: {
        'X-Playground-Cangjie-Toolchain-Status': 'mismatch',
      },
    }))

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_toolchain_mismatch',
      upstreamStatus: 503,
    })
  })

  it('fails closed on a missing or invalid service token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')

    vi.stubEnv('CJ_RUNNER_SHARED_TOKEN', '')
    const missing = await proxyToRunner(runnerRequest(), 'run')
    expect(missing.status).toBe(503)
    await expect(missing.json()).resolves.toMatchObject({
      code: 'runner_invalid_auth_configuration',
    })

    vi.stubEnv('CJ_RUNNER_SHARED_TOKEN', 'x'.repeat(MIN_RUNNER_SHARED_TOKEN_BYTES - 1))
    const invalid = await proxyToRunner(runnerRequest(), 'run')
    expect(invalid.status).toBe(503)
    await expect(invalid.json()).resolves.toMatchObject({
      code: 'runner_invalid_auth_configuration',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not allow a development token escape hatch', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CJ_RUNNER_SHARED_TOKEN', '')
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_invalid_auth_configuration',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects cross-origin browser requests before spending runner capacity', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const request = runnerRequest('main() {}', {
      headers: {
        'Content-Type': 'text/plain',
        'Origin': 'https://attacker.example',
        'Sec-Fetch-Site': 'cross-site',
      },
    })

    const response = await proxyToRunner(request, 'run')

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'cross_origin_request_rejected',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('applies distributed admission before reading or validating the request body', async () => {
    consumeRunnerPermit.mockResolvedValue(false)
    const fetch = vi.spyOn(globalThis, 'fetch')
    let settleCancellation: (() => void) | undefined
    const cancelRequestBody = vi.fn(() => new Promise<void>((resolve) => {
      settleCancellation = resolve
    }))
    const request = new Request('https://playground.example/api/run', {
      method: 'POST',
      headers: {
        'Content-Length': String(MAX_RUNNER_REQUEST_BYTES + 1),
        'Content-Type': 'text/plain',
        'Origin': 'https://playground.example',
      },
      body: new ReadableStream<Uint8Array>({
        cancel: cancelRequestBody,
      }),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    const response = await proxyToRunner(request, 'run')

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_rate_limit_exceeded',
    })
    expect(cancelRequestBody).toHaveBeenCalledOnce()
    expect(resolveRunnerIdentity).toHaveBeenCalledWith(request.headers)
    expect(consumeRunnerPermit).toHaveBeenCalledWith(
      'trusted-client',
      expect.any(AbortSignal),
    )
    expect(fetch).not.toHaveBeenCalled()

    const paused = await proxyToRunner(runnerRequest(), 'run')
    expect(paused.status).toBe(503)
    await expect(paused.json()).resolves.toMatchObject({
      code: 'runner_dependency_cancellation_pending',
    })
    settleCancellation?.()
    await Promise.resolve()
  })

  it('fails closed before reading the body when admission configuration is unavailable', async () => {
    getRunnerAdmissionGate.mockImplementationOnce(() => {
      throw new Error('missing trusted proxy or Redis configuration')
    })
    const fetch = vi.spyOn(globalThis, 'fetch')
    const response = await proxyToRunner(runnerRequest('small', {
      headers: {
        'Content-Length': String(MAX_RUNNER_REQUEST_BYTES + 1),
        'Content-Type': 'text/plain',
      },
    }), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_admission_unavailable',
    })
    expect(resolveRunnerIdentity).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails closed when trusted infrastructure does not provide an identity', async () => {
    resolveRunnerIdentity.mockImplementationOnce(() => {
      throw new Error('trusted client identity is unavailable')
    })
    const fetch = vi.spyOn(globalThis, 'fetch')
    const response = await proxyToRunner(runnerRequest('small', {
      headers: {
        'Content-Length': String(MAX_RUNNER_REQUEST_BYTES + 1),
        'Content-Type': 'text/plain',
      },
    }), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_admission_unavailable',
    })
    expect(consumeRunnerPermit).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns service unavailable when the distributed admission backend fails', async () => {
    consumeRunnerPermit.mockRejectedValueOnce(new Error('Redis unavailable'))
    const fetch = vi.spyOn(globalThis, 'fetch')
    const response = await proxyToRunner(runnerRequest('small', {
      headers: {
        'Content-Length': String(MAX_RUNNER_REQUEST_BYTES + 1),
        'Content-Type': 'text/plain',
      },
    }), 'run')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'runner_admission_unavailable',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns when distributed admission exceeds its deadline even if Redis ignores abort', async () => {
    vi.useFakeTimers()
    let settlePermit: ((value: boolean) => void) | undefined
    consumeRunnerPermit.mockImplementation(() => new Promise<boolean>((resolve) => {
      settlePermit = resolve
    }))
    const fetch = vi.spyOn(globalThis, 'fetch')
    let response: Response | undefined
    const pending = proxyToRunner(runnerRequest(), 'run').then((value) => {
      response = value
      return value
    })

    await vi.advanceTimersByTimeAsync(2_000)
    await Promise.resolve()

    const statusAtDeadline = response?.status
    settlePermit?.(true)
    await pending
    expect(statusAtDeadline).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('retains local slots until timed-out distributed admission calls actually settle', async () => {
    vi.useFakeTimers()
    const settlePermits: Array<(value: boolean) => void> = []
    consumeRunnerPermit.mockImplementation(() => new Promise<boolean>((resolve) => {
      settlePermits.push(resolve)
    }))
    const fetch = vi.spyOn(globalThis, 'fetch')
    const pending = Array.from(
      { length: MAX_CONCURRENT_RUNNER_REQUESTS },
      () => proxyToRunner(runnerRequest(), 'run'),
    )
    await vi.advanceTimersByTimeAsync(2_000)

    const timedOut = await Promise.all(pending)
    expect(timedOut.every(response => response.status === 503)).toBe(true)

    const stillBusy = await proxyToRunner(runnerRequest(), 'run')
    expect(stillBusy.status).toBe(503)
    expect(consumeRunnerPermit).toHaveBeenCalledTimes(
      MAX_CONCURRENT_RUNNER_REQUESTS,
    )

    for (const settle of settlePermits)
      settle(true)
    await Promise.resolve()
    consumeRunnerPermit.mockResolvedValue(true)
    fetch.mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))

    await expect(proxyToRunner(runnerRequest(), 'run')).resolves.toMatchObject({
      status: 200,
    })
  })

  it('requires browser same-origin evidence even when Origin metadata is absent', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const request = new Request('http://localhost/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'main() {}',
    })

    const response = await proxyToRunner(request, 'run')

    expect(response.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('accepts a structured run request with code and stdin', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '3',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    const body = JSON.stringify({ code: 'main() {}', stdin: '1 2\n' })

    const response = await proxyToRunner(runnerRequest(body, {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    }), 'run')

    expect(response.status).toBe(200)
    expect(fetch.mock.calls[0][1]?.body).toBe(body)
  })

  it('rejects unsupported methods and media types before contacting the runner', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')

    const methodResponse = await proxyToRunner(new Request('http://localhost/api/run'), 'run')
    const missingTypeResponse = await proxyToRunner(new Request('http://localhost/api/run', {
      method: 'POST',
      body: new Uint8Array([1]),
    }), 'run')
    const unsupportedParameterResponse = await proxyToRunner(runnerRequest(
      'main() {}',
      { headers: { 'Content-Type': 'text/plain; profile=unsafe' } },
    ), 'run')

    expect(methodResponse.status).toBe(405)
    expect(methodResponse.headers.get('allow')).toBe('POST')
    expect(missingTypeResponse.status).toBe(415)
    expect(unsupportedParameterResponse.status).toBe(415)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'text/plain; charset="utf-8',
    'text/plain; charset=utf-8"',
  ])('rejects a malformed quoted charset: %s', async (contentType) => {
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest('main() {}', {
      headers: { 'Content-Type': contentType },
    }), 'run')

    expect(response.status).toBe(415)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    '{',
    '[]',
    JSON.stringify({ stdin: '' }),
    JSON.stringify({ code: 42 }),
    JSON.stringify({ code: 'main() {}', stdin: null }),
    JSON.stringify({ code: 'main() {}', unvalidated: true }),
  ])('rejects an invalid JSON run body: %s', async (body) => {
    const fetch = vi.spyOn(globalThis, 'fetch')

    const response = await proxyToRunner(runnerRequest(body, {
      headers: { 'Content-Type': 'application/json' },
    }), 'run')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_json_body' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an oversized declared Content-Length without reading the body', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const cancelRequestBody = vi.fn()
    const request = new Request('https://playground.example/api/run', {
      method: 'POST',
      headers: {
        'Content-Length': String(MAX_RUNNER_REQUEST_BYTES + 1),
        'Content-Type': 'text/plain',
        'Origin': 'https://playground.example',
      },
      body: new ReadableStream<Uint8Array>({
        cancel: cancelRequestBody,
      }),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    const response = await proxyToRunner(request, 'run')

    expect(response.status).toBe(413)
    expect(cancelRequestBody).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('enforces the byte limit when Content-Length is absent or incorrect', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const response = await proxyToRunner(
      runnerRequest('x'.repeat(MAX_RUNNER_REQUEST_BYTES + 1)),
      'run',
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ code: 'request_body_too_large' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('enforces the byte limit across a segmented streaming body', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const chunks = [
      new Uint8Array(MAX_RUNNER_REQUEST_BYTES / 2),
      new Uint8Array(MAX_RUNNER_REQUEST_BYTES / 2),
      new Uint8Array([1]),
    ]
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift()
        if (chunk)
          controller.enqueue(chunk)
        else
          controller.close()
      },
    })

    const response = await proxyToRunner(runnerRequest(body, {
      ...({ duplex: 'half' } as RequestInit),
    }), 'run')

    expect(response.status).toBe(413)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects request bodies that are not valid UTF-8', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const response = await proxyToRunner(runnerRequest(
      new Uint8Array([0xC3, 0x28]),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    ), 'run')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_utf8' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('bounds slow request-body reads with the same global request slot', async () => {
    vi.useFakeTimers()
    const fetch = vi.spyOn(globalThis, 'fetch')
    const slowBody = () => new ReadableStream<Uint8Array>({ start: () => undefined })
    const pending = Array.from(
      { length: MAX_CONCURRENT_RUNNER_REQUESTS },
      () => proxyToRunner(runnerRequest(slowBody(), {
        // Node's Request implementation requires this for streaming bodies.
        ...({ duplex: 'half' } as RequestInit),
      }), 'run'),
    )
    await vi.advanceTimersByTimeAsync(0)

    const overloaded = await proxyToRunner(runnerRequest(), 'run')
    expect(overloaded.status).toBe(503)

    await vi.advanceTimersByTimeAsync(RUNNER_REQUEST_BODY_TIMEOUT_MS)
    const responses = await Promise.all(pending)
    expect(responses.every(response => response.status === 408)).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('retains local slots until timed-out request-body cancellation actually settles', async () => {
    vi.useFakeTimers()
    const settleCancellations: Array<() => void> = []
    const slowBody = () => new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => {}),
      cancel: () => new Promise<void>((resolve) => {
        settleCancellations.push(resolve)
      }),
    })
    const fetch = vi.spyOn(globalThis, 'fetch')
    const pending = Array.from(
      { length: MAX_CONCURRENT_RUNNER_REQUESTS },
      () => proxyToRunner(runnerRequest(slowBody(), {
        ...({ duplex: 'half' } as RequestInit),
      }), 'run'),
    )
    await vi.advanceTimersByTimeAsync(RUNNER_REQUEST_BODY_TIMEOUT_MS)
    const timedOut = await Promise.all(pending)
    expect(timedOut.every(response => response.status === 408)).toBe(true)

    const stillBusy = await proxyToRunner(runnerRequest(), 'run')
    expect(stillBusy.status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()

    for (const settle of settleCancellations)
      settle()
  })

  it('does not expose network error details to the client', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('connect ECONNREFUSED https://runner.internal/?token=secret'),
    )

    const response = await proxyToRunner(runnerRequest(), 'run')
    const body = await response.text()

    expect(response.status).toBe(502)
    expect(body).toContain('runner_unreachable')
    expect(body).not.toContain('runner.internal')
    expect(body).not.toContain('secret')
    expect(log).toHaveBeenCalled()
  })

  it('preserves an upstream error signal without proxying its sensitive body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      'database password: super-secret',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain',
          'Retry-After': '2',
        },
      },
    ))

    const response = await proxyToRunner(runnerRequest(), 'run')
    const body = await response.text()

    expect(response.status).toBe(502)
    expect(response.headers.get('retry-after')).toBe('2')
    expect(body).toContain('"upstreamStatus":503')
    expect(body).not.toContain('super-secret')
  })

  it('rejects a successful upstream response with an unexpected media type', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>proxy login</html>', {
      headers: { 'Content-Type': 'text/html' },
    }))

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_runner_response' })
  })

  it('accepts only the exact canonical fields in successful upstream payloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: 'ok',
        bin_stdout_truncated: false,
        bin_stderr: 'warning',
        bin_stderr_truncated: false,
        bin_code: 0,
      }))
      .mockResolvedValueOnce(jsonResponse({
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: '0',
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
      }))

    const runResponse = await proxyToRunner(runnerRequest(), 'run')
    const invalidResponse = await proxyToRunner(runnerRequest(), 'run')

    await expect(runResponse.json()).resolves.toEqual({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stdout_truncated: false,
      bin_stderr: 'warning',
      bin_stderr_truncated: false,
      bin_code: 0,
    })
    expect(invalidResponse.status).toBe(502)
    await expect(invalidResponse.json()).resolves.toMatchObject({ code: 'invalid_runner_response' })
  })

  it('preserves an explicit compile failure without inventing a binary exit code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'compile',
      compiler_output: 'syntax error',
      compiler_output_truncated: false,
      compiler_code: 1,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: null,
    }))

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      phase: 'compile',
      compiler_output: 'syntax error',
      compiler_output_truncated: false,
      compiler_code: 1,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: null,
    })
  })

  it.each([
    {
      name: 'unexpected field',
      payload: {
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
        internal_token: 'must-not-leak',
      },
    },
    {
      name: 'missing phase',
      payload: {
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
      },
    },
    {
      name: 'compile phase with a binary exit code',
      payload: {
        phase: 'compile',
        compiler_output: 'syntax error',
        compiler_output_truncated: false,
        compiler_code: 1,
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
      },
    },
    {
      name: 'run phase with a failed compiler',
      payload: {
        phase: 'run',
        compiler_output: 'syntax error',
        compiler_output_truncated: false,
        compiler_code: 1,
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 1,
      },
    },
    {
      name: 'legacy combined runtime output',
      payload: {
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_output: 'stdout and stderr merged',
        bin_code: 0,
      },
    },
  ])('rejects a contradictory runner phase: $name', async ({ payload }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload))

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_runner_response',
    })
  })

  it('enforces the domain output budget at the runner trust boundary', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: 'x'.repeat(MAX_RUNNER_OUTPUT_BYTES),
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
      }))
      .mockResolvedValueOnce(jsonResponse({
        phase: 'run',
        compiler_output: '\0'.repeat(MAX_RUNNER_OUTPUT_BYTES),
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: '\0'.repeat(MAX_RUNNER_OUTPUT_BYTES),
        bin_stdout_truncated: false,
        bin_stderr: '\0'.repeat(MAX_RUNNER_OUTPUT_BYTES),
        bin_stderr_truncated: false,
        bin_code: 0,
      }))
      .mockResolvedValueOnce(jsonResponse({
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: 'x'.repeat(MAX_RUNNER_OUTPUT_BYTES + 1),
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
      }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const exactBoundary = await proxyToRunner(runnerRequest(), 'run')
    const escapedBoundary = await proxyToRunner(runnerRequest(), 'run')
    const oversized = await proxyToRunner(runnerRequest(), 'run')

    expect(exactBoundary.status).toBe(200)
    expect((await exactBoundary.json()).bin_stdout).toHaveLength(MAX_RUNNER_OUTPUT_BYTES)
    expect(escapedBoundary.status).toBe(200)
    const escapedPayload = await escapedBoundary.json()
    expect(escapedPayload.compiler_output).toHaveLength(MAX_RUNNER_OUTPUT_BYTES)
    expect(escapedPayload.bin_stdout).toHaveLength(MAX_RUNNER_OUTPUT_BYTES)
    expect(escapedPayload.bin_stderr).toHaveLength(MAX_RUNNER_OUTPUT_BYTES)
    expect(oversized.status).toBe(502)
    await expect(oversized.json()).resolves.toMatchObject({
      code: 'invalid_runner_response',
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('bounds successful upstream response bodies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {
      headers: {
        'Content-Length': String(MAX_RUNNER_RESPONSE_BYTES + 1),
        'Content-Type': 'application/json',
      },
    }))

    const response = await proxyToRunner(runnerRequest(), 'run')

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ code: 'invalid_runner_response' })
  })

  it('cancels the upstream fetch when the incoming request is aborted', async () => {
    const controller = new AbortController()
    const request = runnerRequest('main() {}', { signal: controller.signal })
    let markFetchStarted: (() => void) | undefined
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    let upstreamSignal: AbortSignal | null | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => (
      new Promise((_resolve, reject) => {
        upstreamSignal = init?.signal
        markFetchStarted?.()
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        }, { once: true })
      })
    ))

    const pendingResponse = proxyToRunner(request, 'run')
    await fetchStarted
    controller.abort()
    const response = await pendingResponse

    expect(upstreamSignal?.aborted).toBe(true)
    expect(response.status).toBe(499)
    await expect(response.json()).resolves.toMatchObject({ code: 'request_aborted' })
  })

  it('bounds upstream execution with a server-owned timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => (
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason)
        }, { once: true })
      })
    ))

    const pendingResponse = proxyToRunner(runnerRequest(), 'run')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(RUNNER_UPSTREAM_TIMEOUT_MS)
    const response = await pendingResponse

    expect(response.status).toBe(504)
    await expect(response.json()).resolves.toMatchObject({ code: 'runner_timeout' })
  })

  it('pauses admission while an abort-ignoring fetch is still cancelling, then recovers', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let settleFetch: ((response: Response) => void) | undefined
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        settleFetch = resolve
      }))
    let response: Response | undefined
    const pending = proxyToRunner(runnerRequest(), 'run').then((value) => {
      response = value
      return value
    })

    await vi.advanceTimersByTimeAsync(RUNNER_UPSTREAM_TIMEOUT_MS)
    await Promise.resolve()

    const statusAtDeadline = response?.status
    fetch.mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    const paused = await proxyToRunner(runnerRequest(), 'run')
    expect(paused.status).toBe(503)
    await expect(paused.json()).resolves.toMatchObject({
      code: 'runner_dependency_cancellation_pending',
    })
    expect(fetch).toHaveBeenCalledOnce()

    settleFetch?.(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    await pending
    expect(statusAtDeadline).toBe(504)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await expect(proxyToRunner(runnerRequest(), 'run')).resolves.toMatchObject({
      status: 200,
    })
  })

  it('enforces one total deadline across request-body and upstream work', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const slowBody = new ReadableStream<Uint8Array>({
      start(controller) {
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode('main() {}'))
          controller.close()
        }, RUNNER_REQUEST_BODY_TIMEOUT_MS - 100)
      },
    })
    let settleFetch: ((response: Response) => void) | undefined
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => {
        settleFetch = resolve
      }),
    )
    const pending = proxyToRunner(runnerRequest(slowBody, {
      ...({ duplex: 'half' } as RequestInit),
    }), 'run')

    await vi.advanceTimersByTimeAsync(RUNNER_REQUEST_BODY_TIMEOUT_MS - 100)
    expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(
      RUNNER_TOTAL_TIMEOUT_MS - RUNNER_REQUEST_BODY_TIMEOUT_MS + 100,
    )

    expect((await pending).status).toBe(504)
    settleFetch?.(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    await Promise.resolve()
    await Promise.resolve()
  })

  it('returns on the upstream deadline when response-body reads ignore abort', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let settleCancellation: (() => void) | undefined
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
        cancel: () => new Promise<void>((resolve) => {
          settleCancellation = resolve
        }),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    ))
    let response: Response | undefined
    const pending = proxyToRunner(runnerRequest(), 'run').then((value) => {
      response = value
      return value
    })

    await vi.advanceTimersByTimeAsync(RUNNER_UPSTREAM_TIMEOUT_MS)
    await Promise.resolve()

    const statusAtDeadline = response?.status
    settleCancellation?.()
    expect((await pending).status).toBe(504)
    expect(statusAtDeadline).toBe(504)
  })

  it('retains local slots until timed-out response-body cancellation settles', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const settleCancellations: Array<() => void> = []
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => (
      Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
        cancel: () => new Promise<void>((resolve) => {
          settleCancellations.push(resolve)
        }),
      }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    ))
    const pending = Array.from(
      { length: MAX_CONCURRENT_RUNNER_REQUESTS },
      () => proxyToRunner(runnerRequest(), 'run'),
    )
    await vi.advanceTimersByTimeAsync(RUNNER_UPSTREAM_TIMEOUT_MS)
    const timedOut = await Promise.all(pending)
    expect(timedOut.every(response => response.status === 504)).toBe(true)
    expect((await proxyToRunner(runnerRequest(), 'run')).status).toBe(503)

    for (const settle of settleCancellations)
      settle()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    fetch.mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    await expect(proxyToRunner(runnerRequest(), 'run')).resolves.toMatchObject({
      status: 200,
    })
  })

  it('retains local slots through late fetch settlement and response-body cancellation', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const settleFetches: Array<(response: Response) => void> = []
    const settleCancellations: Array<() => void> = []
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => {
        settleFetches.push(resolve)
      }),
    )
    const pending = Array.from(
      { length: MAX_CONCURRENT_RUNNER_REQUESTS },
      () => proxyToRunner(runnerRequest(), 'run'),
    )
    await vi.advanceTimersByTimeAsync(RUNNER_UPSTREAM_TIMEOUT_MS)
    const timedOut = await Promise.all(pending)
    expect(timedOut.every(response => response.status === 504)).toBe(true)

    expect((await proxyToRunner(runnerRequest(), 'run')).status).toBe(503)
    expect(fetch).toHaveBeenCalledTimes(MAX_CONCURRENT_RUNNER_REQUESTS)

    for (const settle of settleFetches) {
      settle(new Response(new ReadableStream<Uint8Array>({
        cancel: () => new Promise<void>((resolve) => {
          settleCancellations.push(resolve)
        }),
      }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    }
    await vi.waitFor(() => {
      expect(settleCancellations).toHaveLength(MAX_CONCURRENT_RUNNER_REQUESTS)
    })

    expect((await proxyToRunner(runnerRequest(), 'run')).status).toBe(503)
    for (const settle of settleCancellations)
      settle()
    await vi.waitFor(() => {
      expect(settleCancellations).toHaveLength(MAX_CONCURRENT_RUNNER_REQUESTS)
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    fetch.mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    await expect(proxyToRunner(runnerRequest(), 'run')).resolves.toMatchObject({
      status: 200,
    })
  })

  it('applies a per-process concurrency bulkhead and releases slots afterward', async () => {
    const responseBodies: Array<ReadableStreamDefaultController<Uint8Array>> = []
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => (
      Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          responseBodies.push(controller)
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    ))

    const pending = Array.from(
      { length: MAX_CONCURRENT_RUNNER_REQUESTS },
      (_, index) => proxyToRunner(runnerRequest(`main() { ${index} }`), 'run'),
    )
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(MAX_CONCURRENT_RUNNER_REQUESTS)
    })

    const overloaded = await proxyToRunner(runnerRequest('main() { 99 }'), 'run')
    expect(overloaded.status).toBe(503)
    expect(overloaded.headers.get('retry-after')).toBe('1')

    for (const responseBody of responseBodies) {
      responseBody.enqueue(new TextEncoder().encode(JSON.stringify({
        phase: 'run',
        compiler_output: '',
        compiler_output_truncated: false,
        compiler_code: 0,
        bin_stdout: '',
        bin_stdout_truncated: false,
        bin_stderr: '',
        bin_stderr_truncated: false,
        bin_code: 0,
      })))
      responseBody.close()
    }
    await Promise.all(pending)

    fetch.mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    await expect(proxyToRunner(runnerRequest(), 'run')).resolves.toMatchObject({ status: 200 })
  })
})
