'use client'

import { useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Block, QuizQuestion } from '@/lib/teach/lessons/blocks'
import type { QuizBlockProps } from './block-props'
import { TeachInlineMarkdown } from './TeachMarkdown'
import { cn } from '@/lib/utils'

type QuizBlockType = Extract<Block, { type: 'quiz' }>

type OptionCorrectness = 'correct' | 'incorrect-selected' | 'neutral'

/**
 * A persisted quiz answer is the per-question sorted list of selected option
 * indices (`number[][]`, one entry per question, in question order). Returns
 * `null` when the shape does not match so we never rehydrate from garbage.
 */
function selectedFromOutcome(lastAnswer: unknown, count: number): number[][] | null {
  if (!Array.isArray(lastAnswer) || lastAnswer.length !== count)
    return null
  const out: number[][] = []
  for (const entry of lastAnswer) {
    if (!Array.isArray(entry) || !entry.every(i => typeof i === 'number'))
      return null
    out.push(entry as number[])
  }
  return out
}

/**
 * Decide each option's correctness label after a submission. Every answer-set
 * member is marked `correct` (so the learner always sees the right answer);
 * a chosen non-answer is `incorrect-selected`; everything else is `neutral`.
 * Before submission nothing is labelled, so option formatting never leaks the
 * answer.
 */
function correctnessFor(
  index: number,
  answerSet: Set<number>,
  selected: Set<number>,
): OptionCorrectness {
  if (answerSet.has(index))
    return 'correct'
  return selected.has(index) ? 'incorrect-selected' : 'neutral'
}

const correctnessClass: Record<OptionCorrectness, string> = {
  'correct': 'border-emerald-400/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200',
  'incorrect-selected': 'border-destructive/60 bg-destructive/10 text-destructive',
  'neutral': 'border-border/60 bg-transparent text-foreground',
}

/** Whether a single question's selection exactly matches its answer set. */
function isQuestionCorrect(question: QuizQuestion, selected: Set<number>): boolean {
  const answerSet = new Set(question.answerIndices)
  return selected.size === answerSet.size && [...selected].every(i => answerSet.has(i))
}

/**
 * Skill block: an immediate-feedback quiz holding one or more questions, which
 * may MIX single- and multiple-choice. Options render in the model-provided
 * order (the equal-length schema rule keeps formatting from leaking the answer)
 * and correctness is hidden until the learner submits ALL questions at once.
 * `multiple` questions require the exact answer set; single questions accept
 * exactly one option, where a new pick replaces the previous one. A single
 * outcome is reported per submit: `correct` only when every question is correct.
 */
