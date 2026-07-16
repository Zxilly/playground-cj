'use client'

import { useEffect, useRef, useState } from 'react'
import type { ComponentType, RefObject } from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle2, Lightbulb, Loader2, Play, Send, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Block } from '@/lib/teach/lessons/blocks'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'
import type { OjRunResult } from '@/lib/teach/feedback/run-oj'
import { runOjTests } from '@/lib/teach/feedback/run-oj'
import type { ActiveEditorHandle } from '@/features/teach/state/active-editor-store'
import { useActiveEditorRegistration } from '@/features/teach/hooks/use-active-editor-registration'
import type { OjBlockProps } from './block-props'
import { TeachMarkdown } from './TeachMarkdown'
import { cn } from '@/lib/utils'

/**
 * The real Monaco editor is loaded lazily (SSR off): it pulls in the heavy
 * `@codingame/monaco-vscode-api` stack (including `.css` imports jsdom cannot
 * parse), so it must never be in the static import graph of this module — that
 * would break the jsdom (component) tests, which inject a `<textarea>` fake
 * instead and never trigger this import.
 */
const OJMonacoEditor = dynamic(
  () => import('./CodeTaskMonacoEditor').then(m => m.CodeTaskMonacoEditor),
  { ssr: false },
) as OJEditorComponent

/**
 * Imperative handle the OJ editor exposes so the block can read the current code
 * at run time and register it with the active-editor registry. Identical in shape
 * to {@link ActiveEditorHandle} — the editor *is* the active-editor source.
 */
export type OJEditorHandle = ActiveEditorHandle

/**
 * Props the injected OJ editor component receives. Shared with the Monaco wrapper
 * the code_task block uses (`CodeTaskEditorProps`): `initialCode` seeds the editor
 * once, `handleRef` is filled with the editor's read/write handle, `locale` is the
 * UI language. Kept minimal so a jsdom test can supply a `<textarea>` fake.
 */
export interface OJEditorProps {
  /** The code to seed the editor with on first mount. */
  initialCode: string
  /** Filled with the editor's imperative read/write handle. */
  handleRef: RefObject<OJEditorHandle | null>
  /** UI language passed through to Monaco (locale). */
  locale?: string
}

/** The renderer for the code input area (real Monaco in the app, a fake in tests). */
export type OJEditorComponent = ComponentType<OJEditorProps>

/**
 * The OJ editor container DOM node, augmented with e2e-only read/write hooks.
 * The real Monaco editor is not a `<textarea>` (so Playwright cannot `.fill()`
 * it) and its keyboard input is reshaped by auto-indent / bracket completion, so
 * e2e seeds code through these hooks (model `setValue`) for a deterministic write.
 * Scoped to the element — there is no app-wide global.
 */
interface OJEditorContainer extends HTMLDivElement {
  __ojSetCode?: (code: string) => void
  __ojGetCode?: () => string
}

interface OJBlockComponentProps extends OjBlockProps {
  /**
   * The editor renderer. Defaults to the real Monaco-backed editor; jsdom
   * (component) tests inject a `<textarea>` fake since Monaco does not render
   * under jsdom.
   */
  editorComponent?: OJEditorComponent
}

/** Which run produced the currently shown results: a sample run or a full submit. */
type RunPhase = 'sample' | 'submit'

const difficultyLabels: Record<'easy' | 'medium' | 'hard', () => string> = {
  easy: () => t`简单`,
  medium: () => t`中等`,
  hard: () => t`困难`,
}

const difficultyStyles: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'border-emerald-400/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  medium: 'border-amber-400/60 bg-amber-50/70 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  hard: 'border-destructive/50 bg-destructive/10 text-destructive',
}

/**
 * Skill block: an online-judge problem. The learner edits the seeded starter code
 * in a real Monaco editor (the same editor module as the playground/code_task) and
 * submits it against a battery of test cases. `function` mode wraps a learner
 * function in a generated `main()` per case; `stdio` mode runs the program as-is
 * with per-case stdin. "运行示例" exercises only the visible cases; "提交" runs all
 * cases and records the outcome. Hidden cases never reveal their expected output.
 *
 * While mounted, the block registers its editor with the workspace's
 * {@link ActiveEditorRegistry} so the teacher agent's `read_editor_code` /
 * `set_editor_code` tools read and seed *this* problem's code (latest wins). The
 * editor is injected so jsdom component tests can swap Monaco for a `<textarea>`.
 */
