'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Award, BookOpenCheck, CircleDashed, GraduationCap, ShieldAlert, Sprout, TrendingUp } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { deriveConceptProgress, deriveConceptProgressEntries } from '@/lib/ai/classroom/selectors'
import type { ConceptProgressEntry } from '@/lib/ai/classroom/selectors'
import { getConcept } from '@/lib/ai/concept-graph/loader'
import type { ConceptStatus } from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'
import { CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT, isClassroomTransientPanelCloseTarget } from './classroom-transient-panels'

interface ConceptGroup {
  status: Extract<ConceptStatus, 'mastered' | 'demonstrated' | 'practicing' | 'seen' | 'blocked' | 'stale'>
  label: string
  helper: string
  icon: React.ReactNode
  ids: string[]
  tone: 'success' | 'warning' | 'neutral'
}

// Surface derived Concept Progress without letting the UI assign or persist
// progress directly. Evidence and exposure remain the source of truth.
export function ClassroomConceptPanel({
  lang,
  onReviewConcept,
  onReturnToCurrentExercise,
}: {
  lang: string
  onReviewConcept?: (conceptId: string) => void
  onReturnToCurrentExercise?: () => void
}) {
  const { session } = useClassroomSession()
  const [open, setOpen] = useState(false)
  const triggerDescriptionId = useId()
  const progress = useMemo(() => deriveConceptProgress(session), [session])
  const progressEntries = useMemo(() => deriveConceptProgressEntries(session), [session])
  const progressDetails = useMemo(() => new Map(
    progressEntries.map(entry => [entry.conceptId, entry]),
  ), [progressEntries])
  const actionableEntries = useMemo(() => {
    const progressEntryOrder = new Map(progressEntries.map((entry, index) => [entry.conceptId, index]))
    return progressEntries
      .filter(isActionableConcept)
      .sort((a, b) => compareActionableConcepts(a, b, progressEntryOrder))
  }, [progressEntries])
  const nextStep = actionableEntries[0] ?? null
  const nextStepTitle = nextStep ? conceptTitleText(nextStep.conceptId, lang) : ''
  const activeExercise = session.currentExercise?.status === 'active' ? session.currentExercise : null
  const activeExerciseConceptId = activeExercise?.conceptIds[0] ?? ''
  const activeExerciseProgress = activeExerciseConceptId ? progressDetails.get(activeExerciseConceptId) : undefined
  const activeExerciseOwnsNextStep = Boolean(
    activeExercise
    && onReturnToCurrentExercise
    && (activeExercise.intent === 'review_check' || activeExerciseProgress?.status !== 'blocked'),
  )
  const activeExerciseTitle = activeExerciseConceptId ? conceptTitleText(activeExerciseConceptId, lang) : ''
  const shownNextStepTitle = activeExerciseOwnsNextStep ? activeExerciseTitle : nextStepTitle
  const actionableCount = actionableEntries.length
  const returnToActiveExerciseTitle = activeExercise
    ? activeExercise.intent === 'review_check'
      ? t`回到当前复习检查 ${shownNextStepTitle}；不会打开复习页、提交代码或改变已记录进度。`
      : t`回到当前练习 ${shownNextStepTitle}；不会打开复习页、提交代码或改变已记录进度。`
    : ''
  const nextReviewTitle = nextStep
    ? t`打开 ${nextStepTitle} 的复习页查看内容、证据和建议；不会排队新的课堂内容或改变学习进度。`
    : ''

  useEffect(() => {
    const closePanel = () => setOpen(false)
    const closePanelForExerciseInteraction = (event: Event) => {
      if (isClassroomTransientPanelCloseTarget(event.target))
        setOpen(false)
    }
    document.addEventListener(CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT, closePanel)
    document.addEventListener('pointerdown', closePanelForExerciseInteraction, true)
    document.addEventListener('focusin', closePanelForExerciseInteraction, true)
    return () => {
      document.removeEventListener(CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT, closePanel)
      document.removeEventListener('pointerdown', closePanelForExerciseInteraction, true)
      document.removeEventListener('focusin', closePanelForExerciseInteraction, true)
    }
  }, [])

  const groups = useMemo<ConceptGroup[]>(() => [
    {
      status: 'blocked',
      label: t`卡住`,
      helper: t`多次尝试没有通过，建议回到相关内容练习`,
      icon: <ShieldAlert aria-hidden="true" className="size-3.5" />,
      ids: progress.blocked,
      tone: 'warning',
    },
    {
      status: 'stale',
      label: t`需复查`,
      helper: t`过了一段时间，建议复习后再确认`,
      icon: <CircleDashed aria-hidden="true" className="size-3.5" />,
      ids: progress.stale,
      tone: 'neutral',
    },
    {
      status: 'practicing',
      label: t`练习中`,
      helper: t`正在练习但尚未通过`,
      icon: <TrendingUp aria-hidden="true" className="size-3.5" />,
      ids: progress.practicing,
      tone: 'warning',
    },
    {
      status: 'seen',
      label: t`已看过`,
      helper: t`已经学过或可在复习中回看的内容`,
      icon: <Sprout aria-hidden="true" className="size-3.5" />,
      ids: progress.seen,
      tone: 'neutral',
    },
    {
      status: 'demonstrated',
      label: t`已证明`,
      helper: t`通过练习证明理解的概念`,
      icon: <GraduationCap aria-hidden="true" className="size-3.5" />,
      ids: progress.demonstrated,
      tone: 'success',
    },
    {
      status: 'mastered',
      label: t`已掌握`,
      helper: t`通过延迟或迁移检查证明掌握的概念`,
      icon: <Award aria-hidden="true" className="size-3.5" />,
      ids: progress.mastered,
      tone: 'success',
    },
  ], [progress])

  const totalTracked = progress.mastered.length + progress.demonstrated.length + progress.practicing.length + progress.seen.length + progress.blocked.length + progress.stale.length
  const provenCount = progress.mastered.length + progress.demonstrated.length
  const empty = totalTracked === 0
  const triggerLabel = progressTriggerLabel({ empty, actionableCount, provenCount, totalTracked })
  const triggerDescription = progressTriggerDescription({ empty, actionableCount, provenCount, totalTracked })
  const reviewConcept = (conceptId: string) => {
    onReviewConcept?.(conceptId)
    setOpen(false)
  }
  const returnToCurrentExercise = () => {
    onReturnToCurrentExercise?.()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          aria-describedby={triggerDescriptionId}
          title={triggerDescription}
          data-testid="classroom-concept-panel-trigger"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-tour-border bg-tour-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-tour-bg',
            !empty && 'text-tour-text',
          )}
        >
          <GraduationCap aria-hidden="true" className="size-3.5" />
          <span id={triggerDescriptionId} className="sr-only">{triggerDescription}</span>
          {empty
            ? <Trans>进度</Trans>
            : actionableCount > 0
              ? (
                  <>
                    <span className="hidden sm:inline"><Trans>待处理</Trans></span>
                    <span className="sm:hidden"><Trans>待</Trans></span>
                    <span className="font-mono">{actionableCount}</span>
                  </>
                )
              : (
                  <>
                    <span className="hidden sm:inline"><Trans>已证</Trans></span>
                    <span className="font-mono">
                      {provenCount}
                      {' / '}
                      {totalTracked}
                    </span>
                  </>
                )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-1rem)] p-0" align="end" data-testid="classroom-concept-panel-content">
        <div className="border-b border-tour-border px-4 py-3">
          <div className="text-sm font-semibold text-tour-text">
            <Trans>学习进度</Trans>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {empty
              ? <Trans>课堂会随着课程进展显示已看内容、练习提交和复习检查结果。</Trans>
              : (
                  <Trans>
                    已证明或掌握
                    {' '}
                    {provenCount}
                    {' '}
                    个概念 / 接触过
                    {' '}
                    {totalTracked}
                    {' '}
                    个
                  </Trans>
                )}
          </div>
          <div
            data-testid="concept-panel-evidence-policy"
            className="mt-2 rounded-md border border-tour-border bg-tour-bg px-2.5 py-2 text-[11px] leading-5 text-muted-foreground"
          >
            <Trans>进度来自已看内容、练习提交和复习检查；AI 只能记录观察，不能直接判定掌握。</Trans>
          </div>
        </div>

        {(activeExerciseOwnsNextStep || nextStep) && (
          <div data-testid="concept-panel-next-step" className="border-b border-tour-border bg-tour-bg px-4 py-3 text-xs">
            <div className="flex items-start gap-2">
              <BookOpenCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-classroom-warning-fg" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-tour-heading">
                  <Trans>下一步</Trans>
                </div>
                <div className="mt-0.5 leading-5 text-muted-foreground">
                  <span className="font-medium text-tour-text">{shownNextStepTitle}</span>
                  {' · '}
                  {activeExerciseOwnsNextStep ? activeExerciseNextStepSummary(activeExercise!.intent) : nextStepSummary(nextStep!)}
                </div>
              </div>
              {activeExerciseOwnsNextStep && onReturnToCurrentExercise
                ? (
                    <button
                      type="button"
                      aria-label={activeExercise!.intent === 'review_check'
                        ? t`回到当前复习检查 ${shownNextStepTitle}`
                        : t`回到当前练习 ${shownNextStepTitle}`}
                      title={returnToActiveExerciseTitle}
                      onClick={returnToCurrentExercise}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-tour-border bg-tour-surface px-2 py-1 text-[11px] font-semibold text-tour-heading hover:bg-tour-bg"
                    >
                      {activeExercise!.intent === 'review_check' ? <Trans>回到复习检查</Trans> : <Trans>回到练习</Trans>}
                    </button>
                  )
                : onReviewConcept && nextStep && (
                  <button
                    type="button"
                    aria-label={t`打开下一步复习 ${nextStepTitle}`}
                    title={nextReviewTitle}
                    onClick={() => reviewConcept(nextStep.conceptId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-tour-border bg-tour-surface px-2 py-1 text-[11px] font-semibold text-tour-heading hover:bg-tour-bg"
                  >
                    <Trans>去复习</Trans>
                  </button>
                )}
            </div>
          </div>
        )}

        {empty
          ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                <Trans>开始第一节课后，这里会展示已看内容、练习提交和复习检查证据。</Trans>
              </div>
            )
          : (
              <div className="max-h-96 space-y-3 overflow-auto px-3 py-3">
                {groups.map(group => (
                  <ConceptGroupSection
                    key={group.status}
                    group={group}
                    lang={lang}
                    progressDetails={progressDetails}
                    onReviewConcept={reviewConcept}
                  />
                ))}
              </div>
            )}
      </PopoverContent>
    </Popover>
  )
}

