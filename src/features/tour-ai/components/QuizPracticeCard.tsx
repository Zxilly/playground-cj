'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnsiUp } from 'ansi_up'
import { CheckCircle2, ChevronDown, Code2, ListChecks, Loader2, Play, RotateCcw, Send, SkipForward, Sparkles, Terminal, X, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trans } from '@lingui/react/macro'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useQuizDraftStore } from '@/features/tour-ai/state/quiz-draft-store'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TourEditor } from '@/features/tour/components/TourEditor'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { evaluateQuizOutput } from '@/lib/ai/classroom/reducer'
import type { ClassroomQuiz, RunResult } from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'
import { requestRemoteAction } from '@/service/run'
import { useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import {
  classroomCardVariants,
  classroomFadeUpVariants,
  classroomQuickTransition,
  classroomSpinTransition,
  classroomStaggerVariants,
} from '@/features/tour-ai/components/classroom-motion'

interface QuizPracticeCardProps {
  quiz: ClassroomQuiz
  isActive: boolean
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
  lastRun: RunResult | null
}

type QuizAttemptMode = 'run' | 'submit'
type QuizPanelTab = 'case' | 'result'

interface QuizFeedback {
  mode: QuizAttemptMode
  matched: boolean
}

export function QuizPracticeCard({
  quiz,
  isActive,
  lang,
  dispatch,
  bridge,
  lastRun,
}: QuizPracticeCardProps) {
  const [busyMode, setBusyMode] = useState<QuizAttemptMode | null>(null)
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null)
  const [activePanelTab, setActivePanelTab] = useState<QuizPanelTab>('case')
  const { beginRunnerRun, endRunnerRun } = useClassroomActivity()
  const mountedRef = useRef(true)
  const busy = busyMode !== null

  // Per-card editor handle: each quiz owns its own Monaco instance (model URI
  // namespaced by quiz id) so multiple quizzes on the same page don't fight
  // over a singleton editor and don't lose their content when re-mounted.
  const [editorHandle, setEditorHandle] = useState<MonacoEditorHandle | undefined>()
  const handleEditorReady = useCallback((handle: MonacoEditorHandle) => {
    setEditorHandle(handle)
  }, [])

  // Register the active quiz's editor in the shared bridge so chat tools
  // (highlight_editor_lines, reveal_editor_line, …) target the focused quiz.
  // Inactive quizzes leave the bridge alone — clearing on unmount only when we
  // were the registered editor avoids clobbering the next card that mounts.
  //
  // NOTE: read_editor_code does NOT depend on this bridge anymore — it falls
  // back through monaco.editor.getModel(uri) → draft store → starter code, so
  // it can answer "what is the learner currently writing" without requiring
  // the right card to be the registered one.
  useEffect(() => {
    if (!isActive || !editorHandle)
      return
    const ed = editorHandle.getEditor()
    if (!ed)
      return
    bridge.editor.setEditor(ed)
    return () => {
      if (bridge.editor.getEditor() === ed)
        bridge.editor.setEditor(undefined)
    }
  }, [isActive, editorHandle, bridge.editor])

  // Clean up the persisted draft once the quiz is no longer "in progress" —
  // success / skip outcomes mean the learner is done with this slot. Without
  // this hook, localStorage accumulates drafts for every quiz the learner has
  // ever seen, with no bound. We keep the draft alive while status === 'active'
  // (in case of refresh mid-attempt) and 'superseded' (rare, only if AI
  // re-issues a quiz before the learner submitted).
  useEffect(() => {
    if (quiz.status === 'success' || quiz.status === 'skip')
      useQuizDraftStore.getState().clearDraft(quiz.id)
  }, [quiz.id, quiz.status])

  // Draft persistence: mirror Monaco's model content into a Zustand store
  // keyed by quiz id so AI tools and a future "restore draft on reload" path
  // can always reach the learner's latest code, independent of React mount
  // lifecycle. Subscribes once per editor instance.
  useEffect(() => {
    if (!editorHandle)
      return
    const editor = editorHandle.getEditor()
    const model = editor?.getModel()
    if (!editor || !model)
      return

    // If a persisted draft diverges from the model's current content, prefer
    // the draft — this handles the page-reload case where the model was just
    // created from starter code. Within the same page session, the model has
    // already accumulated edits, so we skip the restore to avoid clobbering.
    const persisted = useQuizDraftStore.getState().getDraft(quiz.id)
    const current = model.getValue()
    if (persisted && persisted.code !== current && current === quiz.starterCode)
      model.setValue(persisted.code)

    // Debounced write-back so AI / refresh always sees a near-fresh draft
    // without thrashing localStorage on every keystroke.
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      timer = undefined
      useQuizDraftStore.getState().setDraft(quiz.id, model.getValue())
    }
    const sub = model.onDidChangeContent(() => {
      if (timer)
        clearTimeout(timer)
      timer = setTimeout(flush, 300)
    })
    return () => {
      if (timer) {
        clearTimeout(timer)
        flush()
      }
      sub.dispose()
    }
  }, [editorHandle, quiz.id, quiz.starterCode])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const finishAttempt = (mode: QuizAttemptMode, result: RunResult, attemptedCode: string) => {
    const matched = result.ok && evaluateQuizOutput(quiz, result.stdout).matched
    setFeedback({ mode, matched })
    setActivePanelTab('result')
    dispatch({
      type: mode === 'submit' ? 'QUIZ_SUBMIT_FINISHED' : 'QUIZ_RUN_FINISHED',
      result,
      attemptedCode,
      now: Date.now(),
    })
  }

  const runQuiz = async (mode: QuizAttemptMode) => {
    setBusyMode(mode)
    beginRunnerRun(quiz.id)
    // Capture code BEFORE running so we can attach it to the dispatch even on
    // failure paths (network error, throw, etc.); the editor may have changed
    // between submit and the time we'd otherwise re-read it.
    const attemptedCode = editorHandle?.getEditor()?.getModel()?.getValue() ?? quiz.starterCode
    try {
      const data = await requestRemoteAction(attemptedCode, 'run')
      const result: RunResult = {
        ok: data.compiler_code === 0 && data.bin_code === 0,
        stdout: data.bin_output,
        stderr: data.compiler_output,
        exitCode: data.bin_code,
      }
      if (!mountedRef.current)
        return
      finishAttempt(mode, result, attemptedCode)
    }
    catch (error) {
      if (!mountedRef.current)
        return
      finishAttempt(mode, {
        ok: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: null,
      }, attemptedCode)
    }
    finally {
      if (mountedRef.current)
        setBusyMode(null)
      endRunnerRun(quiz.id)
    }
  }

  const resetEditor = () => {
    editorHandle?.getEditor()?.getModel()?.setValue(quiz.starterCode)
  }

  const visibleFeedback = feedback ?? (lastRun
    ? { mode: 'run' as const, matched: lastRun.ok && evaluateQuizOutput(quiz, lastRun.stdout).matched }
    : null)
  const resultOutput = lastRun?.stdout ?? ''
  // stderr here is the compiler/linker trace from the remote runner — it is
  // present on every run (success or failure), not just on errors. Treat it
  // as "tool output" and fold it by default unless the run actually failed.
  const toolOutput = lastRun?.stderr ?? ''
  const runFailed = lastRun != null && !lastRun.ok
  // cjc emits ANSI colour escapes; render them as styled HTML the same way
  // the main playground OutputPanel does so users don't see raw "[31m" / "[0m".
  const resultOutputHtml = useMemo(() => new AnsiUp().ansi_to_html(resultOutput), [resultOutput])
  const toolOutputHtml = useMemo(() => new AnsiUp().ansi_to_html(toolOutput), [toolOutput])
  const [toolOutputOpen, setToolOutputOpen] = useState(false)
  // Auto-expand when a failed run appears so users see the diagnostic without
  // hunting for it. Subsequent manual collapse/expand is preserved until the
  // next failed run.
  useEffect(() => {
    if (runFailed)
      setToolOutputOpen(true)
  }, [runFailed, lastRun?.stderr])

  // AI-staged code suggestion for THIS quiz. The chat tool stages the proposal
  // into the global store; we surface it as a banner and never auto-apply.
  const suggestion = useCodeSuggestionStore(state =>
    state.suggestion?.quizId === quiz.id ? state.suggestion : null,
  )
  const clearSuggestion = useCodeSuggestionStore(state => state.setSuggestion)
  const applySuggestion = useCallback(() => {
    if (!suggestion)
      return
    editorHandle?.getEditor()?.getModel()?.setValue(suggestion.code)
    clearSuggestion(null)
  }, [suggestion, editorHandle, clearSuggestion])
  // NOTE: we deliberately do NOT clear the suggestion on QuizPracticeCard
  // unmount. Virtuoso unmounts cards that scroll off-screen — clearing here
  // would silently discard a staged suggestion the learner hasn't acted on,
  // and they'd come back to find the banner gone with no explanation. The
  // suggestion's natural lifecycle is:
  //   • user clicks Apply / Dismiss → setSuggestion(null) inline
  //   • the agent stages a new suggestion → overwrites the slot
  //   • the active quiz transitions → cleared by the effect below
  useEffect(() => {
    // When the active quiz changes (id moves or status leaves 'active'),
    // any leftover suggestion targeting a stale quiz is no longer actionable.
    // Only this active-quiz card runs the cleanup — inactive cards leave the
    // store alone so they don't fight each other.
    if (!isActive)
      return
    return () => {
      const current = useCodeSuggestionStore.getState().suggestion
      if (current && current.quizId !== quiz.id)
        useCodeSuggestionStore.getState().setSuggestion(null)
    }
  }, [isActive, quiz.id])

  return (
    <motion.section
      data-testid="quiz-practice-card"
      variants={classroomStaggerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      <motion.div layout variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-tour-heading"><Trans>Practice</Trans></div>
            <div className="mt-1 text-xs font-semibold text-tour-link">
              <Trans>Quiz</Trans>
              {' '}
              {quiz.status}
            </div>
          </div>
          {isActive && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'QUIZ_SKIP', now: Date.now() })}
              disabled={busy}
              data-testid="quiz-skip-and-read"
              className="shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-tour-link disabled:opacity-40"
            >
              <Trans>我先读后练 →</Trans>
            </button>
          )}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{quiz.prompt}</p>
      </motion.div>

      <AnimatePresence initial={false}>
        {suggestion && isActive && (
          <motion.section
            key="quiz-suggestion-banner"
            data-testid="quiz-suggestion-banner"
            variants={classroomCardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden rounded-md border border-tour-accent-fg/30 bg-tour-accent-fg/5"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-tour-accent-fg" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-tour-text">
                  <Trans>AI 建议的修改</Trans>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {suggestion.explanation}
                </p>
                <details className="mt-2 group">
                  <summary className="cursor-pointer text-[11px] font-medium text-tour-link hover:underline">
                    <Trans>查看建议代码</Trans>
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-tour-code-bg px-3 py-2 font-mono text-xs leading-relaxed text-tour-text">
                    {suggestion.code}
                  </pre>
                </details>
              </div>
              <button
                type="button"
                onClick={() => clearSuggestion(null)}
                aria-label="dismiss-suggestion"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-tour-bg"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-tour-accent-fg/20 bg-tour-surface/60 px-4 py-2">
              <button
                type="button"
                onClick={() => clearSuggestion(null)}
                className="text-xs font-medium text-muted-foreground hover:text-tour-text"
              >
                <Trans>忽略</Trans>
              </button>
              <button
                type="button"
                onClick={applySuggestion}
                data-testid="quiz-suggestion-apply"
                className="inline-flex items-center gap-1.5 rounded-md bg-tour-accent-fg px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
              >
                <Sparkles className="size-3.5" />
                <Trans>应用建议</Trans>
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.section layout variants={classroomCardVariants} data-testid="quiz-code-panel" className="overflow-hidden rounded-md border border-tour-border bg-tour-surface">
        <div className="flex h-11 items-center justify-between border-b border-tour-border px-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-tour-heading">
            <Code2 className="size-4 text-classroom-success-fg" />
            <Trans>代码</Trans>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Cangjie</span>
            <button type="button" aria-label="重置代码" onClick={resetEditor} className="inline-flex size-7 items-center justify-center rounded hover:bg-tour-bg">
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>
        <div className="h-[430px] border-b border-tour-border">
          <TourEditor
            code={quiz.starterCode}
            locale={lang}
            layout="editorOnly"
            // LSP is page-singleton (see ensureLanguageClient in
            // src/lib/monaco/language-client.ts): repeated startLsp() and
            // ensureLanguageClient() calls across multiple quiz cards all
            // resolve to the same client, so flipping this on is safe and
            // gives every quiz card hover / completion / diagnostics on its
            // own per-quiz model URI.
            enableLanguageClient
            uriHint={quiz.id}
            readOnly={!isActive}
            onEditorReady={handleEditorReady}
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="truncate text-xs text-muted-foreground">
            <Trans>行 1，列 1</Trans>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'QUIZ_SKIP', now: Date.now() })}
              disabled={busy || !isActive}
              className="inline-flex items-center gap-2 rounded-md border border-tour-border px-3 py-2 text-sm text-muted-foreground hover:bg-tour-bg disabled:opacity-50"
            >
              <SkipForward className="size-4" />
              <Trans>Skip</Trans>
            </button>
            <button
              type="button"
              onClick={() => runQuiz('run')}
              disabled={busy || !isActive}
              className="inline-flex items-center gap-2 rounded-md bg-tour-bg px-4 py-2 text-sm font-semibold text-tour-text hover:bg-tour-border-soft disabled:opacity-50"
            >
              <AnimatePresence initial={false} mode="wait">
                {busyMode === 'run'
                  ? <MotionSpinner key="run-spinner" className="size-4" />
                  : <MotionIcon key="run-icon"><Play className="size-4" /></MotionIcon>}
              </AnimatePresence>
              <Trans>运行</Trans>
            </button>
            <button
              type="button"
              onClick={() => runQuiz('submit')}
              disabled={busy || !isActive}
              className="inline-flex items-center gap-2 rounded-md bg-classroom-success-fg px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:bg-tour-border-soft"
            >
              <AnimatePresence initial={false} mode="wait">
                {busyMode === 'submit'
                  ? <MotionSpinner key="submit-spinner" className="size-4" />
                  : <MotionIcon key="submit-icon"><Send className="size-4" /></MotionIcon>}
              </AnimatePresence>
              <Trans>提交</Trans>
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section layout variants={classroomCardVariants} data-testid="quiz-test-panel" className="overflow-hidden rounded-md border border-tour-border bg-tour-surface">
        <div className="flex h-11 items-center gap-2 border-b border-tour-border px-3" role="tablist" aria-label="练习输出">
          <button
            type="button"
            role="tab"
            aria-selected={activePanelTab === 'case'}
            onClick={() => setActivePanelTab('case')}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-tour-heading aria-selected:text-classroom-success-fg"
          >
            <ListChecks className="size-4" />
            <Trans>测试用例</Trans>
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            type="button"
            role="tab"
            aria-selected={activePanelTab === 'result'}
            onClick={() => setActivePanelTab('result')}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground aria-selected:text-classroom-success-fg"
          >
            <Trans>测试结果</Trans>
          </button>
        </div>
        <div className="min-h-[170px] p-4">
          <AnimatePresence initial={false} mode="wait">
            {activePanelTab === 'case'
              ? (
                  <motion.div
                    key="quiz-case-panel"
                    variants={classroomFadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-4"
                  >
                    <div className="inline-flex rounded-md bg-tour-bg px-4 py-2 text-sm font-semibold text-tour-heading">Case 1</div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        <Trans>Expected output</Trans>
                        {' '}
                        =
                      </div>
                      <pre className="rounded-md bg-tour-code-bg px-4 py-3 font-mono text-sm text-tour-text">{quiz.expectedOutput}</pre>
                    </div>
                  </motion.div>
                )
              : (
                  <motion.div
                    key="quiz-result-panel"
                    variants={classroomFadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-3"
                  >
                    <AnimatePresence initial={false} mode="wait">
                      {visibleFeedback
                        ? (
                            <motion.div
                              key={`${visibleFeedback.mode}:${visibleFeedback.matched}`}
                              variants={classroomCardVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="inline-flex items-center gap-2 rounded-md border border-tour-border bg-tour-bg px-3 py-2 text-sm font-semibold text-tour-text"
                            >
                              {visibleFeedback.matched
                                ? <CheckCircle2 className="size-4 text-classroom-success-fg" />
                                : <XCircle className="size-4 text-destructive" />}
                              {visibleFeedback.mode === 'run'
                                ? visibleFeedback.matched ? <Trans>运行结果：正确</Trans> : <Trans>运行结果：错误</Trans>
                                : visibleFeedback.matched ? <Trans>提交结果：正确</Trans> : <Trans>提交结果：错误</Trans>}
                            </motion.div>
                          )
                        : (
                            <motion.div
                              key="quiz-result-empty"
                              variants={classroomFadeUpVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="text-sm text-muted-foreground"
                            >
                              <Trans>运行或提交后查看测试结果。</Trans>
                            </motion.div>
                          )}
                    </AnimatePresence>
                    <pre data-testid="quiz-test-result-output" className="whitespace-pre-wrap rounded-md bg-tour-code-bg px-4 py-3 font-mono text-sm text-tour-text">
                      <Trans>输出：</Trans>
                      {resultOutput
                        ? <span dangerouslySetInnerHTML={{ __html: resultOutputHtml }} />
                        : <Trans>（空）</Trans>}
                    </pre>
                    {toolOutput && (
                      <Collapsible
                        open={toolOutputOpen}
                        onOpenChange={setToolOutputOpen}
                        // Put the border and background on the root so the
                        // CollapsibleContent grows inside the same card instead
                        // of materialising as a second bordered box.
                        className={cn(
                          'overflow-hidden rounded-md border',
                          runFailed
                            ? 'border-destructive/40 bg-destructive/5'
                            : 'border-tour-border bg-tour-code-bg',
                        )}
                        style={{ ['--animation-duration' as string]: '200ms' }}
                      >
                        <CollapsibleTrigger
                          data-testid="quiz-tool-output-trigger"
                          className={cn(
                            'group/trigger flex w-full items-center gap-2 px-3 py-2 text-xs font-mono transition-colors',
                            runFailed
                              ? 'text-destructive hover:bg-destructive/10'
                              : 'text-muted-foreground hover:bg-tour-bg/60',
                          )}
                        >
                          <Terminal className="size-3.5 shrink-0" />
                          <span><Trans>工具输出</Trans></span>
                          <ChevronDown className="ml-auto size-4 shrink-0 transition-transform group-data-[state=closed]/trigger:-rotate-90" />
                        </CollapsibleTrigger>
                        <CollapsibleContent
                          data-testid="quiz-tool-output-body"
                          className={cn(
                            'overflow-hidden ease-out',
                            'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
                            'data-[state=closed]:pointer-events-none data-[state=closed]:fill-mode-forwards',
                            'data-[state=open]:duration-(--animation-duration)',
                            'data-[state=closed]:duration-(--animation-duration)',
                          )}
                        >
                          <pre
                            className={cn(
                              'max-h-72 overflow-auto whitespace-pre-wrap break-all border-t px-3 py-2 font-mono text-xs leading-relaxed',
                              runFailed
                                ? 'border-destructive/30 text-destructive'
                                : 'border-tour-border text-muted-foreground',
                            )}
                            dangerouslySetInnerHTML={{ __html: toolOutputHtml }}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </motion.div>
                )}
          </AnimatePresence>
        </div>
      </motion.section>
    </motion.section>
  )
}

function MotionIcon({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={classroomQuickTransition}
      className="inline-flex size-4 items-center justify-center"
    >
      {children}
    </motion.span>
  )
}

function MotionSpinner({ className }: { className: string }) {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1, rotate: 360 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{
        opacity: classroomQuickTransition,
        scale: classroomQuickTransition,
        rotate: classroomSpinTransition,
      }}
      className="inline-flex size-4 shrink-0 items-center justify-center"
    >
      <Loader2 className={className} />
    </motion.span>
  )
}
