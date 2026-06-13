'use client'

import { useState } from 'react'
import { CheckCircle2, Lightbulb, Loader2, Play, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { CodeTaskBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'
import { evaluateOutput } from '@/lib/teach/feedback/evaluate'
import type { BlockComponentProps } from './block-props'
import { cn } from '@/lib/utils'

/** A run that has been evaluated against the task's expected output. */
interface EvaluatedRun {
  result: RunResult
  matched: boolean
}

interface CodeTaskBlockProps extends BlockComponentProps<CodeTaskBlockSchemaType> {
  /**
   * Compile-and-run client. Defaults to the shared remote runner; tests inject
   * a fake so the block can be exercised without the network or Monaco.
   */
  runCode?: (code: string) => Promise<RunResult>
}

/**
 * Skill block: an interactive code task — the tightest feedback loop in the
 * workspace. The learner edits the seeded starter code, runs it through the
 * Cangjie runner, and the output is auto-compared against the expected output
 * under the task's match mode. Hints reveal progressively. When the runner is
 * unreachable the block degrades to a retry-able notice rather than recording a
 * spurious failure.
 */
export function CodeTaskBlock({ block, runCode = runCangjieCode, onOutcome }: CodeTaskBlockProps) {
  const [code, setCode] = useState(block.starterCode)
  const [running, setRunning] = useState(false)
  const [evaluated, setEvaluated] = useState<EvaluatedRun | null>(null)
  const [revealedHints, setRevealedHints] = useState(0)

  const hints = block.hints ?? []
  const runnerUnavailable = evaluated?.result.failureKind === 'runner_unavailable'
  const passed = evaluated != null && evaluated.matched

  const run = async () => {
    if (running)
      return
    setRunning(true)
    try {
      const result = await runCode(code)
      if (result.failureKind === 'runner_unavailable') {
        // Degraded: do not record an outcome — the attempt could not be judged.
        setEvaluated({ result, matched: false })
        return
      }
      const matched = result.ok && evaluateOutput(result.stdout, block.expectedOutput, block.matchMode)
      setEvaluated({ result, matched })
      onOutcome?.({ correct: matched, lastAnswer: code })
    }
    finally {
      setRunning(false)
    }
  }

  return (
    <section data-testid="code-task-block" className="rounded-md border border-border/60 bg-card/40 p-4">
      <p className="text-sm font-semibold leading-7 text-foreground">{block.prompt}</p>

      <div className="mt-3 overflow-hidden rounded-md border border-border/60 bg-background">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <span>Cangjie</span>
        </div>
        <textarea
          data-testid="code-task-editor"
          value={code}
          onChange={event => setCode(event.target.value)}
          spellCheck={false}
          rows={Math.max(4, block.starterCode.split('\n').length + 1)}
          aria-label={t`代码编辑区`}
          className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="code-task-run"
          disabled={running}
          onClick={() => void run()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running
            ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            : <Play aria-hidden="true" className="size-4" />}
          {running ? <Trans>运行中</Trans> : <Trans>运行</Trans>}
        </button>
        {hints.length > 0 && revealedHints < hints.length && (
          <button
            type="button"
            data-testid="code-task-hint-button"
            onClick={() => setRevealedHints(count => Math.min(count + 1, hints.length))}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
          >
            <Lightbulb aria-hidden="true" className="size-3.5" />
            {revealedHints === 0 ? <Trans>查看提示</Trans> : <Trans>下一个提示</Trans>}
          </button>
        )}
      </div>

      {revealedHints > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {hints.slice(0, revealedHints).map(hint => (
            <li
              key={hint}
              data-testid="code-task-hint"
              className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs leading-6 text-muted-foreground"
            >
              <Lightbulb aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span className="min-w-0">{hint}</span>
            </li>
          ))}
        </ul>
      )}

      {evaluated != null && (
        <div className="mt-3 space-y-2">
          {runnerUnavailable
            ? (
                <div
                  data-testid="code-task-runner-unavailable"
                  role="status"
                  aria-live="polite"
                  className="flex flex-col gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span><Trans>运行服务暂时不可用，这次未记录进度。请稍后重试运行。</Trans></span>
                  <button
                    type="button"
                    data-testid="code-task-retry"
                    disabled={running}
                    onClick={() => void run()}
                    className="inline-flex shrink-0 items-center justify-center rounded-md border border-amber-300/60 bg-background px-3 py-1.5 font-semibold hover:bg-muted/40 disabled:opacity-50"
                  >
                    <Trans>重试运行</Trans>
                  </button>
                </div>
              )
            : (
                <>
                  <div
                    data-testid="code-task-result"
                    data-status={passed ? 'passed' : 'failed'}
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
                      passed
                        ? 'border-emerald-400/60 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-destructive/50 bg-destructive/10 text-destructive',
                    )}
                  >
                    {passed
                      ? <CheckCircle2 aria-hidden="true" className="size-4" />
                      : <XCircle aria-hidden="true" className="size-4" />}
                    {passed ? <Trans>通过</Trans> : <Trans>未通过</Trans>}
                  </div>

                  {!passed && evaluated.result.stderr && (
                    <pre
                      data-testid="code-task-stderr"
                      className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs leading-relaxed text-destructive"
                    >
                      {evaluated.result.stderr}
                    </pre>
                  )}

                  {!passed && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold text-muted-foreground"><Trans>预期输出</Trans></div>
                        <pre
                          data-testid="code-task-expected"
                          className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 font-mono text-xs"
                        >
                          {block.expectedOutput}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold text-muted-foreground"><Trans>实际输出</Trans></div>
                        <pre
                          data-testid="code-task-actual"
                          className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 font-mono text-xs"
                        >
                          {evaluated.result.stdout || ' '}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              )}
        </div>
      )}
    </section>
  )
}
