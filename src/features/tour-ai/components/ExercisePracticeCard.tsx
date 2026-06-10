'use client'

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react'
import { AnsiUp } from 'ansi_up'
import { CheckCircle2, ChevronDown, Code2, ListChecks, Loader2, Play, RotateCcw, Send, SkipForward, Sparkles, Terminal, X, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { TourEditor } from '@/features/tour/components/TourEditor'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { evaluateExerciseOutput } from '@/lib/ai/classroom/reducer'
import type { ExerciseInstance, RunResult } from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'
import { useActiveExerciseEditorRegistration, useExerciseDraftPersistence, useExerciseWorkspaceCleanup } from '@/features/tour-ai/exercise-workspace/use-exercise-editor-workspace'
import { useStagedCodeSuggestion } from '@/features/tour-ai/exercise-workspace/use-staged-code-suggestion'
import { useExerciseAttemptRunner } from '@/features/tour-ai/exercise-workspace/use-exercise-attempt-runner'
import type { ExerciseAttemptMode, ExerciseFeedback } from '@/features/tour-ai/exercise-workspace/use-exercise-attempt-runner'
import { closeClassroomTransientPanels } from './classroom-transient-panels'

interface ExercisePracticeCardProps {
  exercise: ExerciseInstance
  isActive: boolean
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
  lastRun: RunResult | null
  focusRequestKey?: number
  onReturnToReview?: (conceptId: string) => void
}

type ExercisePanelTab = 'case' | 'result'
type SkipTriggerSource = 'header' | 'action'

export function ExercisePracticeCard({
  exercise,
  isActive,
  lang,
  dispatch,
  bridge,
  lastRun,
  focusRequestKey,
  onReturnToReview,
}: ExercisePracticeCardProps) {
  const [activePanelTab, setActivePanelTab] = useState<ExercisePanelTab>('case')
  const [skipConfirmExerciseId, setSkipConfirmExerciseId] = useState<string | null>(null)
  const [resetConfirmExerciseId, setResetConfirmExerciseId] = useState<string | null>(null)
  const busyStatusId = useId()
  const runActionDescriptionId = useId()
  const submitActionDescriptionId = useId()
  const runCorrectSubmitHintId = useId()
  const skipActionDescriptionId = useId()
  const skipConfirmTitleId = useId()
  const skipConfirmDescriptionId = useId()
  const resetConfirmTitleId = useId()
  const resetConfirmDescriptionId = useId()
  const suggestionTitleId = useId()
  const suggestionDescriptionId = useId()
  const suggestionDismissDescriptionId = useId()
  const appliedSuggestionUndoDescriptionId = useId()
  const resetDescriptionId = useId()
  const caseTabId = useId()
  const resultTabId = useId()
  const caseTabDescriptionId = useId()
  const resultTabDescriptionId = useId()
  const casePanelId = useId()
  const resultPanelId = useId()
  const toolOutputTriggerId = useId()
  const toolOutputBodyId = useId()
  const runnerRetryDescriptionId = useId()
  const focusNoticeId = useId()

  // Per-card editor handle: each exercise owns its own Monaco instance (model URI
  // namespaced by exercise id) so multiple exercises on the same page don't fight
  // over a singleton editor and don't lose their content when re-mounted.
  const [editorHandle, setEditorHandle] = useState<MonacoEditorHandle | undefined>()
  const [editorRevision, setEditorRevision] = useState(0)
  const headerSkipButtonRef = useRef<HTMLButtonElement | null>(null)
  const actionSkipButtonRef = useRef<HTMLButtonElement | null>(null)
  const skipCancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const resetButtonRef = useRef<HTMLButtonElement | null>(null)
  const resetCancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const codePanelRef = useRef<HTMLElement | null>(null)
  const skipFocusReturnSourceRef = useRef<SkipTriggerSource | null>(null)
  const [appliedSuggestionUndo, setAppliedSuggestionUndo] = useState<{
    exerciseId: string
    previousCode: string
    appliedCode: string
    appliedAt: number
  } | null>(null)
  const [appliedSuggestionUndoBlocked, setAppliedSuggestionUndoBlocked] = useState(false)
  const handleEditorReady = useCallback((handle: MonacoEditorHandle) => {
    setEditorHandle(handle)
  }, [])

  useActiveExerciseEditorRegistration({ isActive, editorHandle, bridge })
  useExerciseWorkspaceCleanup(exercise)
  useExerciseDraftPersistence({ editorHandle, exercise })
  useEffect(() => {
    const model = editorHandle?.getEditor()?.getModel()
    if (!model)
      return
    const subscription = model.onDidChangeContent(() => {
      setEditorRevision(revision => revision + 1)
    })
    return () => {
      subscription.dispose()
    }
  }, [editorHandle])
  const appliedAssistanceCount = useCodeSuggestionStore(state => state.appliedAssistanceByExerciseId[exercise.id]?.length ?? 0)
  const { busyMode, busy, feedback, runExercise } = useExerciseAttemptRunner({
    exercise,
    editorHandle,
    dispatch,
    onResult: () => setActivePanelTab('result'),
  })
  const isReviewCheck = exercise.intent === 'review_check'
  const busyStatusText = busyMode ? exerciseBusyStatusText(busyMode, isReviewCheck) : null
  const returnReviewConceptId = isReviewCheck ? exercise.conceptIds[0] : undefined
  const reviewCheckRecorded = isReviewCheck && !isActive && (exercise.status === 'success' || exercise.status === 'skip')
  const focusNoticeVisible = isActive && focusRequestKey != null
  const hasAppliedAssistance = appliedAssistanceCount > 0
  const editorReady = editorHandle != null
  const skipConfirming = skipConfirmExerciseId === exercise.id && isActive && !busy
  const resetConfirming = resetConfirmExerciseId === exercise.id && isActive && !busy && editorReady
  const runActionDescription = !isActive
    ? isReviewCheck
      ? t`这条复习检查记录只读，不能运行代码。`
      : t`这条练习记录只读，不能运行代码。`
    : !editorReady
        ? isReviewCheck
          ? t`复习检查编辑器仍在加载，加载完成后才能运行代码。`
          : t`练习编辑器仍在加载，加载完成后才能运行代码。`
        : busy
          ? busyMode === 'run'
            ? isReviewCheck
              ? t`复习检查正在运行，完成后才能再次运行。`
              : t`练习正在运行，完成后才能再次运行。`
            : isReviewCheck
              ? t`复习检查正在提交，完成后才能运行。`
              : t`练习正在提交，完成后才能运行。`
          : isReviewCheck
            ? t`运行只会执行当前复习检查代码并显示结果，不会记录复习检查进度。`
            : t`运行只会执行当前练习代码并显示结果，不会记录练习进度。`
  const submitActionDescription = !isActive
    ? isReviewCheck
      ? t`这条复习检查记录只读，不能再次提交。`
      : t`这条练习记录只读，不能再次提交。`
    : !editorReady
        ? isReviewCheck
          ? t`复习检查编辑器仍在加载，加载完成后才能提交。`
          : t`练习编辑器仍在加载，加载完成后才能提交。`
        : busy
          ? busyMode === 'submit'
            ? isReviewCheck
              ? t`复习检查正在提交，请勿重复提交。`
              : t`练习正在提交，请勿重复提交。`
            : isReviewCheck
              ? t`复习检查正在运行，完成后才能提交。`
              : t`练习正在运行，完成后才能提交。`
          : hasAppliedAssistance
            ? isReviewCheck
              ? t`提交会运行当前代码，并把结果记录为 AI 帮助后的较弱复习检查证据。`
              : t`提交会运行当前代码，并把结果记录为 AI 帮助后的较弱练习证据。`
            : isReviewCheck
              ? t`提交会运行当前代码，并把结果记录为这次复习检查证据。`
              : t`提交会运行当前代码，并把结果记录为这道练习的学习证据。`
  const skipActionDescription = !isActive
    ? isReviewCheck
      ? t`这条复习检查记录只读，不能跳过。`
      : t`这条练习记录只读，不能跳过。`
    : busy
      ? isReviewCheck
        ? t`复习检查正在运行或提交，完成后才能跳过。`
        : t`练习正在运行或提交，完成后才能跳过。`
      : isReviewCheck
        ? t`会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并保留当前复习进度。`
        : t`会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。`
  const suggestionApplyDisabled = !editorReady || busy
  const suggestionApplyDescription = !editorReady
    ? isReviewCheck
      ? t`复习检查编辑器仍在加载，加载完成后才能应用建议；不会自动运行或提交。`
      : t`练习编辑器仍在加载，加载完成后才能应用建议；不会自动运行或提交。`
    : busy
      ? isReviewCheck
        ? t`复习检查正在运行或提交，完成后才能应用建议，避免代码和结果不一致。`
        : t`练习正在运行或提交，完成后才能应用建议，避免代码和结果不一致。`
      : isReviewCheck
        ? t`应用后会替换当前复习检查编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。`
        : t`应用后会替换当前练习编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。`
  const suggestionDismissDescription = t`只会丢弃这条 AI 建议，不会改变当前代码或课堂进度。`
  const appliedSuggestionUndoDescription = busy
    ? isReviewCheck
      ? t`复习检查正在运行或提交，完成后才能撤回 AI 建议，避免代码和结果不一致。`
      : t`练习正在运行或提交，完成后才能撤回 AI 建议，避免代码和结果不一致。`
    : appliedSuggestionUndoBlocked
      ? isReviewCheck
        ? t`复习检查代码已在应用建议后继续修改。为避免覆盖你的编辑，撤回已暂停；当前代码会保留，后续提交仍会记录为 AI 帮助后的证据。`
        : t`练习代码已在应用建议后继续修改。为避免覆盖你的编辑，撤回已暂停；当前代码会保留，后续提交仍会记录为 AI 帮助后的证据。`
      : isReviewCheck
        ? t`撤回复习检查代码到应用建议前的版本；后续提交不会继续带这次 AI 建议标记，已记录的提交不会改变。`
        : t`撤回练习代码到应用建议前的版本；后续提交不会继续带这次 AI 建议标记，已记录的提交不会改变。`
  const resetDescription = !isActive
    ? isReviewCheck
      ? t`这条复习检查记录只读，不能重置代码。`
      : t`这条练习记录只读，不能重置代码。`
    : !editorReady
        ? isReviewCheck
          ? t`复习检查编辑器仍在加载，加载完成后才能重置代码。`
          : t`练习编辑器仍在加载，加载完成后才能重置代码。`
        : busy
          ? isReviewCheck
            ? t`复习检查正在运行或提交，完成后才能重置代码，避免代码和结果不一致。`
            : t`练习正在运行或提交，完成后才能重置代码，避免代码和结果不一致。`
          : isReviewCheck
            ? t`会先显示确认，不会立即改动当前代码。确认后会恢复到复习检查起始代码，并清除本次已应用的 AI 建议标记。`
            : t`会先显示确认，不会立即改动当前代码。确认后会恢复到练习起始代码，并清除本次已应用的 AI 建议标记。`
  const resetConfirmDescription = isReviewCheck
    ? t`这会恢复到复习检查起始代码，并清除本次已应用的 AI 建议标记；不会自动提交或改变已记录进度。`
    : t`这会恢复到练习起始代码，并清除本次已应用的 AI 建议标记；不会自动提交或改变已记录进度。`
  const caseTabDescription = t`查看测试用例，不会运行、提交或改动代码。`
  const resultTabDescription = t`查看最近一次运行或提交结果，不会运行、提交或改动代码。`

  const resetEditor = () => {
    if (!isActive || !editorReady)
      return
    editorHandle?.getEditor()?.getModel()?.setValue(exercise.starterCode)
    useCodeSuggestionStore.getState().clearAttemptEvidenceForExercise(exercise.id)
    setAppliedSuggestionUndo(null)
    setAppliedSuggestionUndoBlocked(false)
  }

  const requestReset = () => {
    if (!isActive || busy || !editorReady)
      return
    closeClassroomTransientPanels()
    setResetConfirmExerciseId(exercise.id)
  }

  const cancelReset = () => {
    setResetConfirmExerciseId(null)
    resetButtonRef.current?.focus()
  }

  const confirmReset = () => {
    if (!resetConfirming || busy || !editorReady)
      return
    setResetConfirmExerciseId(null)
    resetEditor()
    resetButtonRef.current?.focus()
  }

  const undoAppliedSuggestion = () => {
    if (!isActive || busy || appliedSuggestionUndo?.exerciseId !== exercise.id)
      return
    const model = editorHandle?.getEditor()?.getModel()
    if (!model)
      return
    if (model.getValue() !== appliedSuggestionUndo.appliedCode) {
      setAppliedSuggestionUndoBlocked(true)
      return
    }
    model.setValue(appliedSuggestionUndo.previousCode)
    useCodeSuggestionStore.getState().removeAppliedSuggestion(exercise.id, appliedSuggestionUndo.appliedAt)
    setAppliedSuggestionUndo(null)
    setAppliedSuggestionUndoBlocked(false)
  }

  const focusSkipTrigger = () => {
    const trigger = skipFocusReturnSourceRef.current === 'header'
      ? headerSkipButtonRef.current
      : actionSkipButtonRef.current
    skipFocusReturnSourceRef.current = null
    trigger?.focus()
  }

  const requestSkip = (source: SkipTriggerSource) => {
    if (busy || !isActive)
      return
    closeClassroomTransientPanels()
    skipFocusReturnSourceRef.current = source
    setSkipConfirmExerciseId(exercise.id)
  }

  const cancelSkip = () => {
    setSkipConfirmExerciseId(null)
    focusSkipTrigger()
  }

  const confirmSkip = () => {
    if (!skipConfirming)
      return
    setSkipConfirmExerciseId(null)
    skipFocusReturnSourceRef.current = null
    dispatch({ type: 'EXERCISE_SKIP', now: Date.now() })
  }

  const handleSkipConfirmationKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    cancelSkip()
  }

  const handleResetConfirmationKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    cancelReset()
  }

  const focusExercisePanelTab = useCallback((nextTab: ExercisePanelTab) => {
    setActivePanelTab(nextTab)
    document.getElementById(nextTab === 'case' ? caseTabId : resultTabId)?.focus()
  }, [caseTabId, resultTabId])

  const handlePanelTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'End') {
      event.preventDefault()
      focusExercisePanelTab('result')
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home') {
      event.preventDefault()
      focusExercisePanelTab('case')
    }
  }, [focusExercisePanelTab])

  const displayRun = feedback?.result ?? lastRun
  const visibleFeedback = feedback ?? (lastRun
    ? { mode: lastRun.attemptMode ?? 'run' as const, matched: lastRun.ok && evaluateExerciseOutput(exercise, lastRun.stdout).matched, result: lastRun }
    : null)
  const currentEditorCode = editorRevision >= 0 ? editorHandle?.getEditor()?.getModel()?.getValue() : undefined
  const runCorrectFeedbackVisible = visibleFeedback?.mode === 'run' && visibleFeedback.matched && isActive
  const runCorrectFeedbackCanSubmit = Boolean(
    runCorrectFeedbackVisible
    && visibleFeedback?.attemptedCode != null
    && currentEditorCode != null
    && currentEditorCode === visibleFeedback.attemptedCode,
  )
  const runCorrectFeedbackStale = Boolean(
    runCorrectFeedbackVisible
    && visibleFeedback?.attemptedCode != null
    && currentEditorCode != null
    && currentEditorCode !== visibleFeedback.attemptedCode,
  )
  const runCorrectSubmitHintText = runCorrectFeedbackStale
    ? t`代码已修改。请重新运行，确认当前代码仍然正确后再提交。`
    : isReviewCheck
      ? t`运行结果正确。点击提交后，课堂才会记录这次复习检查结果。`
      : t`运行结果正确。点击提交后，课堂才会记录这次练习进度。`
  const resultCodeStale = Boolean(
    isActive
    && visibleFeedback?.attemptedCode != null
    && currentEditorCode != null
    && currentEditorCode !== visibleFeedback.attemptedCode,
  )
  const genericStaleResultVisible = resultCodeStale && !runCorrectFeedbackStale
  const runnerUnavailable = visibleFeedback?.result.failureKind === 'runner_unavailable'
  const resultOutput = displayRun?.stdout ?? ''
  // stderr here is the compiler/linker trace from the remote runner. It can be
  // present on successful runs too, so fold it by default unless the run failed.
  const toolOutput = displayRun?.stderr ?? ''
  const runFailed = displayRun != null && !displayRun.ok
  // cjc emits ANSI colour escapes; render them as styled HTML the same way
  // the main playground OutputPanel does so users don't see raw "[31m" / "[0m".
  const resultOutputHtml = useMemo(() => new AnsiUp().ansi_to_html(resultOutput), [resultOutput])
  const toolOutputHtml = useMemo(() => new AnsiUp().ansi_to_html(toolOutput), [toolOutput])
  const [toolOutputOpen, dispatchToolOutputOpen] = useReducer(
    (open: boolean, action: boolean | 'toggle') => action === 'toggle' ? !open : action,
    false,
  )
  const toolOutputToggleTitle = toolOutputOpen
    ? t`隐藏编译信息；不会改变代码、测试结果或学习记录。`
    : t`展开编译信息；不会重新运行代码、改变测试结果或学习记录。`
  const runnerRetryDescription = visibleFeedback?.mode === 'submit'
    ? isReviewCheck
      ? t`重试提交会重新运行当前复习检查代码；只有成功提交后才会记录新的复习检查证据。`
      : t`重试提交会重新运行当前练习代码；只有成功提交后才会记录新的学习证据。`
    : isReviewCheck
      ? t`重试运行会重新执行当前复习检查代码；不会记录复习检查进度。`
      : t`重试运行会重新执行当前练习代码；不会记录练习进度。`
  // Auto-expand when a failed run appears so users see the diagnostic without
  // hunting for it. Subsequent manual collapse/expand is preserved until the
  // next failed run.
  useEffect(() => {
    if (runFailed)
      dispatchToolOutputOpen(true)
  }, [runFailed, displayRun?.stderr])

  useEffect(() => {
    if (skipConfirming)
      skipCancelButtonRef.current?.focus()
  }, [skipConfirming])

  useEffect(() => {
    if (resetConfirming)
      resetCancelButtonRef.current?.focus()
  }, [resetConfirming])

  const { suggestion, clearSuggestion, applySuggestion } = useStagedCodeSuggestion({
    exerciseId: exercise.id,
    isActive,
    editorHandle,
  })
  const handleApplySuggestion = () => {
    const applied = applySuggestion()
    if (!applied)
      return
    setAppliedSuggestionUndo({
      exerciseId: applied.exerciseId,
      previousCode: applied.previousCode,
      appliedCode: applied.appliedCode,
      appliedAt: applied.appliedAt,
    })
    setAppliedSuggestionUndoBlocked(false)
  }
  const dismissSuggestion = () => {
    clearSuggestion(null)
    window.requestAnimationFrame(() => {
      const editor = editorHandle?.getEditor()
      if (typeof editor?.focus === 'function') {
        editor.focus()
        return
      }
      codePanelRef.current?.focus()
    })
  }

  return (
    <section
      data-testid="exercise-practice-card"
      data-exercise-id={exercise.id}
      data-active-exercise={isActive ? '' : undefined}
      data-classroom-transient-panel-close-target
      tabIndex={-1}
      aria-describedby={focusNoticeVisible ? focusNoticeId : undefined}
      className={cn(
        'scroll-mt-4 space-y-3 rounded-md outline-none focus:ring-2 focus:ring-tour-link/35 focus:ring-offset-2 focus:ring-offset-tour-bg',
        focusNoticeVisible && 'ring-2 ring-tour-link/35 ring-offset-2 ring-offset-tour-bg',
      )}
    >
      {focusNoticeVisible && (
        <div
          id={focusNoticeId}
          data-testid="exercise-focus-notice"
          role="status"
          className="rounded-md border border-tour-border bg-tour-bg px-3 py-2 text-xs font-medium leading-6 text-tour-heading"
        >
          {isReviewCheck
            ? <Trans>已回到当前复习检查。完成、跳过或提交后再继续复习。</Trans>
            : <Trans>已回到当前练习。完成、跳过或提交后再继续复习。</Trans>}
        </div>
      )}
      {reviewCheckRecorded && returnReviewConceptId && onReturnToReview && (
        <section
          data-testid="exercise-review-return"
          role="status"
          className="rounded-md border border-classroom-success-border bg-classroom-success-bg px-4 py-3 text-sm text-classroom-success-fg"
        >
          <div className="font-semibold">
            {exercise.status === 'success' ? <Trans>复习检查已记录</Trans> : <Trans>已跳过复习检查</Trans>}
          </div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6">
              <Trans>回到复习页查看这个概念的最新进度和下一步建议。</Trans>
            </p>
            <button
              type="button"
              onClick={() => onReturnToReview(returnReviewConceptId)}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-md bg-classroom-success-fg px-3 py-2 text-sm font-semibold text-white hover:brightness-95 sm:w-auto"
            >
              <ListChecks aria-hidden="true" className="size-4" />
              <Trans>查看复习进度</Trans>
            </button>
          </div>
        </section>
      )}
      <span id={skipActionDescriptionId} className="sr-only">
        {skipActionDescription}
      </span>
      <span id={resetDescriptionId} className="sr-only">
        {resetDescription}
      </span>
      <span id={appliedSuggestionUndoDescriptionId} className="sr-only">
        {appliedSuggestionUndoDescription}
      </span>
      <span id={runActionDescriptionId} className="sr-only">
        {runActionDescription}
      </span>
      <span id={submitActionDescriptionId} className="sr-only">
        {submitActionDescription}
      </span>
      <div className="rounded-md border border-tour-border bg-tour-surface px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-tour-heading">
              {isReviewCheck ? <Trans>复习检查</Trans> : <Trans>练习</Trans>}
            </div>
            <div className="mt-1 text-xs font-semibold text-tour-link">
              <ExerciseStatusLabel status={exercise.status} intent={exercise.intent} />
            </div>
          </div>
          {isActive && (
            <button
              ref={headerSkipButtonRef}
              type="button"
              onClick={() => requestSkip('header')}
              disabled={busy}
              aria-describedby={skipActionDescriptionId}
              title={skipActionDescription}
              data-testid="exercise-skip-and-read"
              className="hidden shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-tour-link disabled:opacity-40 sm:inline-flex"
            >
              <Trans>跳过并记录 →</Trans>
            </button>
          )}
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{exercise.prompt}</p>
      </div>

      {skipConfirming && (
        <section
          data-testid="exercise-skip-confirmation"
          role="group"
          aria-labelledby={skipConfirmTitleId}
          aria-describedby={skipConfirmDescriptionId}
          onKeyDown={handleSkipConfirmationKeyDown}
          className="rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-4 py-3 text-xs text-classroom-warning-fg"
        >
          <div id={skipConfirmTitleId} className="font-semibold">
            {isReviewCheck ? <Trans>确认跳过这次复习检查？</Trans> : <Trans>确认跳过这道练习？</Trans>}
          </div>
          <p id={skipConfirmDescriptionId} className="mt-1 leading-6">
            {isReviewCheck
              ? <Trans>课堂会记录为已跳过，并保留当前复习进度。</Trans>
              : <Trans>课堂会记录为已跳过，并让 AI 准备更合适的下一步。</Trans>}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              ref={skipCancelButtonRef}
              type="button"
              onClick={cancelSkip}
              aria-describedby={skipConfirmDescriptionId}
              className="inline-flex items-center justify-center rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg"
            >
              {isReviewCheck ? <Trans>继续复习检查</Trans> : <Trans>继续练习</Trans>}
            </button>
            <button
              type="button"
              onClick={confirmSkip}
              disabled={busy || !isActive}
              aria-describedby={skipConfirmDescriptionId}
              className="inline-flex items-center justify-center rounded-md bg-classroom-warning-fg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Trans>确认跳过</Trans>
            </button>
          </div>
        </section>
      )}

      {suggestion && isActive && (
        <section
          data-testid="exercise-suggestion-banner"
          aria-labelledby={suggestionTitleId}
          aria-describedby={suggestionDescriptionId}
          className="overflow-hidden rounded-md border border-tour-accent-fg/30 bg-tour-accent-fg/5"
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tour-accent-fg" />
            <div className="min-w-0 flex-1">
              <div id={suggestionTitleId} className="text-sm font-semibold text-tour-text">
                <Trans>AI 建议的修改</Trans>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                {suggestion.explanation}
              </p>
              <p id={suggestionDescriptionId} className="sr-only">
                {suggestionApplyDescription}
              </p>
              <p id={suggestionDismissDescriptionId} className="sr-only">
                {suggestionDismissDescription}
              </p>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-[11px] font-medium text-tour-link hover:underline">
                  <Trans>查看建议代码</Trans>
                </summary>
                <pre className="mt-2 max-h-64 max-w-full overflow-auto rounded-md bg-tour-code-bg px-3 py-2 font-mono text-xs leading-relaxed text-tour-text">
                  {suggestion.code}
                </pre>
              </details>
            </div>
            <button
              type="button"
              onClick={dismissSuggestion}
              aria-label={t`关闭建议`}
              aria-describedby={suggestionDismissDescriptionId}
              title={suggestionDismissDescription}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-tour-bg"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 border-t border-tour-accent-fg/20 bg-tour-surface/60 px-4 py-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={dismissSuggestion}
              aria-describedby={suggestionDismissDescriptionId}
              title={suggestionDismissDescription}
              className="inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-tour-bg hover:text-tour-text sm:w-auto"
            >
              <Trans>忽略</Trans>
            </button>
            <button
              type="button"
              onClick={handleApplySuggestion}
              aria-describedby={suggestionDescriptionId}
              title={suggestionApplyDescription}
              disabled={suggestionApplyDisabled}
              data-testid="exercise-suggestion-apply"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-tour-accent-fg px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              <Trans>应用建议</Trans>
            </button>
          </div>
        </section>
      )}

      {appliedSuggestionUndo?.exerciseId === exercise.id && isActive && (
        <section
          data-testid="exercise-suggestion-applied"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-col gap-2 rounded-md border border-tour-accent-fg/30 bg-tour-accent-fg/5 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 break-words leading-6">
            <span className="font-semibold text-tour-heading"><Trans>已应用 AI 建议</Trans></span>
            <span className="ml-2">{appliedSuggestionUndoDescription}</span>
          </div>
          <button
            type="button"
            aria-describedby={appliedSuggestionUndoDescriptionId}
            title={appliedSuggestionUndoDescription}
            onClick={undoAppliedSuggestion}
            disabled={busy}
            className="inline-flex w-full shrink-0 items-center justify-center rounded-md border border-tour-accent-fg/30 bg-tour-surface px-3 py-1.5 text-xs font-semibold text-tour-heading hover:bg-tour-bg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Trans>撤回应用</Trans>
          </button>
        </section>
      )}

      <section
        ref={codePanelRef}
        tabIndex={-1}
        data-testid="exercise-code-panel"
        className="overflow-hidden rounded-md border border-tour-border bg-tour-surface focus:outline-none focus:ring-2 focus:ring-tour-link/35 focus:ring-offset-2 focus:ring-offset-tour-bg"
      >
        <div className="flex h-11 items-center justify-between border-b border-tour-border px-3">
          <div data-testid="exercise-code-title" className="inline-flex items-center gap-2 text-sm font-semibold text-tour-heading">
            <Code2 aria-hidden="true" className="size-4 text-classroom-success-fg" />
            <Trans>代码</Trans>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Cangjie</span>
            <button
              ref={resetButtonRef}
              type="button"
              aria-label={t`重置代码`}
              aria-describedby={resetDescriptionId}
              title={resetDescription}
              onClick={requestReset}
              disabled={!isActive || busy || !editorReady}
              className="inline-flex size-7 items-center justify-center rounded hover:bg-tour-bg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        {resetConfirming && (
          <section
            data-testid="exercise-reset-confirmation"
            role="group"
            aria-labelledby={resetConfirmTitleId}
            aria-describedby={resetConfirmDescriptionId}
            onKeyDown={handleResetConfirmationKeyDown}
            className="border-b border-classroom-warning-border bg-classroom-warning-bg px-4 py-3 text-xs text-classroom-warning-fg"
          >
            <div id={resetConfirmTitleId} className="font-semibold">
              {isReviewCheck ? <Trans>确认重置复习检查代码？</Trans> : <Trans>确认重置代码？</Trans>}
            </div>
            <p id={resetConfirmDescriptionId} className="mt-1 leading-6">
              {resetConfirmDescription}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                ref={resetCancelButtonRef}
                type="button"
                onClick={cancelReset}
                aria-describedby={resetConfirmDescriptionId}
                className="inline-flex items-center justify-center rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg"
              >
                <Trans>保留当前代码</Trans>
              </button>
              <button
                type="button"
                onClick={confirmReset}
                aria-describedby={resetConfirmDescriptionId}
                className="inline-flex items-center justify-center rounded-md bg-classroom-warning-fg px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Trans>确认重置</Trans>
              </button>
            </div>
          </section>
        )}
        <div className="h-[320px] border-b border-tour-border sm:h-[430px]">
          <TourEditor
            code={exercise.starterCode}
            locale={lang}
            layout="editorOnly"
            // LSP is page-singleton (see ensureLanguageClient in
            // src/lib/monaco/language-client.ts): repeated startLsp() and
            // ensureLanguageClient() calls across multiple exercise cards all
            // resolve to the same client, so flipping this on is safe and
            // gives every exercise card hover / completion / diagnostics on its
            // own per-exercise model URI.
            enableLanguageClient
            uriHint={exercise.id}
            readOnly={!isActive}
            onEditorReady={handleEditorReady}
          />
        </div>
        <div
          data-testid="exercise-action-bar"
          aria-busy={busy ? 'true' : 'false'}
          aria-describedby={busyStatusText ? busyStatusId : undefined}
          className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          {busyStatusText && (
            <span
              id={busyStatusId}
              data-testid="exercise-busy-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {busyStatusText}
            </span>
          )}
          <div className="truncate text-xs text-muted-foreground">
            <Trans>行 1，列 1</Trans>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              ref={actionSkipButtonRef}
              type="button"
              onClick={() => requestSkip('action')}
              disabled={busy || !isActive}
              aria-describedby={skipActionDescriptionId}
              title={skipActionDescription}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-tour-border px-3 py-2 text-sm text-muted-foreground hover:bg-tour-bg disabled:opacity-50 sm:col-span-1"
            >
              <SkipForward aria-hidden="true" className="size-4" />
              <Trans>跳过并记录</Trans>
            </button>
            <button
              type="button"
              onClick={() => runExercise('run')}
              disabled={busy || !isActive || !editorReady}
              aria-describedby={runActionDescriptionId}
              title={runActionDescription}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-tour-bg px-4 py-2 text-sm font-semibold text-tour-text hover:bg-tour-border-soft disabled:opacity-50"
            >
              {busyMode === 'run'
                ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      <Trans>运行中</Trans>
                    </>
                  )
                : (
                    <>
                      <Play aria-hidden="true" className="size-4" />
                      <Trans>运行</Trans>
                    </>
                  )}
            </button>
            <button
              type="button"
              onClick={() => runExercise('submit')}
              disabled={busy || !isActive || !editorReady}
              aria-describedby={submitActionDescriptionId}
              title={submitActionDescription}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-classroom-success-fg px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:bg-tour-border-soft"
            >
              {busyMode === 'submit'
                ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      <Trans>提交中</Trans>
                    </>
                  )
                : (
                    <>
                      <Send aria-hidden="true" className="size-4" />
                      <Trans>提交</Trans>
                    </>
                  )}
            </button>
          </div>
        </div>
      </section>

      <section data-testid="exercise-test-panel" className="overflow-hidden rounded-md border border-tour-border bg-tour-surface">
        <div className="flex h-11 items-center gap-2 border-b border-tour-border px-3" role="tablist" aria-label={isReviewCheck ? t`复习检查输出` : t`练习输出`}>
          <button
            id={caseTabId}
            type="button"
            role="tab"
            aria-selected={activePanelTab === 'case'}
            aria-controls={casePanelId}
            aria-describedby={caseTabDescriptionId}
            title={caseTabDescription}
            tabIndex={activePanelTab === 'case' ? 0 : -1}
            onClick={() => setActivePanelTab('case')}
            onKeyDown={handlePanelTabKeyDown}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-tour-heading aria-selected:text-classroom-success-fg"
          >
            <ListChecks aria-hidden="true" className="size-4" />
            <Trans>测试用例</Trans>
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            id={resultTabId}
            type="button"
            role="tab"
            aria-selected={activePanelTab === 'result'}
            aria-controls={resultPanelId}
            aria-describedby={resultTabDescriptionId}
            title={resultTabDescription}
            tabIndex={activePanelTab === 'result' ? 0 : -1}
            onClick={() => setActivePanelTab('result')}
            onKeyDown={handlePanelTabKeyDown}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground aria-selected:text-classroom-success-fg"
          >
            <Trans>测试结果</Trans>
          </button>
          <span id={caseTabDescriptionId} className="sr-only">
            {caseTabDescription}
          </span>
          <span id={resultTabDescriptionId} className="sr-only">
            {resultTabDescription}
          </span>
        </div>
        <div
          id={casePanelId}
          role="tabpanel"
          aria-labelledby={caseTabId}
          tabIndex={0}
          hidden={activePanelTab !== 'case'}
          className="min-h-[170px] p-4"
        >
          {activePanelTab === 'case' && (
            <div className="space-y-4">
              <div className="inline-flex rounded-md bg-tour-bg px-4 py-2 text-sm font-semibold text-tour-heading"><Trans>用例 1</Trans></div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <Trans>预期输出</Trans>
                  {' '}
                  =
                </div>
                <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-tour-code-bg px-4 py-3 font-mono text-sm text-tour-text">{exercise.expectedOutput}</pre>
              </div>
            </div>
          )}
        </div>
        <div
          id={resultPanelId}
          role="tabpanel"
          aria-labelledby={resultTabId}
          tabIndex={0}
          hidden={activePanelTab !== 'result'}
          className="min-h-[170px] p-4"
        >
          {activePanelTab === 'result' && (
            <div className="space-y-3">
              {visibleFeedback
                ? (
                    <>
                      <div
                        data-testid="exercise-result-status"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className="inline-flex items-center gap-2 rounded-md border border-tour-border bg-tour-bg px-3 py-2 text-sm font-semibold text-tour-text"
                      >
                        {visibleFeedback.matched
                          ? <CheckCircle2 aria-hidden="true" className="size-4 text-classroom-success-fg" />
                          : <XCircle aria-hidden="true" className="size-4 text-destructive" />}
                        <ExerciseResultLabel feedback={visibleFeedback} runnerUnavailable={runnerUnavailable} />
                      </div>
                      {genericStaleResultVisible && (
                        <div
                          data-testid="exercise-result-stale-code-hint"
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          className="rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs leading-relaxed text-classroom-warning-fg"
                        >
                          <Trans>代码已修改。当前结果来自修改前的代码，请重新运行或提交查看最新结果。</Trans>
                        </div>
                      )}
                      {runnerUnavailable && isActive && (
                        <div
                          data-testid="exercise-runner-unavailable-hint"
                          className="flex flex-col gap-3 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs leading-relaxed text-classroom-warning-fg sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span role="status" aria-live="polite" aria-atomic="true" className="min-w-0 break-words">
                            {visibleFeedback.mode === 'submit'
                              ? <Trans>运行服务暂时不可用，这次不会记录为学习进度。请稍后重试提交。</Trans>
                              : <Trans>运行服务暂时不可用，请稍后重试运行。</Trans>}
                          </span>
                          <span id={runnerRetryDescriptionId} className="sr-only">
                            {runnerRetryDescription}
                          </span>
                          <button
                            type="button"
                            onClick={() => runExercise(visibleFeedback.mode)}
                            disabled={busy || !isActive || !editorReady}
                            aria-describedby={runnerRetryDescriptionId}
                            title={runnerRetryDescription}
                            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg hover:bg-tour-bg disabled:opacity-50 sm:w-auto"
                          >
                            <RotateCcw aria-hidden="true" className="size-3.5" />
                            {visibleFeedback.mode === 'submit' ? <Trans>重试提交</Trans> : <Trans>重试运行</Trans>}
                          </button>
                        </div>
                      )}
                      {runCorrectFeedbackVisible && (
                        <div
                          data-testid="exercise-run-correct-submit-hint"
                          className={cn(
                            'flex flex-col gap-3 rounded-md border px-3 py-2 text-xs leading-relaxed sm:flex-row sm:items-center sm:justify-between',
                            runCorrectFeedbackStale
                              ? 'border-classroom-warning-border bg-classroom-warning-bg text-classroom-warning-fg'
                              : 'border-classroom-success-border bg-classroom-success-bg text-classroom-success-fg',
                          )}
                        >
                          <span id={runCorrectSubmitHintId} role="status" aria-live="polite" aria-atomic="true">
                            {runCorrectSubmitHintText}
                          </span>
                          {runCorrectFeedbackCanSubmit && (
                            <button
                              type="button"
                              aria-describedby={runCorrectSubmitHintId}
                              title={runCorrectSubmitHintText}
                              onClick={() => runExercise('submit')}
                              disabled={busy || !isActive || !editorReady}
                              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-classroom-success-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-success-fg hover:bg-tour-bg disabled:opacity-50 sm:w-auto"
                            >
                              <Send aria-hidden="true" className="size-3.5" />
                              {isReviewCheck ? <Trans>提交复习检查</Trans> : <Trans>提交并记录</Trans>}
                            </button>
                          )}
                        </div>
                      )}
                      {visibleFeedback.mode === 'run' && !visibleFeedback.matched && !runnerUnavailable && isActive && (
                        <div
                          data-testid="exercise-run-failure-hint"
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          className="rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs leading-relaxed text-classroom-warning-fg"
                        >
                          {isReviewCheck
                            ? <Trans>运行结果未通过，这次不会记录为复习检查进度。可以先查看结果和编译信息，修改后再运行或提交。</Trans>
                            : <Trans>运行结果未通过，这次不会记录为练习进度。可以先查看结果和编译信息，修改后再运行或提交。</Trans>}
                        </div>
                      )}
                      {visibleFeedback.mode === 'submit' && !visibleFeedback.matched && !runnerUnavailable && isActive && (
                        <div
                          data-testid="exercise-submit-failure-hint"
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          className="rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs leading-relaxed text-classroom-warning-fg"
                        >
                          {isReviewCheck
                            ? resultCodeStale
                              ? <Trans>这次复习检查未通过，已按提交时的代码记录为需要复查的证据。AI 反馈会针对那次提交；当前代码已修改，请重新提交以记录新的结果。</Trans>
                              : <Trans>这次复习检查未通过，已记录为需要复查的证据。AI 会准备针对性反馈；你也可以先修改代码后重新提交。</Trans>
                            : resultCodeStale
                              ? <Trans>这次提交未通过，已按提交时的代码记录为练习证据。AI 提示会针对那次提交；当前代码已修改，请重新提交以记录新的结果。</Trans>
                              : <Trans>这次提交未通过，已记录为练习证据。AI 会准备针对性提示；你也可以先修改代码后重新提交。</Trans>}
                        </div>
                      )}
                    </>
                  )
                : (
                    <div className="text-sm text-muted-foreground">
                      <Trans>运行或提交后查看测试结果。</Trans>
                    </div>
                  )}
              <pre data-testid="exercise-test-result-output" className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-tour-code-bg px-4 py-3 font-mono text-sm text-tour-text">
                <Trans>输出：</Trans>
                {resultOutput
                  ? <span dangerouslySetInnerHTML={{ __html: resultOutputHtml }} />
                  : <Trans>（空）</Trans>}
              </pre>
              {toolOutput && (
                <div
                  className={cn(
                    'overflow-hidden rounded-md border',
                    runFailed
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'border-tour-border bg-tour-code-bg',
                  )}
                >
                  <button
                    id={toolOutputTriggerId}
                    type="button"
                    aria-expanded={toolOutputOpen}
                    aria-controls={toolOutputBodyId}
                    data-state={toolOutputOpen ? 'open' : 'closed'}
                    data-testid="exercise-tool-output-trigger"
                    title={toolOutputToggleTitle}
                    onClick={() => dispatchToolOutputOpen('toggle')}
                    className={cn(
                      'group/trigger flex w-full items-center gap-2 px-3 py-2 text-xs font-mono transition-colors',
                      runFailed
                        ? 'text-destructive hover:bg-destructive/10'
                        : 'text-muted-foreground hover:bg-tour-bg/60',
                    )}
                  >
                    <Terminal aria-hidden="true" className="size-3.5 shrink-0" />
                    <span><Trans>编译信息</Trans></span>
                    <ChevronDown aria-hidden="true" className={cn('ml-auto size-4 shrink-0 transition-transform', !toolOutputOpen && '-rotate-90')} />
                  </button>
                  <div
                    id={toolOutputBodyId}
                    role="region"
                    aria-labelledby={toolOutputTriggerId}
                    data-testid="exercise-tool-output-body"
                    hidden={!toolOutputOpen}
                    className="overflow-hidden"
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
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </section>
  )
}

function ExerciseResultLabel({
  feedback,
  runnerUnavailable,
}: {
  feedback: ExerciseFeedback
  runnerUnavailable: boolean
}) {
  if (runnerUnavailable)
    return feedback.mode === 'submit' ? <Trans>提交未完成</Trans> : <Trans>运行未完成</Trans>
  if (feedback.mode === 'run')
    return feedback.matched ? <Trans>运行结果：正确</Trans> : <Trans>运行结果：错误</Trans>
  return feedback.matched ? <Trans>提交结果：正确</Trans> : <Trans>提交结果：错误</Trans>
}

function exerciseBusyStatusText(mode: ExerciseAttemptMode, isReviewCheck: boolean): string {
  if (mode === 'run')
    return isReviewCheck ? t`正在运行复习检查代码，请稍候。` : t`正在运行练习代码，请稍候。`
  return isReviewCheck ? t`正在提交复习检查，请稍候。` : t`正在提交练习，请稍候。`
}

function ExerciseStatusLabel({ status, intent }: { status: ExerciseInstance['status'], intent: ExerciseInstance['intent'] }) {
  const isReviewCheck = intent === 'review_check'
  if (status === 'active')
    return isReviewCheck ? <Trans>复习检查中</Trans> : <Trans>练习中</Trans>
  if (status === 'success')
    return isReviewCheck ? <Trans>复习检查已完成</Trans> : <Trans>已完成</Trans>
  if (status === 'skip')
    return isReviewCheck ? <Trans>已跳过复习检查</Trans> : <Trans>已跳过</Trans>
  if (isReviewCheck)
    return <Trans>复习检查已更新</Trans>
  return <Trans>已更新</Trans>
}
