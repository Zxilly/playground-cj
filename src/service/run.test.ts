import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@lingui/core/macro', () => ({ t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values) }))

async function importRunService() {
  vi.resetModules()
  return import('@/service/run')
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init)
}

describe('remoteRun', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes compiler and program output when compile and run succeed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: 'compiled\n',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'hello',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
    }
    const { remoteRun } = await importRunService()

    await remoteRun('main()', actions)

    expect(actions.setToolOutput).toHaveBeenNthCalledWith(1, '编译中')
    expect(actions.setToolOutput).toHaveBeenNthCalledWith(2, 'compiled\n----------\nexit code 0')
    expect(actions.setProgramOutput).toHaveBeenNthCalledWith(1, '运行中')
    expect(actions.setProgramOutput).toHaveBeenNthCalledWith(2, 'hello\n----------\nexit code 0')
    expect(actions.setTruncation).toHaveBeenLastCalledWith({
      compilerOutput: false,
      programStdout: false,
      programStderr: false,
    })
  })

  it('clears program output and throws when compilation fails', async () => {
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
    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
    }
    const { remoteRun } = await importRunService()

    await expect(remoteRun('bad', actions)).rejects.toThrow('编译失败')

    expect(actions.setToolOutput).toHaveBeenLastCalledWith('syntax error\n----------\nexit code 1')
    expect(actions.setProgramOutput).toHaveBeenLastCalledWith('')
  })

  it('throws after publishing program output when the binary exits non-zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'panic\n',
      bin_stdout_truncated: false,
      bin_stderr: 'stack trace',
      bin_stderr_truncated: false,
      bin_code: 2,
    }))
    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
    }
    const { remoteRun } = await importRunService()

    await expect(remoteRun('panic', actions)).rejects.toThrow('运行失败')

    expect(actions.setProgramOutput).toHaveBeenLastCalledWith(
      'panic\n[stderr]\nstack trace\n----------\nexit code 2',
    )
  })

  it('publishes a structured failure before rejecting and clears pending output on an outage', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
      setResult: vi.fn(),
    }
    const { remoteRun } = await importRunService()
    await expect(remoteRun('main()', actions)).rejects.toThrow('offline')
    expect(actions.setResult).toHaveBeenNthCalledWith(1, null)
    expect(actions.setResult).toHaveBeenLastCalledWith(expect.objectContaining({
      ok: false,
      phase: null,
      failureKind: 'runner_unavailable',
    }))
    expect(actions.setToolOutput).toHaveBeenLastCalledWith('代码运行服务暂时不可用，请稍后重试。')
    expect(actions.setProgramOutput).toHaveBeenLastCalledWith('')
  })

  it('does not publish a stale response after the owning editor is canceled', async () => {
    let finish!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => {
      finish = resolve
    }))
    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
      setResult: vi.fn(),
    }
    const { remoteRun } = await importRunService()
    const controller = new AbortController()
    const pending = remoteRun('main()', actions, controller.signal)
    controller.abort()
    finish(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'late',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(actions.setResult.mock.calls).toEqual([[null]])
    expect(actions.setProgramOutput.mock.calls).toEqual([['运行中']])
  })
})
