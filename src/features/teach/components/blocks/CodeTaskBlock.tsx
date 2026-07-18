'use client'

import { useEffect, useRef, useState } from 'react'
import type { ComponentType, RefObject } from 'react'
import { CheckCircle2, Lightbulb, Loader2, Play, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { CodeTaskBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'
import { evaluateOutput } from '@/lib/teach/feedback/evaluate'
import type { ActiveEditorHandle, ActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { useActiveEditorRegistration } from '@/features/teach/hooks/use-active-editor-registration'
import type { BlockComponentProps } from './block-props'
import { CompilerDiagnosticOutput } from './CompilerDiagnosticOutput'
import { DynamicCodeTaskMonacoEditor } from './DynamicCodeTaskMonacoEditor'
import { TeachInlineMarkdown } from './TeachMarkdown'
import { cn } from '@/lib/utils'

/**
 * The real Monaco editor is loaded lazily (SSR off): it pulls in the heavy
 * `@codingame/monaco-vscode-api` stack (including `.css` imports jsdom cannot
 * parse), so it must never be in the static import graph of this module — that
 * would break the jsdom (component) tests, which inject a `<textarea>` fake
 * instead and never trigger this import.
 */
/** A run that has been evaluated against the task's expected output. */
interface EvaluatedRun {
  result: RunResult
  matched: boolean
}

/**
 * Imperative handle a code_task editor exposes so the block can read the current
 * code at run time and register it with the active-editor registry. Identical in
 * shape to {@link ActiveEditorHandle} — the editor *is* the active-editor source.
 */
export type CodeTaskEditorHandle = ActiveEditorHandle

/**
 * Props the injected code_task editor component receives. `initialCode` seeds the
 * editor once (Monaco then owns the buffer); `handleRef` is filled with the
 * editor's {@link CodeTaskEditorHandle} so the block (and, through it, the active
 * editor registry) can read/write the live code. Kept minimal so a jsdom test can
 * supply a `<textarea>` fake while the app supplies the real Monaco editor.
 */
export interface CodeTaskEditorProps {
  /** The code to seed the editor with on first mount. */
  initialCode: string
  /** Filled with the editor's imperative read/write handle. */
  handleRef: RefObject<CodeTaskEditorHandle | null>
  /** UI language passed through to Monaco (locale). */
  locale?: string
  /** Stable domain-derived model identity; distinct blocks must not share it. */
  uriHint?: string
  /** Parent scope retaining drafts across editor-only remounts. */
  modelScope?: string
  /** Fill the parent pane instead of using the resizable lesson-task height. */
  fillHeight?: boolean
  /** Use the workspace's canonical src/main.cj model for the active IDE surface. */
  canonicalModel?: boolean
  /** Replace a retained canonical model with initialCode when this editor mounts. */
  replaceCodeOnMount?: boolean
}

/** The renderer for the code input area (real Monaco in the app, a fake in tests). */
export type CodeTaskEditorComponent = ComponentType<CodeTaskEditorProps>

/**
 * The code_task editor container DOM node, augmented with e2e-only read/write
 * hooks. The real Monaco editor is not a `<textarea>` (so Playwright cannot
 * `.fill()` it) and its keyboard input is reshaped by auto-indent / bracket
 * completion, so e2e seeds code through these hooks (model `setValue`) for a
 * deterministic write. Scoped to the element — there is no app-wide global.
 */
interface CodeTaskEditorContainer extends HTMLDivElement {
  __codeTaskSetCode?: (code: string) => void
  __codeTaskGetCode?: () => string
}

interface CodeTaskBlockProps extends BlockComponentProps<CodeTaskBlockSchemaType> {
  /**
   * Compile-and-run client. Defaults to the shared remote runner; tests inject
   * a fake so the block can be exercised without the network.
   */
  runCode?: (code: string) => Promise<RunResult>
  /**
   * The editor renderer. Defaults to the real Monaco-backed editor; jsdom
   * (component) tests inject a `<textarea>` fake since Monaco does not render
   * under jsdom.
   */
  editorComponent?: CodeTaskEditorComponent
  /**
   * Registry the block registers its editor with while mounted, so the teacher's
   * `read_editor_code` / `set_editor_code` tools target this code_task. Optional
   * so isolated tests and document-only previews can omit it.
   */
  activeEditor?: ActiveEditorRegistry
  /** UI locale forwarded to the Monaco editor. */
  locale?: string
  editorUriHint?: string
  editorModelScope?: string
}

/**
 * Re-hydrate a completed task into an {@link EvaluatedRun} so a re-opened lesson
 * shows the prior pass/fail verdict. Only correctness was persisted (not the run
 * output), so the synthetic result carries empty streams; the verdict itself is
 * what matters. A runner-unavailable attempt was never recorded, so a stored
 * outcome is always a genuine pass/fail.
 */
function evaluatedFromOutcome(outcome: BlockComponentProps<CodeTaskBlockSchemaType>['outcome']): EvaluatedRun | null {
  if (outcome?.completedAt == null)
    return null
  const matched = outcome.correct === true
  return { result: { ok: matched, stdout: '', stderr: '', exitCode: matched ? 0 : null }, matched }
}

/**
 * Skill block: an interactive code task — the tightest feedback loop in the
 * workspace. The learner edits the seeded starter code in a real Monaco editor
 * (the same editor module as the playground), runs it through the Cangjie runner,
 * and the output is auto-compared against the expected output under the task's
 * match mode. Hints reveal progressively. When the runner is unreachable the
 * block degrades to a retry-able notice rather than recording a spurious failure.
 *
 * While mounted, the block registers its editor with the workspace's
 * {@link ActiveEditorRegistry} so the teacher agent's `read_editor_code` /
 * `set_editor_code` tools read and seed *this* code_task's code (the last
 * code_task the learner worked in wins). The editor itself is injected
 * ({@link CodeTaskEditorComponent}) so jsdom component tests can swap Monaco for a
 * `<textarea>` fake.
 */
export function CodeTaskBlock({
  block,
  outcome,
  runCode = runCangjieCode,
  onOutcome,
  editorComponent: EditorComponent = DynamicCodeTaskMonacoEditor,
  activeEditor,
  locale,
  editorUriHint,
  editorModelScope,
}: CodeTaskBlockProps) {
  // Re-hydrate a previously attempted task: a completed outcome seeds the prior
  // code (when stored) and the recorded pass/fail verdict. `outcome` is read only
  // at first mount (via the lazy initializers) so it never overwrites the
  // learner's current edits.
  const priorCode = outcome?.completedAt != null && typeof outcome.lastAnswer === 'string'
    ? outcome.lastAnswer
    : null
  const [initialCode] = useState(() => priorCode ?? block.starterCode)
  const [running, setRunning] = useState(false)
  const [evaluated, setEvaluated] = useState<EvaluatedRun | null>(() => evaluatedFromOutcome(outcome))
  const [revealedHints, setRevealedHints] = useState(0)

  // The editor owns the live code buffer; the block reads it through this handle
  // at run time and registers it as the active editor for the teacher's tools.
  const handleRef = useRef<CodeTaskEditorHandle | null>(null)
  const containerRef = useRef<CodeTaskEditorContainer | null>(null)

  const hints = block.hints ?? []
  const runnerUnavailable = evaluated?.result.failureKind === 'runner_unavailable'
  const passed = evaluated != null && evaluated.matched
  // A compile/run error (the program never produced output to compare) is a
  // different failure than "ran fine but the output didn't match". Distinguish
  // them so the learner reads the compiler message instead of a misleading
  // empty expected/actual diff. Rehydrated outcomes carry no stderr, so they
  // fall through to the plain "未通过" verdict.
  const errored = evaluated != null
    && !evaluated.matched
    && !runnerUnavailable
    && !evaluated.result.ok
    && evaluated.result.stderr.trim().length > 0

  // Mounting provides a deterministic initial editor; subsequent focus/click
  // interactions make the learner's most recently used editor active.
  const activateEditor = useActiveEditorRegistration(activeEditor, handleRef)

  // Expose a deterministic read/write hook on the editor container so e2e tests
  // can seed code into the real Monaco editor (which is not a `<textarea>`,
  // cannot be `.fill()`ed, and whose keyboard input is mangled by auto-indent).
  // Scoped to this DOM node — not an app-wide global — so it only exists while a
  // code_task is mounted and never leaks across the page.
  useEffect(() => {
    const node = containerRef.current
    if (!node)
      return
    node.__codeTaskSetCode = (code: string) => handleRef.current?.setCode(code)
    node.__codeTaskGetCode = () => handleRef.current?.getCode() ?? ''
    return () => {
      delete node.__codeTaskSetCode
      delete node.__codeTaskGetCode
    }
  }, [])

  const run = async () => {
    if (running)
      return
    const code = handleRef.current?.getCode() ?? initialCode
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
    <section data-testid="code-task-block" className="rounded-md border border-border bg-background p-4">
      <p data-testid="code-task-prompt" className="text-sm font-semibold leading-7 text-foreground">
        <TeachInlineMarkdown markdown={block.prompt} />
      </p>

      <div className="mt-3 overflow-hidden rounded-md border border-border/60 bg-background">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          <span>Cangjie</span>
        </div>
        <div
          ref={containerRef}
          data-testid="code-task-editor"
          aria-label={t`代码编辑区`}
          onFocusCapture={activateEditor}
          onClick={activateEditor}
        >
          <EditorComponent
            initialCode={initialCode}
            handleRef={handleRef}
            locale={locale}
            uriHint={editorUriHint}
            modelScope={editorModelScope}
          />
        </div>
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
          {hints.slice(0, revealedHints).map((hint, index) => (
            <li
              // Index-prefixed: hints can be duplicated (covered by a test) and are
              // revealed in order, so position is their stable identity.
              // eslint-disable-next-line react/no-array-index-key
              key={`${index}-${hint}`}
              data-testid="code-task-hint"
              className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs leading-6 text-muted-foreground"
            >
              <Lightbulb aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <TeachInlineMarkdown markdown={hint} className="min-w-0" />
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
                    data-status={passed ? 'passed' : errored ? 'errored' : 'failed'}
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
                    {passed
                      ? <Trans>通过</Trans>
                      : errored ? <Trans>运行出错</Trans> : <Trans>未通过</Trans>}
                  </div>

                  {!passed && evaluated.result.stderr && (
                    <CompilerDiagnosticOutput
                      output={evaluated.result.compilerOutput ?? evaluated.result.stderr}
                      testId="code-task-stderr"
                    />
                  )}

                  {/* Only show the expected/actual diff for a genuine output
                      mismatch — for a compile/run error the actual output is
                      empty and the diff would just be noise next to the stderr. */}
                  {!passed && !errored && (
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
