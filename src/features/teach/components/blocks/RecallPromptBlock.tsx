'use client'

import { useId, useState } from 'react'
import { Check, Eye, X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { RecallPromptBlockProps, SelfGrade } from './block-props'
import { isQuotaExhaustedError } from '@/lib/ai/quota-error'
import { TeachInlineMarkdown } from './TeachMarkdown'
import { cn } from '@/lib/utils'

interface Verdict {
  correct: boolean
  feedback: string
}

/**
 * Skill block: free-recall retrieval practice. The learner types their answer
 * from memory, then either an LLM judge grades it (`gradeRecall`) or — when no
 * grader is wired (document-only contexts) or grading errors out — the learner
 * self-grades after revealing the reference answer. Withholding the answer
 * until reveal is what builds storage strength (vs. recognition).
 */
export function RecallPromptBlock({ block, outcome, onOutcome, gradeRecall }: RecallPromptBlockProps) {
  const emptyGuidanceId = useId()
  // Re-hydrate a previously graded recall: a completed outcome reveals the
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

  // AI-graded path state.
  const [grading, setGrading] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [gradeError, setGradeError] = useState<string | null>(null)
  // Once AI grading fails we fall back to the manual self-grade buttons so the
  // learner can still proceed; from then on this block behaves like the
  // non-graded flow for the rest of the session.
  const [fellBack, setFellBack] = useState(false)
  const hasAttempt = attempt.trim().length > 0

  const reveal = () => setRevealed(true)

  const submitGrade = (next: SelfGrade) => {
    setGrade(next)
    onOutcome?.({ grade: next, correct: next === 'good', lastAnswer: attempt })
  }

  const submitForGrading = async () => {
    if (!gradeRecall || grading || !hasAttempt)
      return
    setGrading(true)
    setGradeError(null)
    try {
      const result = await gradeRecall({ prompt: block.prompt, reference: block.answer, answer: attempt })
      setVerdict(result)
      setRevealed(true)
      onOutcome?.({ correct: result.correct, lastAnswer: attempt })
    }
    catch (error) {
      // Fall back to manual self-grading so a quota/network failure never blocks
      // the learner. Reveal the reference answer for self-assessment.
      setGradeError(
        isQuotaExhaustedError(error)
          ? t`额度不足，已切换为手动自评。`
          : t`自动批改失败，已切换为手动自评。`,
      )
      setFellBack(true)
      setRevealed(true)
    }
    finally {
      setGrading(false)
    }
  }

  // Manual self-grade buttons appear when there is no AI grader, the AI grading
  // fell back to manual, OR we re-hydrated a completed outcome that had no
  // AI verdict to restore.
  const showManualGrade = (!gradeRecall || fellBack || (completed && verdict == null))

  return (
    <section
      data-testid="recall-block"
      data-grade={grade ?? undefined}
      className="rounded-md border border-border bg-background p-4"
    >
      <p data-testid="recall-prompt" className="text-sm font-semibold leading-7 text-foreground">
        <TeachInlineMarkdown markdown={block.prompt} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        <Trans>凭记忆作答，再揭示答案对照</Trans>
      </p>
      <textarea
        data-testid="recall-input"
        value={attempt}
        onChange={event => setAttempt(event.target.value)}
        // Lock the answer once revealed/graded: editing after seeing the
        // reference answer (or after submitting for grading) would let the
        // learner copy it in, defeating the retrieval-practice this block
        // exists for.
        readOnly={revealed || grading}
        rows={3}
        aria-label={t`回忆作答`}
        aria-describedby={!revealed && gradeRecall && !hasAttempt ? emptyGuidanceId : undefined}
        placeholder={t`写下你记得的内容…`}
        className={cn(
          'mt-3 w-full resize-y rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary/40',
          (revealed || grading) && 'cursor-not-allowed resize-none bg-muted/30 text-muted-foreground',
        )}
      />

      {/* AI-graded submit button: shown only before reveal and while a grader is
          wired and we have not fallen back to manual grading. */}
      {!revealed && gradeRecall && !fellBack && (
        <>
          {!hasAttempt && (
            <p
              id={emptyGuidanceId}
              data-testid="recall-empty-guidance"
              aria-live="polite"
              className="mt-2 text-xs text-muted-foreground"
            >
              <Trans>请先写下你的回答，再提交批改。</Trans>
            </p>
          )}
          <button
            type="button"
            data-testid="recall-submit-grade"
            aria-describedby={!hasAttempt ? emptyGuidanceId : undefined}
            onClick={submitForGrading}
            disabled={grading || !hasAttempt}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {grading
              ? <Trans>批改中…</Trans>
              : <Trans>提交批改</Trans>}
          </button>
        </>
      )}

      {/* Manual reveal button: only when there is no AI grader (or we fell back)
          and the answer is not yet revealed. */}
      {!revealed && showManualGrade && (
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

      {gradeError && (
        <p data-testid="recall-grade-error" className="mt-2 text-xs text-destructive">
          {gradeError}
        </p>
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
            <p className="whitespace-pre-wrap break-words">
              <TeachInlineMarkdown markdown={block.answer} />
            </p>
          </div>

          {/* AI verdict: correctness badge + feedback. */}
          {verdict && (
            <div
              data-testid="recall-verdict"
              data-correct={verdict.correct}
              className={cn(
                'rounded-md border px-3 py-2 text-sm leading-6',
                verdict.correct
                  ? 'border-emerald-400/60 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'border-destructive/60 bg-destructive/10 text-destructive',
              )}
            >
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                {verdict.correct
                  ? (
                      <>
                        <Check aria-hidden="true" className="size-4" />
                        <Trans>已掌握</Trans>
                      </>
                    )
                  : (
                      <>
                        <X aria-hidden="true" className="size-4" />
                        <Trans>待加强</Trans>
                      </>
                    )}
              </div>
              <p data-testid="recall-feedback" className="whitespace-pre-wrap break-words">
                <TeachInlineMarkdown markdown={verdict.feedback} />
              </p>
            </div>
          )}

          {/* Manual self-grade buttons (no AI grader, or fell back to manual). */}
          {showManualGrade && (
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
          )}
        </div>
      )}
    </section>
  )
}
