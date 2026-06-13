import type { RemoteRunRequest } from './run-cangjie'
import { describe, expect, it, vi } from 'vitest'
import { runCangjieCode } from './run-cangjie'

describe('runCangjieCode', () => {
  it('maps a successful compile+run into a RunResult', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      compiler_output: '',
      compiler_code: 0,
      bin_output: 'hello\n',
      bin_code: 0,
    })

    const result = await runCangjieCode('main() {}', { request })

    expect(request).toHaveBeenCalledWith('main() {}')
    expect(result).toMatchObject({
      ok: true,
      stdout: 'hello\n',
      stderr: '',
      exitCode: 0,
    })
    expect(result.failureKind).toBeUndefined()
  })

  it('reports ok:false with the compiler output when compilation fails', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      compiler_output: 'syntax error',
      compiler_code: 1,
      bin_output: '',
      bin_code: 0,
    })

    const result = await runCangjieCode('bad', { request })

    expect(result.ok).toBe(false)
    expect(result.stderr).toBe('syntax error')
    expect(result.compilerOutput).toBe('syntax error')
    expect(result.failureKind).toBeUndefined()
  })

  it('reports ok:false when the binary exits non-zero', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      compiler_output: '',
      compiler_code: 0,
      bin_output: 'panic\n',
      bin_code: 2,
    })

    const result = await runCangjieCode('panic', { request })

    expect(result.ok).toBe(false)
    expect(result.stdout).toBe('panic\n')
    expect(result.exitCode).toBe(2)
  })

  it('returns failureKind runner_unavailable when the request throws', async () => {
    const request = vi.fn<RemoteRunRequest>().mockRejectedValue(new Error('network down'))

    const result = await runCangjieCode('main() {}', { request })

    expect(result.ok).toBe(false)
    expect(result.exitCode).toBeNull()
    expect(result.stderr).toBe('network down')
    expect(result.failureKind).toBe('runner_unavailable')
  })

  it('records the elapsed duration', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      compiler_output: '',
      compiler_code: 0,
      bin_output: 'ok',
      bin_code: 0,
    })

    const result = await runCangjieCode('main() {}', { request, now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1042) })

    expect(result.durationMs).toBe(42)
  })
})
