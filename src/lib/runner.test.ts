import { describe, expect, it, vi } from 'vitest'
import type { RunnerClient } from './runner-client'
import { normalizeRunResult, runCangjieCode } from './runner'

describe('shared run result contract', () => {
  it('keeps compiler exit code separate from a skipped program', () => {
    expect(normalizeRunResult({
      phase: 'compile',
      compiler_code: 2,
      compiler_output: 'error: bad source',
      compiler_output_truncated: true,
      bin_code: null,
      bin_stdout: '',
      bin_stdout_truncated: false,
      bin_stderr: '',
      bin_stderr_truncated: false,
    }, 17)).toMatchObject({
      ok: false,
      phase: 'compile',
      compilerExitCode: 2,
      exitCode: null,
      compilerOutput: 'error: bad source',
      compilerOutputTruncated: true,
      durationMs: 17,
    })
  })

  it('does not start a request for an already canceled owner', async () => {
    const run = vi.fn<RunnerClient['run']>()
    const controller = new AbortController()
    controller.abort()
    await expect(runCangjieCode('main()', { client: { run }, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(run).not.toHaveBeenCalled()
  })
})
