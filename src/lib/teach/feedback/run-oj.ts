import type { RunResult } from './run-cangjie'
import { runCangjieCode } from './run-cangjie'
import { evaluateOutput } from './evaluate'
import type { OjBlockSchemaType, OjTestCase } from '@/lib/teach/lessons/blocks'

/** Per-test-case verdict produced by {@link runOjTests}. */
export interface OjCaseResult {
  /** Position of the case in the input list (results preserve input order). */
  index: number
  /** Optional human-readable label for the case. */
  label?: string
  /** Whether the case's expected output may be shown to the learner. */
  visible: boolean
  /** The program compiled, ran, and its output matched the expected output. */
  passed: boolean
  /** A compile/runtime error prevented a meaningful output comparison. */
  errored: boolean
  /** The case's expected output (only ever surfaced for visible cases). */
  expectedOutput: string
  /** The program's actual stdout. */
  actualOutput: string
  /** Raw compiler output, when the backend returned one. */
  compilerOutput?: string
  /** The runner was unreachable, so this case could not be judged. */
  runnerUnavailable: boolean
}

/** Aggregate result of running a submission against a set of test cases. */
export interface OjRunResult {
  cases: OjCaseResult[]
  /** Every case passed. */
  allPassed: boolean
}

/**
 * Dependencies for {@link runOjTests}. `run` is the compile-and-run client
 * (defaults to the shared remote runner; injected as a fake in tests);
 * `concurrency` caps how many cases run at once; `signal` aborts scheduling.
 */
export interface RunOjDeps {
  run?: (code: string, opts?: { stdin?: string, signal?: AbortSignal }) => Promise<RunResult>
  signal?: AbortSignal
  concurrency?: number
}

/**
 * Assemble the program that will be compiled for a single test case.
 *
 * - `function` mode: the learner authored only the function(s); the case's
 *   `args` are spliced into `callTemplate` and wrapped in a generated `main()`,
 *   so the submission never needs (nor should have) its own `main`.
 * - `stdio` mode: the submission is a full program run as-is; the case's input
 *   is fed via stdin instead.
 */
function buildProgram(submission: string, block: OjBlockSchemaType, tc: OjTestCase): { program: string, stdin?: string } {
  if (block.mode === 'function') {
    const call = (block.callTemplate ?? '').replaceAll('${args}', tc.args ?? '')
    return { program: `${submission}\n\nmain() {\n  ${call}\n}\n` }
  }
  return { program: submission, stdin: tc.stdin ?? '' }
}

/** Run a single test case and normalise the runner result into an {@link OjCaseResult}. */
async function runCase(
  submission: string,
  block: OjBlockSchemaType,
  tc: OjTestCase,
  index: number,
  run: NonNullable<RunOjDeps['run']>,
  signal: AbortSignal | undefined,
): Promise<OjCaseResult> {
  const { program, stdin } = buildProgram(submission, block, tc)
  const r = await run(program, { stdin, signal })
  const runnerUnavailable = r.failureKind === 'runner_unavailable'
  const passed = r.ok && evaluateOutput(r.stdout, tc.expectedOutput, block.matchMode)
  const errored = !r.ok && !!r.stderr
  return {
    index,
    label: tc.label,
    visible: tc.visible,
    passed,
    errored,
    expectedOutput: tc.expectedOutput,
    actualOutput: r.stdout,
    compilerOutput: r.compilerOutput,
    runnerUnavailable,
  }
}

/**
 * Compile and run `submission` against `cases`, returning a per-case verdict and
 * an `allPassed` aggregate. Pure aside from the injected `deps.run` client, so it
 * is fully unit-testable with a fake runner.
 *
 * Cases run with a small concurrency limit (default 4) while preserving input
 * order in the results. Once `deps.signal` aborts, no further cases are
 * scheduled (in-flight cases settle through the runner's own abort handling).
 */
export async function runOjTests(
  submission: string,
  block: OjBlockSchemaType,
  cases: OjTestCase[],
  deps: RunOjDeps,
): Promise<OjRunResult> {
  const run = deps.run ?? ((code, opts) => runCangjieCode(code, opts))
  const concurrency = Math.max(1, deps.concurrency ?? 4)
  const results: OjCaseResult[] = Array.from({ length: cases.length })

  let next = 0
  const worker = async (): Promise<void> => {
    while (true) {
      if (deps.signal?.aborted)
        return
      const index = next++
      if (index >= cases.length)
        return
      results[index] = await runCase(submission, block, cases[index], index, run, deps.signal)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, cases.length) }, () => worker())
  await Promise.all(workers)

  // Drop any holes left by an early abort, keeping input order for the rest.
  const settled = results.filter((r): r is OjCaseResult => r != null)
  return { cases: settled, allPassed: settled.length === cases.length && settled.every(c => c.passed) }
}