function progressTriggerDescription({
  empty,
  actionableCount,
  provenCount,
  totalTracked,
}: {
  empty: boolean
  actionableCount: number
  provenCount: number
  totalTracked: number
}): string {
  if (empty)
    return t`打开学习进度面板；开始课堂后会显示已看内容、练习提交和复习检查证据。`
  if (actionableCount > 0) {
    const count = actionableCount
    return t`打开学习进度面板；有 ${count} 个概念需要复习、练习或复查。`
  }

  const proven = provenCount
  const total = totalTracked
  return t`打开学习进度面板；已证明或掌握 ${proven} / ${total} 个接触过的概念。`
}

function progressTriggerLabel({
  empty,
  actionableCount,
  provenCount,
  totalTracked,
}: {
  empty: boolean
  actionableCount: number
  provenCount: number
  totalTracked: number
}): string {
  if (empty)
    return t`学习进度，尚未记录概念进度`
  if (actionableCount > 0) {
    const count = actionableCount
    return t`学习进度，${count} 个待处理概念`
  }

  const proven = provenCount
  const total = totalTracked
  return t`学习进度，已证明或掌握 ${proven} / ${total} 个接触过的概念`
}

function ConceptGroupSection({
  group,
  lang,
  progressDetails,
  onReviewConcept,
}: {
  group: ConceptGroup
  lang: string
  progressDetails: Map<string, ConceptProgressEntry>
  onReviewConcept?: (conceptId: string) => void
}) {
  if (group.ids.length === 0)
    return null

  const toneClass = group.tone === 'success'
    ? 'text-classroom-success-fg'
    : group.tone === 'warning' ? 'text-classroom-warning-fg' : 'text-muted-foreground'

  return (
    <div data-testid={`concept-group-${group.status}`}>
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold', toneClass)}>
        {group.icon}
        <span>{group.label}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {group.ids.length}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        {group.helper}
      </p>
      <ul className="mt-1.5 space-y-1">
        {group.ids.map((id) => {
          const title = conceptTitleText(id, lang)
          const detail = progressDetails.get(id)
          return (
            <li key={id} className="text-xs leading-relaxed text-tour-text">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <ConceptTitle conceptId={id} lang={lang} />
                  {detail && <ConceptProgressReason detail={detail} lang={lang} />}
                </div>
                {onReviewConcept && (
                  <button
                    type="button"
                    aria-label={t`在复习页查看 ${title}`}
                    title={t`在复习页查看 ${title} 的内容、证据和建议；不会改变学习进度。`}
                    onClick={() => onReviewConcept(id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-tour-border bg-tour-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-tour-bg hover:text-tour-heading"
                  >
                    <BookOpenCheck aria-hidden="true" className="size-3" />
                    <Trans>复习</Trans>
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ConceptProgressReason({ detail, lang }: { detail: ConceptProgressEntry, lang: string }) {
  const reason = progressReasonText(detail, lang)
  if (!reason)
    return null

  return (
    <div
      data-testid={`concept-progress-reason-${detail.conceptId}`}
      className="mt-0.5 text-[11px] leading-5 text-muted-foreground"
    >
      {reason}
    </div>
  )
}

function isActionableConcept(entry: ConceptProgressEntry): boolean {
  if (entry.readiness === 'review_only' || entry.readiness === 'content_unavailable')
    return false
  return entry.status === 'blocked'
    || entry.status === 'stale'
    || entry.status === 'practicing'
    || entry.status === 'seen'
}

function compareActionableConcepts(
  a: ConceptProgressEntry,
  b: ConceptProgressEntry,
  progressEntryOrder: ReadonlyMap<string, number>,
): number {
  return actionPriority(a.status) - actionPriority(b.status)
    || (progressEntryOrder.get(a.conceptId) ?? Number.MAX_SAFE_INTEGER) - (progressEntryOrder.get(b.conceptId) ?? Number.MAX_SAFE_INTEGER)
    || a.conceptId.localeCompare(b.conceptId)
}

function actionPriority(status: ConceptStatus): number {
  if (status === 'blocked')
    return 0
  if (status === 'stale')
    return 1
  if (status === 'practicing')
    return 2
  if (status === 'seen')
    return 3
  return 4
}

function nextStepSummary(entry: ConceptProgressEntry): string {
  if (entry.readiness === 'content_unavailable')
    return t`内容不可用`
  if (entry.status === 'blocked')
    return t`先查看提示，再重新练习`
  if (entry.status === 'stale')
    return t`做一次复习检查`
  if (entry.status === 'practicing')
    return t`继续完成练习`
  return t`做一次练习验证`
}

function activeExerciseNextStepSummary(intent: string): string {
  return intent === 'review_check' ? t`继续当前复习检查` : t`继续当前练习`
}

function progressReasonText(entry: ConceptProgressEntry, lang: string): string | null {
  if (entry.readiness === 'content_unavailable') {
    return lang === 'en'
      ? 'This concept is not available for AI Classroom progress because its content has not passed validation.'
      : '此概念尚未通过 AI Classroom 内容验证，不能作为主线进度目标。'
  }

  if (entry.readiness === 'review_only') {
    return lang === 'en'
      ? 'This concept is review-only: content is available, but there is no validated practice loop yet.'
      : '此概念目前只读：内容可复习，但还没有验证练习闭环。'
  }

  if (entry.blockerExplanation)
    return entry.blockerExplanation

  if (entry.status === 'stale') {
    return lang === 'en'
      ? 'Earlier evidence is stale; run a review check before relying on this progress.'
      : '已有证据需要复查，先做一次复习检查再继续。'
  }

  const latestEvidence = latestEvidenceForProgress(entry)
  if (latestEvidence) {
    if (latestEvidence.outcome === 'success') {
      if (latestEvidence.strength === 'mastery') {
        return lang === 'en'
          ? 'A recent review check passed independently, so this counts as mastery evidence.'
          : '最近一次复习检查独立通过，已记录为掌握证据。'
      }
      if (latestEvidence.strength === 'aided') {
        return lang === 'en'
          ? 'The latest successful exercise used help, so a later independent check is still useful.'
          : '最近一次练习在帮助后通过，后续仍建议做独立检查。'
      }
      return lang === 'en'
        ? 'The latest exercise submission passed; progress is based on recorded practice evidence.'
        : '最近一次练习已通过，进度来自练习提交。'
    }
    if (latestEvidence.outcome === 'failure') {
      return lang === 'en'
        ? 'The latest submission did not pass; continue practicing this concept.'
        : '最近一次提交未通过，需要继续练习这个概念。'
    }
    if (latestEvidence.outcome === 'skip') {
      return lang === 'en'
        ? 'The latest exercise was skipped; review the concept before validating it again.'
        : '最近跳过了练习，建议先复习再做一次验证。'
    }
    if (latestEvidence.outcome === 'self_report') {
      return lang === 'en'
        ? 'This is based on self-report only; it still needs practice evidence.'
        : '这里只记录了自述理解，还需要练习证据。'
    }
  }

  if (entry.exposure === 'seen') {
    return lang === 'en'
      ? 'Core content has appeared in class, but there is no passing practice evidence yet.'
      : '已在课堂中看过核心内容，还没有通过练习证据。'
  }
  if (entry.exposure === 'skipped') {
    return lang === 'en'
      ? 'This content was skipped in the live flow, but remains available for review.'
      : '课堂曾跳过这部分内容，复习页仍可查看。'
  }
  if (entry.exposure === 'unseen') {
    return lang === 'en'
      ? 'Review content is available, but it has not entered the live classroom yet.'
      : '复习内容已可用，但还没有进入课堂主线。'
  }

  return null
}

function latestEvidenceForProgress(entry: ConceptProgressEntry): ConceptProgressEntry['evidence'][number] | null {
  let latest: ConceptProgressEntry['evidence'][number] | null = null
  for (const evidence of entry.evidence) {
    if (!latest || evidence.createdAt >= latest.createdAt)
      latest = evidence
  }
  return latest
}

function conceptTitleText(conceptId: string, lang: string): string {
  const concept = getConcept(conceptId)
  if (!concept)
    return t`未命名概念`
  return lang === 'en' ? concept.title.en : concept.title.zh
}

function ConceptTitle({ conceptId, lang }: { conceptId: string, lang: string }) {
  const concept = getConcept(conceptId)
  if (!concept)
    return <span className="text-muted-foreground"><Trans>未命名概念</Trans></span>
  const title = lang === 'en' ? concept.title.en : concept.title.zh
  return <span>{title}</span>
}
