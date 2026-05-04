'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileText, Target, Terminal, X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { useAIBridge } from '@/components/tour/EditorBridgeContext'
import { useLearnerStore } from '@/stores/learner'
import { evaluateQuiz } from '@/lib/ai/quiz-evaluator'

type TabKey = 'case' | 'result'

interface QuizTestTabsProps {
  programOutput: string
}

export function QuizTestTabs({ programOutput }: QuizTestTabsProps) {
  const { uiLang } = useAIBridge()
  const quiz = useLearnerStore(state => state.learner.activeQuiz)
  const [tab, setTab] = useState<TabKey>('case')
  const hadEvaluationRef = useRef(false)
  const hasRun = programOutput.length > 0

  const evaluation = useMemo(() => {
    if (!quiz || !hasRun)
      return null
    return evaluateQuiz(quiz, programOutput)
  }, [quiz, programOutput, hasRun])

  useEffect(() => {
    if (evaluation && !hadEvaluationRef.current)
      setTab('result')
    hadEvaluationRef.current = Boolean(evaluation)
  }, [evaluation])

  if (!quiz)
    return null

  const promptText = quiz.prompt[uiLang] || quiz.prompt.zh || quiz.prompt.en || ''

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
        <TabButton active={tab === 'case'} onClick={() => setTab('case')}>
          <FileText className="size-3" />
          <Trans>测试用例</Trans>
        </TabButton>
        <TabButton active={tab === 'result'} onClick={() => setTab('result')}>
          <Terminal className="size-3" />
          <Trans>测试结果</Trans>
          {evaluation && (
            <span
              className={`ml-1 inline-flex size-3.5 items-center justify-center rounded-full ${evaluation.matched ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}
            >
              {evaluation.matched ? <Check className="size-2.5" /> : <X className="size-2.5" />}
            </span>
          )}
        </TabButton>
        <div className="ml-auto pr-1 text-[10px] text-muted-foreground">
          {`#${quiz.conceptId} · ${t`尝试`} ${quiz.attempts}`}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2 text-xs">
        {tab === 'case' && (
          <div className="space-y-3">
            <Section icon={<Target className="size-3" />} label={t`目标`}>
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                {promptText}
              </p>
            </Section>
            <Section icon={<Check className="size-3" />} label={t`期望输出`}>
              <Pre>{quiz.expectedOutput || t`(空字符串)`}</Pre>
            </Section>
          </div>
        )}
        {tab === 'result' && (
          <div className="space-y-3">
            {!hasRun && (
              <p className="rounded-md border border-dashed border-border bg-background/40 px-3 py-3 text-center text-muted-foreground">
                <Trans>尚未运行。修改右上方的代码后点「运行」开始评测。</Trans>
              </p>
            )}
            {evaluation && (
              <>
                <ResultBadge matched={evaluation.matched} attempts={quiz.attempts} />
                <Section icon={<Terminal className="size-3" />} label={t`实际输出`}>
                  <Pre>{evaluation.actual || t`(空字符串)`}</Pre>
                </Section>
                {!evaluation.matched && (
                  <Section icon={<Check className="size-3" />} label={t`期望输出`}>
                    <Pre>{evaluation.expected || t`(空字符串)`}</Pre>
                  </Section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'}`}
    >
      {children}
    </button>
  )
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-tour-teal/90">
        {icon}
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-snug text-foreground/85">
      {children}
    </pre>
  )
}

function ResultBadge({ matched, attempts }: { matched: boolean, attempts: number }) {
  if (matched) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
        <Check className="size-4" />
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-sm"><Trans>通过</Trans></span>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
            <Trans>输出与期望匹配。</Trans>
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-700 dark:text-rose-300">
      <X className="size-4" />
      <div className="flex flex-col leading-tight">
        <span className="font-semibold text-sm"><Trans>未通过</Trans></span>
        <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
          {`${t`已尝试`} ${attempts} ${t`次。再读题、对比输出后修一刀`}`}
        </span>
      </div>
    </div>
  )
}
