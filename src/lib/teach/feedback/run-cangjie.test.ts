import type { RemoteRunRequest } from './run-cangjie'
import { describe, expect, it, vi } from 'vitest'
import { runCangjieCode } from './run-cangjie'

describe('runCangjieCode', () => {
  it('maps a successful compile+run into a RunResult', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'hello\n',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    })

    const result = await runCangjieCode('main() {}', { request })

    expect(request).toHaveBeenCalledWith('main() {}', { stdin: undefined, signal: undefined })
    expect(result).toMatchObject({
      ok: true,
      phase: 'run',
      stdout: 'hello\n',
      stdoutTruncated: false,
      stderr: '',
      stderrTruncated: false,
      compilerOutput: '',
      compilerOutputTruncated: false,
      exitCode: 0,
    })
    expect(result.failureKind).toBeUndefined()
  })

  it('reports ok:false with the compiler output when compilation fails', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
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

    const result = await runCangjieCode('bad', { request })

    expect(result.ok).toBe(false)
    expect(result.phase).toBe('compile')
    expect(result.exitCode).toBeNull()
    expect(result.stderr).toBe('')
    expect(result.stderrTruncated).toBe(false)
    expect(result.compilerOutput).toBe('syntax error')
    expect(result.compilerOutputTruncated).toBe(false)
    expect(result.failureKind).toBeUndefined()
  })

  it('reports ok:false when the binary exits non-zero', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'partial stdout\n',
      bin_stdout_truncated: false,
      bin_stderr: 'panic\n',
      bin_stderr_truncated: false,
      bin_code: 2,
    })

    const result = await runCangjieCode('panic', { request })

    expect(result.ok).toBe(false)
    expect(result.phase).toBe('run')
    expect(result.stdout).toBe('partial stdout\n')
    expect(result.stderr).toBe('panic\n')
    expect(result.compilerOutput).toBe('')
    expect(result.exitCode).toBe(2)
  })

  it('returns failureKind runner_unavailable when the request throws', async () => {
    const request = vi.fn<RemoteRunRequest>().mockRejectedValue(new Error('network down'))

    const result = await runCangjieCode('main() {}', { request })

    expect(result.ok).toBe(false)
    expect(result.phase).toBeNull()
    expect(result.exitCode).toBeNull()
    expect(result.stderr).toBe('')
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
    expect(result.compilerOutput).toBe('')
    expect(result.compilerOutputTruncated).toBe(false)
    expect(result.failureKind).toBe('runner_unavailable')
    expect(result.failureMessage).toBe('network down')
  })

  it('preserves each upstream truncation fact out of band', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      phase: 'run',
      compiler_output: 'compiler prefix',
      compiler_output_truncated: true,
      compiler_code: 0,
      bin_stdout: 'expected suffix omitted',
      bin_stdout_truncated: true,
      bin_stderr: 'stderr prefix',
      bin_stderr_truncated: true,
      bin_code: 0,
    })

    await expect(runCangjieCode('main() {}', { request })).resolves.toMatchObject({
      ok: true,
      stdout: 'expected suffix omitted',
      stdoutTruncated: true,
      stderr: 'stderr prefix',
      stderrTruncated: true,
      compilerOutput: 'compiler prefix',
      compilerOutputTruncated: true,
    })
  })

  it('forwards the abort signal to the request', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    })
    const controller = new AbortController()

    await runCangjieCode('main() {}', { request, signal: controller.signal })

    expect(request).toHaveBeenCalledWith('main() {}', { stdin: undefined, signal: controller.signal })
  })

  it('forwards stdin to the request', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    })

    await runCangjieCode('main() {}', { request, stdin: '1 2\n' })

    expect(request).toHaveBeenCalledWith('main() {}', { stdin: '1 2\n', signal: undefined })
  })

  it('re-throws an abort instead of reporting runner_unavailable', async () => {
    const controller = new AbortController()
    controller.abort()
    const request = vi.fn<RemoteRunRequest>().mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    )

    await expect(runCangjieCode('main() {}', { request, signal: controller.signal })).rejects.toThrow()
  })

  it('uses a text/plain body when no stdin is provided (default request)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ phase: 'run', compiler_output: '', compiler_output_truncated: false, compiler_code: 0, bin_stdout: 'ok', bin_stdout_truncated: false, bin_stderr: '', bin_stderr_truncated: false, bin_code: 0 }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await runCangjieCode('main() {}')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('text/plain')
    expect(init.body).toBe('main() {}')

    vi.unstubAllGlobals()
  })

  it('uses a JSON body with code+stdin when stdin is provided (default request)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ phase: 'run', compiler_output: '', compiler_output_truncated: false, compiler_code: 0, bin_stdout: 'ok', bin_stdout_truncated: false, bin_stderr: '', bin_stderr_truncated: false, bin_code: 0 }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await runCangjieCode('main() {}', { stdin: '1 2\n' })

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ code: 'main() {}', stdin: '1 2\n' })

    vi.unstubAllGlobals()
  })

  it('records the elapsed duration', async () => {
    const request = vi.fn<RemoteRunRequest>().mockResolvedValue({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    })

    const result = await runCangjieCode('main() {}', { request, now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1042) })

    expect(result.durationMs).toBe(42)
  })
})
