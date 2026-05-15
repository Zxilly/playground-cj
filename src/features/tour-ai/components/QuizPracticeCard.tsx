'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Code2, ListChecks, Loader2, Play, RotateCcw, Send, SkipForward, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trans } from '@lingui/react/macro'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { TourEditor } from '@/features/tour/components/TourEditor'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { evaluateQuizOutput } from '@/lib/ai/classroom/reducer'
import type { ClassroomQuiz, RunResult } from '@/lib/ai/classroom/types'
import { requestRemoteAction } from '@/service/run'
import { richTextPlainText } from '@/features/tour-ai/utils/classroom-text'
import { useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import { ShikiCodeBlock } from '@/features/tour-ai/components/ShikiCode'
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
  const promptText = richTextPlainText(quiz.prompt)
  const busy = busyMode !== null

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const finishAttempt = (mode: QuizAttemptMode, result: RunResult) => {
    const matched = result.ok && evaluateQuizOutput(quiz, result.stdout).matched
    setFeedback({ mode, matched })
    setActivePanelTab('result')
    dispatch({
      type: mode === 'submit' ? 'QUIZ_SUBMIT_FINISHED' : 'QUIZ_RUN_FINISHED',
      result,
      now: Date.now(),
    })
  }

  const runQuiz = async (mode: QuizAttemptMode) => {
    setBusyMode(mode)
    beginRunnerRun(quiz.id)
    try {
      const editorCode = bridge.editor.getEditor()?.getModel()?.getValue() ?? quiz.starterCode
      const data = await requestRemoteAction(editorCode, 'run')
      const result: RunResult = {
        ok: data.compiler_code === 0 && data.bin_code === 0,
        stdout: data.bin_output,
        stderr: data.compiler_output,
        exitCode: data.bin_code,
      }
      if (!mountedRef.current)
        return
      finishAttempt(mode, result)
    }
    catch (error) {
      if (!mountedRef.current)
        return
      finishAttempt(mode, {
        ok: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: null,
      })
    }
    finally {
      if (mountedRef.current)
        setBusyMode(null)
      endRunnerRun(quiz.id)
    }
  }

  const resetEditor = () => {
    bridge.editor.getEditor()?.getModel()?.setValue(quiz.starterCode)
  }

  const visibleFeedback = feedback ?? (lastRun
    ? { mode: 'run' as const, matched: lastRun.ok && evaluateQuizOutput(quiz, lastRun.stdout).matched }
    : null)
  const resultOutput = lastRun?.stdout ?? ''
  const resultError = lastRun?.stderr ?? ''

  return (
    <motion.section
      data-testid="quiz-practice-card"
      variants={classroomStaggerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      <motion.div layout variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-tour-heading"><Trans>Practice</Trans></div>
          <div className="mt-1 text-xs font-semibold text-tour-link">
            <Trans>Quiz</Trans>
            {' '}
            {quiz.status}
          </div>
        </div>
        <p className="mt-3 text-sm leading-7">{promptText}</p>
      </motion.div>

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
          {isActive
            ? <TourEditor code={quiz.starterCode} locale={lang} layout="editorOnly" enableLanguageClient={false} />
            : <ShikiCodeBlock code={quiz.starterCode} language="cangjie" />}
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
                      {resultOutput || <Trans>（空）</Trans>}
                    </pre>
                    <AnimatePresence initial={false}>
                      {resultError && (
                        <motion.pre
                          key="quiz-result-error"
                          variants={classroomFadeUpVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="whitespace-pre-wrap rounded-md bg-destructive/10 px-4 py-3 font-mono text-sm text-destructive"
                        >
                          {resultError}
                        </motion.pre>
                      )}
                    </AnimatePresence>
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
