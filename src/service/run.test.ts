import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@lingui/core/macro', () => ({ t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values) }))

async function importRunService() {
  vi.resetModules()
  return import('@/service/run')
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init)
}

describe('requestRemoteAction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts source code as plain text to the selected backend action', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      formatted: 'format()',
      formatted_truncated: false,
      formatter_output: '',
      formatter_output_truncated: false,
      formatter_code: 0,
    }))
    const { requestRemoteAction } = await importRunService()

    await expect(requestRemoteAction('main()', 'format')).resolves.toEqual({
      formatted: 'format()',
      formatted_truncated: false,
      formatter_output: '',
      formatter_output_truncated: false,
      formatter_code: 0,
    })

    expect(fetch).toHaveBeenCalledWith('/api/format', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: 'main()',
    })
  })

  it('uses JSON error messages when remote requests fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'compile service unavailable' }),
      { status: 500 },
    ))
    const { requestRemoteAction } = await importRunService()

    await expect(requestRemoteAction('main()', 'run')).rejects.toThrow(
      'Remote action failed: compile service unavailable',
    )
  })

  it('falls back to the raw response text for non-JSON remote errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('gateway timeout', { status: 504 }))
    const { requestRemoteAction } = await importRunService()

    await expect(requestRemoteAction('main()', 'run')).rejects.toThrow(
      'Remote action failed: gateway timeout',
    )
  })

  it('rejects a 200 response that does not match the exact runner contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      phase: 'run',
      compiler_output: '',
      compiler_output_truncated: false,
      compiler_code: 0,
      bin_stdout: 'ok',
      // Deliberately missing bin_stdout_truncated.
      bin_stderr: '',
      bin_stderr_truncated: false,
      bin_code: 0,
    }))
    const { requestRemoteAction } = await importRunService()

    await expect(requestRemoteAction('main()', 'run')).rejects.toThrow(
      'runner returned an invalid response',
    )
  })
})

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
      formattedSource: false,
      formatterOutput: false,
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
})
