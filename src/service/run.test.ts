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
    expect(actions.setToolOutput).toHaveBeenNthCalledWith(2, 'compiled\n----------\n退出码 0')
    expect(actions.setProgramOutput).toHaveBeenNthCalledWith(1, '运行中')
    expect(actions.setProgramOutput).toHaveBeenNthCalledWith(2, 'hello\n----------\n退出码 0')
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

    expect(actions.setToolOutput).toHaveBeenLastCalledWith('syntax error\n----------\n退出码 1')
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
      'panic\n[标准错误]\nstack trace\n----------\n退出码 2',
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

  it('publishes structured rate-limit, payload, timeout, and busy guidance instead of collapsing them', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Too many requests', code: 'runner_rate_limit_exceeded' },
        { status: 429, headers: { 'Retry-After': '30' } },
      ))
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Too large', code: 'request_body_too_large' },
        { status: 413 },
      ))
      .mockResolvedValueOnce(jsonResponse(
        { error: 'Timed out', code: 'runner_timeout' },
        { status: 504 },
      ))

    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
      setResult: vi.fn(),
    }
    const { remoteRun } = await importRunService()

    await expect(remoteRun('main()', actions)).rejects.toThrow(/Too many requests/)
    expect(actions.setToolOutput).toHaveBeenLastCalledWith('请求过于频繁（429），请等待约 30 秒后再试。')
    expect(actions.setResult).toHaveBeenLastCalledWith(expect.objectContaining({
      failureKind: 'runner_unavailable',
      failureReason: 'rate_limited',
      httpStatus: 429,
      retryAfterSeconds: 30,
    }))

    await expect(remoteRun('main()', actions)).rejects.toThrow(/Too large/)
    expect(actions.setToolOutput).toHaveBeenLastCalledWith('代码或标准输入体积超出 256 KB 上限（413），请精简内容后重试。')

    await expect(remoteRun('main()', actions)).rejects.toThrow(/Timed out/)
    expect(actions.setToolOutput).toHaveBeenLastCalledWith('编译或运行超时（504），请检查是否存在死循环或耗时过长的计算后重试。')
  })

  it('forwards optional stdin from actions.getStdin to the runner request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: '42',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    const actions = {
      setToolOutput: vi.fn(),
      setProgramOutput: vi.fn(),
      setTruncation: vi.fn(),
      getStdin: () => '42\n',
    }
    const { remoteRun } = await importRunService()

    await remoteRun('main()', actions)

    expect(fetch).toHaveBeenCalledWith('/api/run', expect.objectContaining({
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ code: 'main()', stdin: '42\n' }),
    }))
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
