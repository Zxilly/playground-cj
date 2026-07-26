import { afterEach, describe, expect, it, vi } from 'vitest'

const consumeRunnerPermit = vi.hoisted(() => vi.fn(async () => true))
const getRunnerAdmissionGate = vi.hoisted(() => vi.fn(() => ({
  consume: consumeRunnerPermit,
  resolveIdentity: () => 'trusted-client',
  timeoutMs: 2_000,
})))

vi.mock('./runner-admission', () => ({
  getRunnerAdmissionGate,
}))

const {
  proxyToRunner,
  RUNNER_DEPENDENCY_CANCELLATION_GRACE_MS,
  RUNNER_UPSTREAM_TIMEOUT_MS,
} = {
  ...await import('./runner-proxy'),
  ...await import('./runner-dependency-guard'),
}

function runnerRequest(): Request {
  return new Request('https://playground.example/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Origin': 'https://playground.example',
    },
    body: 'main() {}',
  })
}

describe('runner proxy fail-stop boundary', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('reaps a production instance instead of reusing a never-settled fetch slot', async () => {
    vi.useFakeTimers()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CJ_RUNNER_URL', 'https://runner.example')
    vi.stubEnv('CJ_RUNNER_SHARED_TOKEN', '0123456789abcdef0123456789abcdef')
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockImplementation(() => new Promise<Response>(() => {}))

    const pending = proxyToRunner(runnerRequest(), 'run')
    await vi.advanceTimersByTimeAsync(RUNNER_UPSTREAM_TIMEOUT_MS)
    await expect(pending).resolves.toMatchObject({ status: 504 })

    await vi.advanceTimersByTimeAsync(
      RUNNER_DEPENDENCY_CANCELLATION_GRACE_MS,
    )

    expect(exit).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith(1)
    expect(fetch).toHaveBeenCalledOnce()

    const replacement = await proxyToRunner(runnerRequest(), 'run')
    expect(replacement.status).toBe(503)
    await expect(replacement.json()).resolves.toMatchObject({
      code: 'runner_dependency_cancellation_pending',
    })
    expect(fetch).toHaveBeenCalledOnce()
  })
})