export function OJBlock({
  block,
  outcome,
  onOutcome,
  runProgram,
  activeEditor,
  locale,
  editorComponent: EditorComponent = OJMonacoEditor,
}: OJBlockComponentProps) {
  // Re-hydrate a previously attempted problem: a completed outcome seeds the
  // prior code (when stored). Read only at first mount via the lazy initializer
  // so it never overwrites the learner's current edits.
  const priorCode = outcome?.completedAt != null && typeof outcome.lastAnswer === 'string'
    ? outcome.lastAnswer
    : null
  const [initialCode] = useState(() => priorCode ?? block.starterCode)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<RunPhase | null>(null)
  const [result, setResult] = useState<OjRunResult | null>(null)
  const [revealedHints, setRevealedHints] = useState(0)

  const handleRef = useRef<OJEditorHandle | null>(null)
  const containerRef = useRef<OJEditorContainer | null>(null)

  const hints = block.hints ?? []
  const runnerUnavailable = result != null && result.cases.some(c => c.runnerUnavailable)
  const passedCount = result?.cases.filter(c => c.passed).length ?? 0
  const totalCount = result?.cases.length ?? 0

  // Mounting provides a deterministic initial editor; subsequent focus/click
  // interactions make the learner's most recently used editor active.
  const activateEditor = useActiveEditorRegistration(activeEditor, handleRef)

  // Expose a deterministic read/write hook on the editor container so e2e tests
  // can seed code into the real Monaco editor. Scoped to this DOM node.
  useEffect(() => {
    const node = containerRef.current
    if (!node)
      return
    node.__ojSetCode = (code: string) => handleRef.current?.setCode(code)
    node.__ojGetCode = () => handleRef.current?.getCode() ?? ''
    return () => {
      delete node.__ojSetCode
      delete node.__ojGetCode
    }
  }, [])

  const run = async (which: RunPhase) => {
    if (running)
      return
    const code = handleRef.current?.getCode() ?? initialCode
    // "运行示例" exercises only the visible cases; "提交" runs them all.
    const selectedCases = which === 'sample'
      ? block.testCases.filter(tc => tc.visible)
      : block.testCases
    if (selectedCases.length === 0)
      return
    setRunning(true)
    setPhase(which)
    try {
      const next = await runOjTests(code, block, selectedCases, {
        run: runProgram ?? ((c, o) => runCangjieCode(c, o)),
      })
      setResult(next)
      // Only a full submit records progress; a degraded run is never recorded.
      if (which === 'submit' && !next.cases.some(c => c.runnerUnavailable))
        onOutcome?.({ correct: next.allPassed, lastAnswer: code })
    }
    finally {
      setRunning(false)
    }
  }

  const difficulty = block.difficulty

  return (
    <section data-testid="oj-block" className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 data-testid="oj-title" className="text-base font-semibold text-foreground">{block.title}</h3>
        {difficulty != null && (
          <span
            data-testid="oj-difficulty"
            className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', difficultyStyles[difficulty])}
          >
            {difficultyLabels[difficulty]()}
          </span>
        )}
      </div>

      <TeachMarkdown markdown={block.prompt} className="mt-2 text-sm" />

      {block.mode === 'function' && (
        <p data-testid="oj-function-hint" className="mt-2 text-xs text-muted-foreground">
          <Trans>只需实现题目要求的函数，无需编写 main。</Trans>
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-md border border-border/60 bg-background">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <span>Cangjie</span>
        </div>
        <div
          ref={containerRef}
          data-testid="oj-editor"
          aria-label={t`代码编辑区`}
          onFocusCapture={activateEditor}
          onClick={activateEditor}
        >
          <EditorComponent initialCode={initialCode} handleRef={handleRef} locale={locale} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="oj-run-sample"
          disabled={running}
          onClick={() => void run('sample')}
          className="inline-flex items-center gap-2 rounded-md border border-border/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running && phase === 'sample'
            ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            : <Play aria-hidden="true" className="size-4" />}
          <Trans>运行示例</Trans>
        </button>
        <button
          type="button"
          data-testid="oj-submit"
          disabled={running}
          onClick={() => void run('submit')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running && phase === 'submit'
            ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            : <Send aria-hidden="true" className="size-4" />}
          <Trans>提交</Trans>
        </button>
        {hints.length > 0 && revealedHints < hints.length && (
          <button
            type="button"
            data-testid="oj-hint-button"
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
          {hints.slice(0, revealedHints).map((hint, index) => (
            <li
              // Index-prefixed: hints can be duplicated and are revealed in order,
              // so position is their stable identity.
              // eslint-disable-next-line react/no-array-index-key
              key={`${index}-${hint}`}
              data-testid="oj-hint"
              className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs leading-6 text-muted-foreground"
            >
              <Lightbulb aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span className="min-w-0">{hint}</span>
            </li>
          ))}
        </ul>
      )}

      {result != null && (
        <div className="mt-3 space-y-2">
          {runnerUnavailable
            ? (
                <div
                  data-testid="oj-runner-unavailable"
                  role="status"
                  aria-live="polite"
                  className="flex flex-col gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span><Trans>运行服务暂时不可用，这次未记录进度。请稍后重试。</Trans></span>
                  <button
                    type="button"
                    data-testid="oj-retry"
                    disabled={running}
                    onClick={() => void run(phase ?? 'submit')}
                    className="inline-flex shrink-0 items-center justify-center rounded-md border border-amber-300/60 bg-background px-3 py-1.5 font-semibold hover:bg-muted/40 disabled:opacity-50"
                  >
                    <Trans>重试</Trans>
                  </button>
                </div>
              )
            : (
                <>
                  <div
                    data-testid="oj-summary"
                    data-status={result.allPassed ? 'passed' : 'failed'}
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
                      result.allPassed
                        ? 'border-emerald-400/60 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-destructive/50 bg-destructive/10 text-destructive',
                    )}
                  >
                    {result.allPassed
                      ? <CheckCircle2 aria-hidden="true" className="size-4" />
                      : <XCircle aria-hidden="true" className="size-4" />}
                    <span data-testid="oj-passed-count">
                      <Trans>
                        通过
                        {' '}
                        {passedCount}
                        /
                        {totalCount}
                      </Trans>
                    </span>
                  </div>

                  <ul data-testid="oj-case-list" className="flex flex-col gap-2">
                    {result.cases.map((c) => {
                      const caseNumber = c.index + 1
                      return (
                        <li
                          key={c.index}
                          data-testid="oj-case"
                          data-index={c.index}
                          data-status={c.passed ? 'passed' : c.errored ? 'errored' : 'failed'}
                          data-visible={c.visible ? 'true' : 'false'}
                          className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 font-semibold">
                            {c.passed
                              ? <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-500" />
                              : <XCircle aria-hidden="true" className="size-3.5 text-destructive" />}
                            <span className="text-foreground">
                              {c.label ?? (
                                <Trans>
                                  测试
                                  {' '}
                                  {caseNumber}
                                </Trans>
                              )}
                            </span>
                            {!c.visible && (
                              <span className="text-muted-foreground">
                                <Trans>（隐藏）</Trans>
                              </span>
                            )}
                          </div>

                          {/* Compile/runtime error: show the compiler message instead
                            of an empty expected/actual diff. */}
                          {!c.passed && c.errored && c.compilerOutput && (
                            <pre
                              data-testid="oj-case-stderr"
                              className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs leading-relaxed text-destructive"
                            >
                              {c.compilerOutput}
                            </pre>
                          )}

                          {/* Output mismatch: reveal expected vs actual, but ONLY for
                            visible cases — a hidden case never leaks its expected
                            output. */}
                          {!c.passed && !c.errored && c.visible && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <div>
                                <div className="mb-1 font-semibold text-muted-foreground"><Trans>预期输出</Trans></div>
                                <pre
                                  data-testid="oj-case-expected"
                                  className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 font-mono"
                                >
                                  {c.expectedOutput}
                                </pre>
                              </div>
                              <div>
                                <div className="mb-1 font-semibold text-muted-foreground"><Trans>实际输出</Trans></div>
                                <pre
                                  data-testid="oj-case-actual"
                                  className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 font-mono"
                                >
                                  {c.actualOutput || ' '}
                                </pre>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
        </div>
      )}
    </section>
  )
}

// Re-export the block type for the renderer's narrowing convenience.
export type OJBlockType = Extract<Block, { type: 'oj' }>
