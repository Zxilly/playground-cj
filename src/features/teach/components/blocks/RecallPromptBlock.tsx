'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { RecallPromptBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { BlockComponentProps, SelfGrade } from './block-props'
import { cn } from '@/lib/utils'

type RecallPromptBlockProps = BlockComponentProps<RecallPromptBlockSchemaType>

/**
 * Skill block: free-recall retrieval practice. The learner types their answer
 * from memory, reveals the reference answer, then self-grades. Withholding the
 * answer until reveal is what builds storage strength (vs. recognition). The
 * self-assessment grade (`again` / `good`) is forwarded so the renderer can
 * feed the spaced-retrieval scheduler.
 */
export function RecallPromptBlock({ block, outcome, onOutcome }: RecallPromptBlockProps) {
  // Re-hydrate a previously self-graded recall: a completed outcome reveals the
  // reference answer, restores the recorded grade (`correct` maps back to
  // good/again — recall outcomes only persist correctness, not the raw grade),
  // and re-fills the learner's prior attempt text when one was stored.
  const completed = outcome?.completedAt != null
  const priorGrade: SelfGrade | null = completed
    ? (outcome?.correct ? 'good' : 'again')
    : null
  const priorAttempt = completed && typeof outcome?.lastAnswer === 'string' ? outcome.lastAnswer : ''
  const [attempt, setAttempt] = useState(() => priorAttempt)
  const [revealed, setRevealed] = useState(() => completed)
  const [grade, setGrade] = useState<SelfGrade | null>(() => priorGrade)

  const reveal = () => setRevealed(true)

  const submitGrade = (next: SelfGrade) => {
    setGrade(next)
    onOutcome?.({ grade: next, correct: next === 'good', lastAnswer: attempt })
  }

  return (
    <section
      data-testid="recall-block"
      data-grade={grade ?? undefined}
      className="rounded-md border border-border/60 bg-card/40 p-4"
    >
      <p className="text-sm font-semibold leading-7 text-foreground">{block.prompt}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        <Trans>凭记忆作答，再揭示答案对照</Trans>
      </p>
      <textarea
        data-testid="recall-input"
        value={attempt}
        onChange={event => setAttempt(event.target.value)}
        // Lock the answer once revealed: editing after seeing the reference answer
        // would let the learner copy it before self-grading, defeating the
        // retrieval-practice this block exists for.
        readOnly={revealed}
        rows={3}
        aria-label={t`回忆作答`}
        placeholder={t`写下你记得的内容…`}
        className={cn(
          'mt-3 w-full resize-y rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary/40',
          revealed && 'cursor-not-allowed resize-none bg-muted/30 text-muted-foreground',
        )}
      />

      {!revealed && (
        <button
          type="button"
          data-testid="recall-reveal"
          onClick={reveal}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/40"
        >
          <Eye aria-hidden="true" className="size-4" />
          <Trans>揭示答案</Trans>
        </button>
      )}

      {revealed && (
        <div className="mt-3 space-y-3">
          <div
            data-testid="recall-answer"
            className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-7 text-foreground"
          >
            <div className="mb-1 text-xs font-semibold text-muted-foreground">
              <Trans>参考答案</Trans>
            </div>
            <p className="whitespace-pre-wrap break-words">{block.answer}</p>
          </div>
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">
              <Trans>对照后自评：是否已回忆起？</Trans>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="recall-grade-again"
                aria-pressed={grade === 'again'}
                onClick={() => submitGrade('again')}
                className={cn(
                  'inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold',
                  grade === 'again'
                    ? 'border-destructive/60 bg-destructive/10 text-destructive'
                    : 'border-border/60 text-foreground hover:bg-muted/40',
                )}
              >
                <Trans>未回忆起</Trans>
              </button>
              <button
                type="button"
                data-testid="recall-grade-good"
                aria-pressed={grade === 'good'}
                onClick={() => submitGrade('good')}
                className={cn(
                  'inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold',
                  grade === 'good'
                    ? 'border-emerald-400/60 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-border/60 text-foreground hover:bg-muted/40',
                )}
              >
                <Trans>已回忆起</Trans>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
