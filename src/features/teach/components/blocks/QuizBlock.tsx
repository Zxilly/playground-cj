'use client'

import { useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { QuizBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { BlockComponentProps } from './block-props'
import { cn } from '@/lib/utils'

type QuizBlockProps = BlockComponentProps<QuizBlockSchemaType>

type OptionCorrectness = 'correct' | 'incorrect-selected' | 'neutral'

/** A persisted quiz answer is the sorted list of selected option indices. */
function selectedFromOutcome(lastAnswer: unknown): number[] | null {
  if (Array.isArray(lastAnswer) && lastAnswer.every(i => typeof i === 'number'))
    return lastAnswer as number[]
  return null
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

/**
 * Skill block: an immediate-feedback quiz. Options render in the model-provided
 * order (the equal-length schema rule keeps formatting from leaking the answer)
 * and correctness is hidden until the learner submits. `multiple` quizzes
 * require the exact answer set; single quizzes accept exactly one option, where
 * a new pick replaces the previous one.
 */
export function QuizBlock({ block, outcome, onOutcome }: QuizBlockProps) {
  // Re-hydrate a previously answered quiz: a completed outcome seeds the prior
  // selection and a submitted state so the learner sees their answer and the
  // correctness feedback again. `outcome` is read only at first mount, so it
  // never clobbers an in-progress selection on later renders.
  const prior = outcome?.completedAt != null ? selectedFromOutcome(outcome.lastAnswer) : null
  const [selected, setSelected] = useState<Set<number>>(() => new Set(prior ?? []))
  const [submitted, setSubmitted] = useState(() => prior != null)

  const answerSet = new Set(block.answerIndices)
  const isAnswerSetSelected
    = selected.size === answerSet.size && [...selected].every(i => answerSet.has(i))
  const correct = submitted && isAnswerSetSelected

  const toggle = (index: number) => {
    if (submitted)
      return
    setSelected((prev) => {
      const next = new Set(prev)
      if (block.multiple) {
        if (next.has(index))
          next.delete(index)
        else next.add(index)
        return next
      }
      // single-answer: a new pick replaces the previous selection
      return new Set([index])
    })
  }

  const submit = () => {
    if (selected.size === 0 || submitted)
      return
    setSubmitted(true)
    onOutcome?.({ correct: isAnswerSetSelected, lastAnswer: [...selected].sort((a, b) => a - b) })
  }

  const retry = () => {
    setSubmitted(false)
    setSelected(new Set())
  }

  return (
    <section
      data-testid="quiz-block"
      data-multiple={block.multiple ? '' : undefined}
      className="rounded-md border border-border/60 bg-card/40 p-4"
    >
      <p className="text-sm font-semibold leading-7 text-foreground">{block.question}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {block.multiple ? <Trans>多选题</Trans> : <Trans>单选题</Trans>}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {block.options.map((option, index) => {
          const isSelected = selected.has(index)
          const correctness = submitted
            ? correctnessFor(index, answerSet, selected)
            : 'neutral'
          return (
            // Index-prefixed: option text can repeat and options never reorder
            // after authoring, so the position is the stable identity here.
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${index}-${option}`}>
              <button
                type="button"
                data-testid="quiz-option"
                data-correctness={submitted ? correctness : undefined}
                aria-pressed={isSelected}
                disabled={submitted}
                onClick={() => toggle(index)}
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
                    'flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]',
                    block.multiple ? 'rounded-sm' : 'rounded-full',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {isSelected ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {!submitted && (
        <button
          type="button"
          data-testid="quiz-submit"
          disabled={selected.size === 0}
          onClick={submit}
          className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trans>提交</Trans>
        </button>
      )}

      {submitted && (
        <div className="mt-3 space-y-2">
          <div
            data-testid="quiz-result"
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
            {correct ? <Trans>回答正确</Trans> : <Trans>回答错误</Trans>}
          </div>
          <p data-testid="quiz-explanation" className="text-sm leading-7 text-muted-foreground">
            {block.explanation}
          </p>
          {!correct && (
            <button
              type="button"
              data-testid="quiz-retry"
              onClick={retry}
              aria-label={t`重试这道题`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              <Trans>重试</Trans>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