export function QuizBlock({ block, outcome, onOutcome }: QuizBlockProps) {
  const { questions } = block as QuizBlockType

  // Re-hydrate a previously answered quiz: a completed outcome seeds the prior
  // per-question selections and a submitted state so the learner sees their
  // answers and the correctness feedback again. `outcome` is read only at first
  // mount, so it never clobbers an in-progress selection on later renders.
  const prior = outcome?.completedAt != null
    ? selectedFromOutcome(outcome.lastAnswer, questions.length)
    : null
  const [selected, setSelected] = useState<Set<number>[]>(
    () => questions.map((_, i) => new Set(prior?.[i] ?? [])),
  )
  const [submitted, setSubmitted] = useState(() => prior != null)

  const allAnswered = selected.every(s => s.size > 0)
  const perQuestionCorrect = questions.map((q, i) => isQuestionCorrect(q, selected[i]))
  const correct = submitted && perQuestionCorrect.every(Boolean)

  const toggle = (questionIndex: number, optionIndex: number) => {
    if (submitted)
      return
    setSelected((prev) => {
      const next = prev.map(s => new Set(s))
      const question = questions[questionIndex]
      const set = next[questionIndex]
      if (question.multiple) {
        if (set.has(optionIndex))
          set.delete(optionIndex)
        else set.add(optionIndex)
      }
      else {
        // single-answer: a new pick replaces the previous selection
        next[questionIndex] = new Set([optionIndex])
      }
      return next
    })
  }

  const submit = () => {
    if (!allAnswered || submitted)
      return
    setSubmitted(true)
    const lastAnswer = selected.map(s => [...s].sort((a, b) => a - b))
    onOutcome?.({ correct: perQuestionCorrect.every(Boolean), lastAnswer })
  }

  const retry = () => {
    setSubmitted(false)
    setSelected(questions.map(() => new Set()))
  }

  return (
    <section
      data-testid="quiz-block"
      data-count={questions.length}
      className="rounded-md border border-border bg-background p-4"
    >
      <ol className="flex flex-col gap-5">
        {questions.map((question, qIndex) => {
          const questionSelected = selected[qIndex]
          const answerSet = new Set(question.answerIndices)
          const questionCorrect = perQuestionCorrect[qIndex]
          return (
            // Index-keyed: questions never reorder after authoring, so the
            // position is the stable identity here.
            // eslint-disable-next-line react/no-array-index-key
            <li key={qIndex} data-testid="quiz-question" data-multiple={question.multiple ? '' : undefined}>
              <p className="text-sm font-semibold leading-7 text-foreground">
                <TeachInlineMarkdown markdown={question.question} />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {question.multiple ? <Trans>多选题</Trans> : <Trans>单选题</Trans>}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {question.options.map((option, oIndex) => {
                  const isSelected = questionSelected.has(oIndex)
                  const correctness = submitted
                    ? correctnessFor(oIndex, answerSet, questionSelected)
                    : 'neutral'
                  return (
                    // Index-prefixed: option text can repeat and options never
                    // reorder after authoring, so the position is the stable
                    // identity here.
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={`${oIndex}-${option}`}>
                      <button
                        type="button"
                        data-testid="quiz-option"
                        data-question={qIndex}
                        data-correctness={submitted ? correctness : undefined}
                        aria-pressed={isSelected}
                        disabled={submitted}
                        onClick={() => toggle(qIndex, oIndex)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors',
                          !submitted && isSelected && 'border-primary bg-primary/5',
                          !submitted && !isSelected && 'border-border/60 hover:bg-muted/40',
                          submitted && correctnessClass[correctness],
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center border text-[10px]',
                            question.multiple ? 'rounded-sm' : 'rounded-full',
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                          )}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                        <TeachInlineMarkdown markdown={option} className="min-w-0 flex-1" />
                      </button>
                    </li>
                  )
                })}
              </ul>

              {submitted && (
                <div className="mt-3 space-y-2">
                  <div
                    data-testid="quiz-result"
                    data-question={qIndex}
                    data-correct={questionCorrect ? 'true' : 'false'}
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
                      questionCorrect
                        ? 'border-emerald-400/60 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-destructive/50 bg-destructive/10 text-destructive',
                    )}
                  >
                    {questionCorrect
                      ? <CheckCircle2 aria-hidden="true" className="size-4" />
                      : <XCircle aria-hidden="true" className="size-4" />}
                    {questionCorrect ? <Trans>回答正确</Trans> : <Trans>回答错误</Trans>}
                  </div>
                  <p data-testid="quiz-explanation" data-question={qIndex} className="text-sm leading-7 text-muted-foreground">
                    <TeachInlineMarkdown markdown={question.explanation} />
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {!submitted && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            data-testid="quiz-submit"
            disabled={!allAnswered}
            onClick={submit}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trans>提交</Trans>
          </button>
          {!allAnswered && (
            <span data-testid="quiz-incomplete" className="text-xs text-muted-foreground">
              <Trans>请完成所有题目</Trans>
            </span>
          )}
        </div>
      )}

      {submitted && (
        <div className="mt-4 space-y-2">
          <div
            data-testid="quiz-summary"
            data-correct={correct ? 'true' : 'false'}
            role="status"
            aria-live="polite"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
              correct
                ? 'border-emerald-400/60 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'border-destructive/50 bg-destructive/10 text-destructive',
            )}
          >
            {correct
              ? <CheckCircle2 aria-hidden="true" className="size-4" />
              : <XCircle aria-hidden="true" className="size-4" />}
            {correct ? <Trans>全部回答正确</Trans> : <Trans>部分题目回答错误</Trans>}
          </div>
          {!correct && (
            <div>
              <button
                type="button"
                data-testid="quiz-retry"
                onClick={retry}
                aria-label={t`重试`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                <Trans>重试</Trans>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
