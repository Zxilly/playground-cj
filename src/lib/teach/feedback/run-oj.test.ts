import { describe, expect, it, vi } from 'vitest'
import type { RunResult } from './run-cangjie'
import { runOjTests } from './run-oj'
import type { OjBlockSchemaType } from '@/lib/teach/lessons/blocks'

function ok(stdout: string): RunResult {
  return { ok: true, stdout, stderr: '', exitCode: 0 }
}

function compileError(stderr: string): RunResult {
  return { ok: false, stdout: '', stderr, exitCode: null, compilerOutput: stderr }
}

function runnerDown(): RunResult {
  return { ok: false, stdout: '', stderr: 'network down', exitCode: null, failureKind: 'runner_unavailable' }
}

const functionBlock: OjBlockSchemaType = {
  type: 'oj',
  mode: 'function',
  title: 'Add two numbers',
  prompt: 'Implement add',
  starterCode: 'func add(a: Int64, b: Int64): Int64 { 0 }',
  callTemplate: 'println(add(${args}))',
  testCases: [
    { args: '1, 2', expectedOutput: '3', visible: true, label: 'sample' },
    { args: '10, 20', expectedOutput: '30', visible: false },
  ],
  matchMode: 'exact',
}

const stdioBlock: OjBlockSchemaType = {
  type: 'oj',
  mode: 'stdio',
  title: 'Echo',
  prompt: 'Echo stdin',
  starterCode: 'main() {}',
  testCases: [
    { stdin: 'hello\n', expectedOutput: 'hello', visible: true },
  ],
  matchMode: 'exact',
}

describe('runOjTests', () => {
  it('assembles a function-mode program: callTemplate with args substituted, appended main, no stdin', async () => {
    const run = vi.fn<(code: string, opts?: { stdin?: string }) => Promise<RunResult>>().mockResolvedValue(ok('3'))
    await runOjTests('SUBMISSION', functionBlock, [functionBlock.testCases[0]], { run })

    const [program, opts] = run.mock.calls[0]
    expect(program).toContain('SUBMISSION')
    expect(program).toContain('println(add(1, 2))')
    expect(program).toContain('main() {')
    expect(opts?.stdin).toBeUndefined()
  })

  it('passes stdin through in stdio mode and does not append main', async () => {
    const run = vi.fn<(code: string, opts?: { stdin?: string }) => Promise<RunResult>>().mockResolvedValue(ok('hello'))
    await runOjTests('FULL_PROGRAM', stdioBlock, stdioBlock.testCases, { run })

    const [program, opts] = run.mock.calls[0]
    expect(program).toBe('FULL_PROGRAM')
    expect(opts?.stdin).toBe('hello\n')
  })

  it('judges per case via the block matchMode and aggregates allPassed', async () => {
    const run = vi.fn<(code: string) => Promise<RunResult>>()
      .mockResolvedValueOnce(ok('3'))
      .mockResolvedValueOnce(ok('30'))
    const result = await runOjTests('S', functionBlock, functionBlock.testCases, { run })

    expect(result.cases).toHaveLength(2)
    expect(result.cases.every(c => c.passed)).toBe(true)
    expect(result.allPassed).toBe(true)
    expect(result.cases[0].label).toBe('sample')
    expect(result.cases[0].visible).toBe(true)
    expect(result.cases[1].visible).toBe(false)
  })

  it('marks a case failed when output does not match and reports allPassed false', async () => {
    const run = vi.fn<(code: string) => Promise<RunResult>>()
      .mockResolvedValueOnce(ok('3'))
      .mockResolvedValueOnce(ok('999'))
    const result = await runOjTests('S', functionBlock, functionBlock.testCases, { run })

    expect(result.cases[0].passed).toBe(true)
    expect(result.cases[1].passed).toBe(false)
    expect(result.cases[1].actualOutput).toBe('999')
    expect(result.allPassed).toBe(false)
  })

  it('honours contains matchMode', async () => {
    const containsBlock: OjBlockSchemaType = { ...stdioBlock, matchMode: 'contains' }
    const run = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('say hello world'))
    const result = await runOjTests('S', containsBlock, stdioBlock.testCases, { run })
    expect(result.cases[0].passed).toBe(true)
  })

  it('flags a compile/runtime error as errored, not a plain mismatch', async () => {
    const run = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(compileError('error: boom'))
    const result = await runOjTests('S', stdioBlock, stdioBlock.testCases, { run })
    expect(result.cases[0].passed).toBe(false)
    expect(result.cases[0].errored).toBe(true)
    expect(result.cases[0].compilerOutput).toContain('boom')
  })

  it('flags runner-unavailable cases', async () => {
    const run = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(runnerDown())
    const result = await runOjTests('S', stdioBlock, stdioBlock.testCases, { run })
    expect(result.cases[0].runnerUnavailable).toBe(true)
    expect(result.cases[0].passed).toBe(false)
    expect(result.allPassed).toBe(false)
  })

  it('preserves input order even with concurrency', async () => {
    const block: OjBlockSchemaType = {
      ...functionBlock,
      testCases: [
        { args: '0', expectedOutput: 'a', visible: true },
        { args: '1', expectedOutput: 'b', visible: true },
        { args: '2', expectedOutput: 'c', visible: true },
      ],
    }
    // Resolve out of order: later cases finish first.
    const run = vi.fn<(code: string) => Promise<RunResult>>().mockImplementation((code) => {
      const delay = code.includes('add(0)') ? 30 : code.includes('add(1)') ? 10 : 0
      return new Promise(resolve => setTimeout(() => resolve(ok(code.includes('add(0)') ? 'a' : code.includes('add(1)') ? 'b' : 'c')), delay))
    })
    const result = await runOjTests('S', block, block.testCases, { run, concurrency: 3 })
    expect(result.cases.map(c => c.index)).toEqual([0, 1, 2])
    expect(result.cases.every(c => c.passed)).toBe(true)
  })

  it('stops scheduling new cases once the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const run = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('x'))
    const result = await runOjTests('S', stdioBlock, stdioBlock.testCases, { run, signal: controller.signal })
    expect(run).not.toHaveBeenCalled()
    expect(result.cases).toHaveLength(0)
    expect(result.allPassed).toBe(false)
  })
})
