'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Award, BookOpenCheck, CircleDashed, ExternalLink, GraduationCap, KeyRound, Loader2, MessageCircle, PlayCircle, ShieldAlert, ShieldCheck, Sprout, TrendingUp, Undo2, X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { projectClassroomReviewView } from '@/lib/ai/classroom/view-projections'
import type { ClassroomReviewBlock, ClassroomReviewConcept } from '@/lib/ai/classroom/view-projections'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ChatIntentKind, ClassroomSession, ConceptStatus, LearningEvidence, ReviewExposureStatus } from '@/lib/ai/classroom/types'
import type { ReviewArtifactGroup } from '@/lib/ai/classroom/review-artifacts'
import type { SourceReference } from '@/lib/ai/course-content/types'
import { getStaticTourSourceHref } from '@/lib/ai/course-content/static-tour-links'
import { LessonBlockView } from '@/features/tour-ai/components/LessonBlockView'
import { cn } from '@/lib/utils'
import { deriveActiveConceptId } from '@/lib/ai/classroom/selectors'
import type { ConceptReadiness } from '@/lib/ai/classroom/selectors'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

interface ClassroomReviewViewProps {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  lang: string
  focusConceptId?: string
  focusRequestKey?: number
  previewOnly?: boolean
  lessonGenerationPending?: boolean
  onOpenChat: (conceptId: string) => void
  onActiveConceptChange?: (conceptId: string | undefined) => void
  onReviewCheckQueued?: () => void
  onReturnToLive?: (options?: ReviewReturnOptions) => void
}

interface ReviewReturnOptions {
  focus?: 'current_exercise' | 'generation' | 'continue'
  conceptId?: string
}

interface RecentlyRemovedReviewGroup {
  groupId: string
  conceptId: string
  title: string
  artifactIds: string[]
  hasEvidenceLinks: boolean
}

interface ManualConceptSelection {
  conceptId: string
  focusRequestScope: string | null
}

export function ClassroomReviewView({ session, dispatch, lang, focusConceptId, focusRequestKey, previewOnly = false, lessonGenerationPending = false, onOpenChat, onActiveConceptChange, onReviewCheckQueued, onReturnToLive }: ClassroomReviewViewProps) {
  const reviewView = useMemo(() => projectClassroomReviewView(session, lang), [session, lang])
  const activeConceptTitleId = useId()
  const activeConceptStatusId = useId()
  const chatActionDescriptionId = useId()
  const removedReviewGroupTitleId = useId()
  const removedReviewGroupDescriptionId = useId()
  const config = useLLMConfig()
  const keySource = useLLMConfigStore(state => state.keySource)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const configReady = isLLMConfigReady(config)
  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const validFocusConceptId = useMemo(() => {
    if (focusConceptId && reviewView.concepts.some(concept => concept.conceptId === focusConceptId))
      return focusConceptId
    return null
  }, [focusConceptId, reviewView.concepts])
  const focusRequestScope = validFocusConceptId
    ? `${validFocusConceptId}:${focusRequestKey ?? 0}`
    : null
  const preferredConceptId = useMemo(() => {
    if (validFocusConceptId)
      return validFocusConceptId
    const activeId = deriveActiveConceptId(session)
    if (activeId && reviewView.concepts.some(concept => concept.conceptId === activeId))
      return activeId
    return reviewView.defaultConceptId ?? ''
  }, [validFocusConceptId, reviewView.concepts, reviewView.defaultConceptId, session])
  const [manualSelection, setManualSelection] = useState<ManualConceptSelection | null>(null)
  const [recentlyRemovedGroup, setRecentlyRemovedGroup] = useState<RecentlyRemovedReviewGroup | null>(null)
  const undoRemovalButtonRef = useRef<HTMLButtonElement>(null)
  const activeConceptHeadingRef = useRef<HTMLHeadingElement>(null)
  const artifactGroupMapRef = useRef(new Map<string, HTMLElement>())
  const conceptButtonMapRef = useRef(new Map<string, HTMLButtonElement>())
  const manualConceptId = manualSelection?.focusRequestScope === focusRequestScope
    && reviewView.concepts.some(concept => concept.conceptId === manualSelection.conceptId)
    ? manualSelection.conceptId
    : null
  const activeConceptId = manualConceptId ?? preferredConceptId
  const activeConcept = reviewView.concepts.find(concept => concept.conceptId === activeConceptId) ?? reviewView.concepts[0] ?? null
  const activeConceptIndex = activeConcept
    ? reviewView.concepts.findIndex(concept => concept.conceptId === activeConcept.conceptId)
    : -1
  const activeConceptPosition = activeConceptIndex >= 0 ? activeConceptIndex + 1 : 0
  const reviewConceptCount = reviewView.concepts.length
  const activeChatConceptId = activeConcept?.conceptId ?? ''
  const activeConceptStatus = activeConcept
    ? activeConceptStatusText(activeConcept, activeConceptPosition, reviewConceptCount)
    : null
  const visibleRemovedGroup = recentlyRemovedGroup?.conceptId === activeConcept?.conceptId
    ? recentlyRemovedGroup
    : null
  const activeExercise = session.currentExercise?.status === 'active'
    ? session.currentExercise
    : null
  const hasQueuedLessonGeneration = session.eventQueue.length > 0
  const reviewFocusNoticeVisible = validFocusConceptId != null && focusRequestKey != null
  const activeConceptTitle = activeConcept?.title ?? ''
  const chatActionDescription = previewOnly
    ? t`先进入 AI 课堂，再打开当前复习概念的聊天；不会直接排队复习检查。`
    : t`打开只围绕当前复习概念的聊天；不会改变复习进度或排队新的课堂内容。`

  useEffect(() => {
    onActiveConceptChange?.(activeConcept?.conceptId)
  }, [activeConcept?.conceptId, onActiveConceptChange])

  useEffect(() => {
    if (visibleRemovedGroup)
      undoRemovalButtonRef.current?.focus()
  }, [visibleRemovedGroup])

  useEffect(() => {
    if (!reviewFocusNoticeVisible)
      return
    const frame = window.requestAnimationFrame(() => {
      activeConceptHeadingRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeConcept?.conceptId, focusRequestScope, reviewFocusNoticeVisible])

  useEffect(() => {
    if (!activeConcept?.conceptId)
      return
    conceptButtonMapRef.current.get(activeConcept.conceptId)?.scrollIntoView?.({
      block: 'nearest',
      inline: 'center',
    })
  }, [activeConcept?.conceptId])

  const setArtifactGroupRef = (groupId: string) => (element: HTMLElement | null) => {
    if (element)
      artifactGroupMapRef.current.set(groupId, element)
    else
      artifactGroupMapRef.current.delete(groupId)
  }

  const setConceptButtonRef = (conceptId: string) => (element: HTMLButtonElement | null) => {
    if (element)
      conceptButtonMapRef.current.set(conceptId, element)
    else
      conceptButtonMapRef.current.delete(conceptId)
  }

  const focusRestoredArtifactGroup = (groupId: string) => {
    window.requestAnimationFrame(() => {
      artifactGroupMapRef.current.get(groupId)?.focus()
    })
  }

  const removeArtifactGroup = (group: ReviewArtifactGroup) => {
    const artifactIds = group.controls.map(control => control.artifactId)
    if (artifactIds.length === 0)
      return

    const now = Date.now()
    setRecentlyRemovedGroup({
      groupId: group.groupId,
      conceptId: group.conceptId,
      title: group.title,
      artifactIds,
      hasEvidenceLinks: group.evidenceIds.length > 0,
    })
    dispatch({
      type: 'BATCH',
      actions: artifactIds.map(artifactId => ({
        type: 'REMOVE_REVIEW_ARTIFACT',
        artifactId,
        now,
      })),
    })
  }

  const undoRecentRemoval = () => {
    if (!recentlyRemovedGroup)
      return

    const now = Date.now()
    dispatch({
      type: 'BATCH',
      actions: recentlyRemovedGroup.artifactIds.map(artifactId => ({
        type: 'RESTORE_REVIEW_ARTIFACT',
        artifactId,
        now,
      })),
    })
    setRecentlyRemovedGroup(null)
    focusRestoredArtifactGroup(recentlyRemovedGroup.groupId)
  }

  const requestReviewAction = (concept: ClassroomReviewConcept) => {
    if (activeExercise) {
      onReturnToLive?.({ focus: 'current_exercise' })
      return
    }
    if (hasQueuedLessonGeneration) {
      onReturnToLive?.({ focus: 'generation' })
      return
    }
    if (!configReady || sharedQuotaExhausted) {
      openSettings(true)
      return
    }

    const conceptTitle = concept.title
    if (concept.progress.readiness === 'content_unavailable')
      return
    const intent = reviewIntentForReadiness(concept.progress.readiness)
    dispatch({
      type: 'EMIT_CHAT_INTENT',
      intent,
      summary: reviewActionSummary(concept.progress.readiness, conceptTitle),
      activeConceptId: concept.conceptId,
      now: Date.now(),
    })
    onReviewCheckQueued?.()
  }

  return (
    <div data-testid="classroom-review-view" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 md:flex-row md:px-5 md:py-5">
      <aside className="w-full shrink-0 border-b border-tour-border pb-3 md:w-64 md:border-b-0 md:border-r md:pb-0 md:pr-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-tour-heading">
            <BookOpenCheck aria-hidden="true" className="size-4" />
            <Trans>复习</Trans>
          </div>
          {activeConceptPosition > 0 && (
            <span
              data-testid="classroom-review-concept-position"
              className="rounded border border-tour-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground md:hidden"
            >
              {t`概念 ${activeConceptPosition} / ${reviewConceptCount}`}
            </span>
          )}
        </div>
        <nav
          data-testid="classroom-review-concept-rail"
          aria-label={t`复习概念导航`}
          className="flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0"
        >
          {reviewView.concepts.map((concept) => {
            const selected = concept.conceptId === activeConcept?.conceptId
            const conceptButtonLabel = reviewConceptButtonLabel(concept, selected)
            return (
              <button
                key={concept.conceptId}
                ref={setConceptButtonRef(concept.conceptId)}
                type="button"
                aria-current={selected ? 'true' : undefined}
                aria-label={conceptButtonLabel}
                title={conceptButtonLabel}
                data-testid="classroom-review-concept-button"
                onClick={() => setManualSelection({
                  conceptId: concept.conceptId,
                  focusRequestScope,
                })}
                className={cn(
                  'w-44 max-w-[72vw] shrink-0 snap-start rounded-md px-2 py-2 text-left text-xs leading-relaxed hover:bg-tour-bg md:w-full md:max-w-none',
                  selected && 'bg-tour-bg text-tour-heading',
                )}
              >
                <div className="truncate font-medium">{concept.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ProgressStatusBadge status={concept.progress.status} compact />
                  <ExposureBadge status={concept.exposureStatus} />
                </div>
              </button>
            )
          })}
        </nav>
      </aside>

      <main
        aria-labelledby={activeConcept ? activeConceptTitleId : undefined}
        aria-describedby={activeConceptStatus ? activeConceptStatusId : undefined}
        className="min-w-0 flex-1"
      >
        <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div>
            <h2
              ref={activeConceptHeadingRef}
              id={activeConceptTitleId}
              tabIndex={reviewFocusNoticeVisible ? -1 : undefined}
              className="break-words text-xl font-bold tracking-normal text-tour-heading focus:outline-none focus:ring-2 focus:ring-tour-link/35 focus:ring-offset-2 focus:ring-offset-tour-bg"
            >
              {activeConcept?.title ?? activeConceptId}
            </h2>
            {reviewFocusNoticeVisible && activeConcept && (
              <div
                data-testid="classroom-review-focus-notice"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="mt-3 rounded-md border border-tour-border bg-tour-bg px-3 py-2 text-xs font-medium leading-6 text-tour-heading"
              >
                {t`已打开 ${activeConceptTitle} 的复习。可以查看建议依据、个人笔记，或从这里返回课堂。`}
              </div>
            )}
            {activeConceptStatus && (
              <div
                id={activeConceptStatusId}
                data-testid="classroom-review-active-concept-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {activeConceptStatus}
              </div>
            )}
            {activeConcept && (
              <p className="mt-1 max-w-2xl break-words text-sm leading-7 text-muted-foreground">
                {activeConcept.summary}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {activeConcept && <ContentStatusBadge status={activeConcept.contentStatus} />}
              <span className="inline-flex rounded border border-tour-border px-2 py-1 font-mono">
                <Trans>内容版本</Trans>
                {' '}
                {reviewView.contentVersion}
              </span>
              <span className="inline-flex rounded border border-tour-border px-2 py-1">
                {reviewView.trackTitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={!activeChatConceptId}
            aria-describedby={activeChatConceptId ? chatActionDescriptionId : undefined}
            title={activeChatConceptId ? chatActionDescription : undefined}
            onClick={() => {
              if (!activeChatConceptId)
                return
              if (previewOnly) {
                onReturnToLive?.({ focus: 'generation', conceptId: activeChatConceptId })
                return
              }
              onOpenChat(activeChatConceptId)
            }}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-md border border-tour-border bg-tour-surface px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-tour-bg disabled:opacity-50 sm:w-auto sm:py-1.5"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            {previewOnly ? <Trans>开始课堂后提问</Trans> : <Trans>围绕此概念聊天</Trans>}
          </button>
          <span id={chatActionDescriptionId} className="sr-only">
            {chatActionDescription}
          </span>
        </div>

        {activeConcept && (
          <ReviewProgressSummary
            concept={activeConcept}
            activeExercise={activeExercise}
            queuedLessonGeneration={hasQueuedLessonGeneration}
            configReady={configReady}
            sharedQuotaExhausted={sharedQuotaExhausted}
            quotaResetAt={autoQuota?.nextResetAt}
            previewOnly={previewOnly}
            lessonGenerationPending={lessonGenerationPending}
            onRequestReviewAction={requestReviewAction}
            onReturnToLive={onReturnToLive}
            onConfigureAI={() => openSettings(true)}
          />
        )}

        <div className="space-y-7">
          <section className="space-y-4">
            {activeConcept?.blocks.map(block => (
              <div key={block.blockId} className="relative">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ExposureBadge status={block.exposureStatus} />
                  <ReviewBlockVersionNotice block={block} />
                  <SourceReferenceLinks lang={lang} sourceRefs={block.sourceRefs} sourceContext={reviewBlockSourceContext(block)} />
                </div>
                <LessonBlockView block={block.content} chapterId={block.blockKey} />
              </div>
            ))}
          </section>

          <section className="border-t border-tour-border pt-5">
            <div className="mb-3 text-sm font-semibold text-tour-heading"><Trans>个人笔记</Trans></div>
            {visibleRemovedGroup && (
              <div
                role="region"
                aria-labelledby={removedReviewGroupTitleId}
                aria-describedby={removedReviewGroupDescriptionId}
                className="mb-3 flex flex-col gap-2 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:flex-row sm:items-center sm:justify-between"
              >
                <div
                  id={removedReviewGroupDescriptionId}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-w-0 leading-6"
                >
                  <span id={removedReviewGroupTitleId}>
                    <Trans>已移除复习内容。</Trans>
                  </span>
                  <span className="ml-1 font-medium text-tour-heading">{visibleRemovedGroup.title}</span>
                  {visibleRemovedGroup.hasEvidenceLinks && (
                    <span className="ml-1 text-muted-foreground">
                      <Trans>相关练习记录仍会保留。</Trans>
                    </span>
                  )}
                </div>
                <button
                  ref={undoRemovalButtonRef}
                  type="button"
                  aria-describedby={removedReviewGroupDescriptionId}
                  title={reviewRemovalUndoTitle(visibleRemovedGroup)}
                  onClick={undoRecentRemoval}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-1.5 text-xs font-semibold text-classroom-warning-fg sm:w-auto"
                >
                  <Undo2 aria-hidden="true" className="size-3.5" />
                  <Trans>撤销</Trans>
                </button>
              </div>
            )}
            {!activeConcept || activeConcept.artifactGroups.length === 0
              ? <ReviewNotesEmptyState hasUndo={visibleRemovedGroup != null} />
              : (
                  <div className="space-y-3">
                    {activeConcept.artifactGroups.map(group => (
                      <ReviewArtifactGroupCard
                        key={group.groupId}
                        group={group}
                        refCallback={setArtifactGroupRef(group.groupId)}
                        onRemove={removeArtifactGroup}
                      />
                    ))}
                  </div>
                )}
          </section>
        </div>
      </main>
    </div>
  )
}

function ReviewBlockVersionNotice({ block }: { block: ClassroomReviewBlock }) {
  const detailId = useId()
  if (!block.versionMismatch)
    return null

  const encounteredVersion = block.exposure?.contentVersion ?? block.contentVersion
  const currentVersion = block.contentVersion

  return (
    <>
      <span
        aria-describedby={detailId}
        className="inline-flex rounded border border-classroom-warning-border bg-classroom-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-classroom-warning-fg"
      >
        <Trans>内容已更新</Trans>
      </span>
      <span
        id={detailId}
        data-testid="review-block-version-notice"
        className="inline-flex rounded border border-classroom-warning-border bg-classroom-warning-bg px-1.5 py-0.5 text-[10px] text-classroom-warning-fg"
      >
        <Trans>
          最初学习版本
          {' '}
          {encounteredVersion}
          {' '}
          ，当前复习显示版本
          {' '}
          {currentVersion}
          。
        </Trans>
      </span>
    </>
  )
}

function ReviewArtifactGroupCard({
  group,
  refCallback,
  onRemove,
}: {
  group: ReviewArtifactGroup
  refCallback: (element: HTMLElement | null) => void
  onRemove: (group: ReviewArtifactGroup) => void
}) {
  const titleId = useId()
  const removeDescriptionId = useId()
  const title = group.title
  const hasEvidenceLinks = group.evidenceIds.length > 0
  const grouped = group.artifactCount > 1
  const removeDescription = reviewArtifactRemovalDescriptionText(group)

  return (
    <article
      ref={refCallback}
      aria-labelledby={titleId}
      tabIndex={-1}
      className="rounded-md border border-tour-border bg-tour-surface p-4 focus:outline-none focus:ring-2 focus:ring-tour-accent-fg/40"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex max-w-full flex-wrap items-center gap-1 text-xs font-semibold uppercase tracking-normal text-tour-link">
            <span className="min-w-0 break-words">
              {group.kind === 'remediation_pattern'
                ? <Trans>练习建议</Trans>
                : <Trans>补充说明</Trans>}
            </span>
            {group.artifactCount > 1 && (
              <span className="shrink-0 font-mono text-muted-foreground">
                x
                {group.artifactCount}
              </span>
            )}
          </div>
          <h3 id={titleId} className="mt-1 break-words text-sm font-semibold text-tour-heading">{group.title}</h3>
        </div>
        <button
          type="button"
          aria-label={t`移除复习内容：${title}`}
          aria-describedby={removeDescriptionId}
          title={removeDescription}
          onClick={() => onRemove(group)}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">{group.summary}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-tour-text">{group.body}</p>
      <p id={removeDescriptionId} className={(hasEvidenceLinks || grouped) ? 'mt-3 break-words text-[11px] leading-5 text-muted-foreground' : 'sr-only'}>
        {removeDescription}
      </p>
    </article>
  )
}

function reviewArtifactRemovalDescriptionText(group: ReviewArtifactGroup): string {
  const hasEvidenceLinks = group.evidenceIds.length > 0
  const artifactCount = group.artifactCount
  if (artifactCount > 1) {
    return hasEvidenceLinks
      ? t`会从复习页移除这组 ${artifactCount} 条合并后的笔记，相关练习记录仍会保留。`
      : t`会从复习页移除这组 ${artifactCount} 条合并后的笔记，教程内容和学习进度不会改变。`
  }

  return hasEvidenceLinks
    ? t`只会从复习页移除这条笔记，相关练习记录仍会保留。`
    : t`只会从复习页移除这条笔记，教程内容和学习进度不会改变。`
}

function reviewRemovalUndoTitle(group: RecentlyRemovedReviewGroup): string {
  const removedCount = group.artifactIds.length
  if (removedCount > 1) {
    return group.hasEvidenceLinks
      ? t`撤销移除，恢复这组 ${removedCount} 条复习内容；相关练习记录一直保留。`
      : t`撤销移除，恢复这组 ${removedCount} 条复习内容；教程内容和学习进度一直保留。`
  }

  return group.hasEvidenceLinks
    ? t`撤销移除，恢复这条复习内容；相关练习记录一直保留。`
    : t`撤销移除，恢复这条复习内容；教程内容和学习进度一直保留。`
}

function ReviewNotesEmptyState({ hasUndo }: { hasUndo: boolean }) {
  return (
    <div
      data-testid="classroom-review-empty-notes"
      className="rounded-md border border-dashed border-tour-border bg-tour-bg px-4 py-4 text-sm"
    >
      <div className="font-semibold text-tour-heading">
        <Trans>当前概念暂无个人笔记</Trans>
      </div>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        {hasUndo
          ? <Trans>已移除的内容可以先撤销；上方教程内容和学习进度仍会保留。</Trans>
          : <Trans>先看上方建议；需要保留的说明会出现在这里。</Trans>}
      </p>
    </div>
  )
}

function ReviewProgressSummary({
  concept,
  activeExercise,
  queuedLessonGeneration,
  configReady,
  sharedQuotaExhausted,
  quotaResetAt,
  previewOnly,
  lessonGenerationPending,
  onRequestReviewAction,
  onReturnToLive,
  onConfigureAI,
}: {
  concept: ClassroomReviewConcept
  activeExercise: ClassroomSession['currentExercise']
  queuedLessonGeneration: boolean
  configReady: boolean
  sharedQuotaExhausted: boolean
  quotaResetAt?: number
  previewOnly: boolean
  lessonGenerationPending: boolean
  onRequestReviewAction: (concept: ClassroomReviewConcept) => void
  onReturnToLive?: (options?: ReviewReturnOptions) => void
  onConfigureAI: () => void
}) {
  const [requestedAction, setRequestedAction] = useState<{ signature: string } | null>(null)
  const hasActiveExercise = activeExercise?.status === 'active'
  const activeExerciseIsReviewCheck = hasActiveExercise && activeExercise?.intent === 'review_check'
  const readyToContinue = concept.progress.readiness === 'ready_for_next'
  const readOnlyConcept = concept.progress.readiness === 'review_only'
  const unavailableConcept = concept.progress.readiness === 'content_unavailable'
  const blockedByPreview = previewOnly && !hasActiveExercise && !queuedLessonGeneration
  const blockedByQueuedGeneration = !hasActiveExercise && queuedLessonGeneration
  const blockedByRuntimeGeneration = !hasActiveExercise && !blockedByQueuedGeneration && lessonGenerationPending
  const blockedByLessonGeneration = blockedByQueuedGeneration || blockedByRuntimeGeneration
  const blockedByAIService = !hasActiveExercise && !blockedByPreview && !blockedByLessonGeneration && !readyToContinue && !readOnlyConcept && !unavailableConcept && !configReady
  const blockedBySharedQuota = !hasActiveExercise && !blockedByPreview && !blockedByLessonGeneration && !readyToContinue && !readOnlyConcept && !unavailableConcept && configReady && sharedQuotaExhausted
  useEffect(() => {
    if (requestedAction && (blockedByLessonGeneration || hasActiveExercise)) {
      // eslint-disable-next-line react/set-state-in-effect -- External classroom state has acknowledged the request and now owns the disabled affordance.
      setRequestedAction(null)
    }
  }, [blockedByLessonGeneration, hasActiveExercise, requestedAction])
  const actionBlockedLabel = reviewBlockedActionLabel(concept.progress.readiness)
  const latestEvidence = latestEvidenceForConcept(concept)
  const evidenceOverview = reviewEvidenceOverviewForConcept(concept)
  const nextStepReason = reviewNextStepReason(concept, latestEvidence)
  const progressSourceSummary = reviewProgressSourceSummary(concept)
  const quotaResetMoment = quotaResetAt ? formatResetMoment(quotaResetAt) : ''
  const reasonId = useId()
  const progressSourceId = useId()
  const evidenceOverviewId = useId()
  const actionDetailsId = useId()
  const requestedActionStatusId = useId()
  const requestableAction = !blockedByPreview
    && !hasActiveExercise
    && !blockedByLessonGeneration
    && !readyToContinue
    && !readOnlyConcept
    && !unavailableConcept
    && !blockedByAIService
    && !blockedBySharedQuota
  const actionRequestSignature = `${concept.conceptId}:${concept.progress.readiness}`
  const actionRequested = requestableAction && requestedAction?.signature === actionRequestSignature
  const requestedActionLabel = reviewActionLabel(concept.progress.readiness)
  const requestedActionStatus = actionRequested
    ? t`已收到：${requestedActionLabel}。正在准备课堂内容。`
    : ''
  const actionDetailMessages = [
    blockedByPreview ? t`预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。` : null,
    hasActiveExercise
      ? activeExerciseIsReviewCheck
        ? t`先完成、跳过或提交当前复习检查，再使用复习页操作。`
        : t`先完成、跳过或提交当前练习，再使用复习页操作。`
      : null,
    blockedByQueuedGeneration ? t`课堂正在准备下一步，完成后再${actionBlockedLabel}。` : null,
    blockedByRuntimeGeneration ? t`课堂准备正在进行或等待恢复，完成后再${actionBlockedLabel}。` : null,
    unavailableConcept ? t`此概念尚未通过 AI Classroom 内容验证；可以临时聊天提问或查看来源教程，但不会排队课堂内容、练习或概念进度。` : null,
    readOnlyConcept ? t`此概念只有已验证说明，缺少可验证的学习技能和练习模板；可以复习内容或聊天提问，但不会排队练习，也不会改变概念进度。` : null,
    blockedByAIService ? t`完成 AI 服务配置后再${actionBlockedLabel}。` : null,
    blockedBySharedQuota
      ? quotaResetMoment
        ? t`共享额度已用完。下次刷新：${quotaResetMoment}，刷新后再${actionBlockedLabel}；使用自己的 API Key 可立刻继续。`
        : t`共享额度已用完。刷新后再${actionBlockedLabel}；使用自己的 API Key 可立刻继续。`
      : null,
    concept.progress.blockerExplanation || null,
  ].filter((message): message is string => Boolean(message))
  const hasActionDetails = actionDetailMessages.length > 0
  const actionDescribedBy = [
    reasonId,
    progressSourceId,
    evidenceOverview ? evidenceOverviewId : null,
    hasActionDetails ? actionDetailsId : null,
    actionRequested ? requestedActionStatusId : null,
  ].filter((id): id is string => Boolean(id)).join(' ')
  let actionButtonLabel = reviewActionLabel(concept.progress.readiness)
  if (blockedBySharedQuota)
    actionButtonLabel = t`使用自己的 API Key`
  if (blockedByAIService)
    actionButtonLabel = t`配置 AI 服务`
  if (readyToContinue)
    actionButtonLabel = t`返回课堂继续`
  if (unavailableConcept)
    actionButtonLabel = t`内容不可用`
  if (readOnlyConcept)
    actionButtonLabel = t`仅复习内容`
  if (blockedByLessonGeneration)
    actionButtonLabel = t`查看准备进度`
  if (hasActiveExercise)
    actionButtonLabel = activeExerciseIsReviewCheck ? t`查看当前复习检查` : t`查看当前练习`
  if (blockedByPreview)
    actionButtonLabel = t`开始 AI 课堂`
  if (actionRequested)
    actionButtonLabel = t`正在准备...`
  const ActionIcon = reviewActionIcon({
    actionRequested,
    blockedByAIService,
    blockedBySharedQuota,
    blockedByLessonGeneration,
    readOnlyConcept,
    unavailableConcept,
  })
  const actionTitle = [
    t`建议依据：${nextStepReason}`,
    t`进度来源：${progressSourceSummary}`,
    evidenceOverview ? reviewEvidenceOverviewTitle(evidenceOverview) : null,
    ...actionDetailMessages,
    actionRequested ? requestedActionStatus : null,
  ].filter((message): message is string => Boolean(message)).join(' ')

  return (
    <div className={cn(
      'mb-5 rounded-md border px-3 py-3 text-xs',
      progressToneClass(concept.progress.status),
    )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ProgressStatusBadge status={concept.progress.status} />
          <span className="text-muted-foreground"><Trans>下一步建议</Trans></span>
          <span className="font-semibold text-tour-heading">{readinessLabel(concept.progress.readiness)}</span>
        </div>
        <button
          type="button"
          aria-describedby={actionDescribedBy}
          aria-busy={actionRequested || undefined}
          title={actionTitle}
          onClick={() => {
            if (blockedByPreview) {
              onReturnToLive?.({ focus: 'generation', conceptId: concept.conceptId })
              return
            }
            if (hasActiveExercise) {
              onReturnToLive?.({ focus: 'current_exercise' })
              return
            }
            if (blockedByLessonGeneration) {
              onReturnToLive?.({ focus: 'generation' })
              return
            }
            if (readyToContinue) {
              onReturnToLive?.({ focus: 'continue' })
              return
            }
            if (blockedByAIService || blockedBySharedQuota) {
              onConfigureAI()
              return
            }
            if (actionRequested)
              return
            setRequestedAction({ signature: actionRequestSignature })
            onRequestReviewAction(concept)
          }}
          disabled={actionRequested || readOnlyConcept || unavailableConcept}
          className="inline-flex w-full max-w-full items-center justify-center gap-1.5 whitespace-normal rounded-md border border-tour-border bg-tour-surface px-2.5 py-1.5 text-center text-xs font-semibold leading-5 text-tour-heading hover:bg-tour-bg disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:shrink-0"
        >
          {actionRequested
            ? <ActionIcon aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
            : <ActionIcon aria-hidden="true" className="size-3.5 shrink-0" />}
          <span className="min-w-0 break-words">{actionButtonLabel}</span>
        </button>
      </div>
      <div
        id={reasonId}
        data-testid="review-progress-reason"
        className="mt-2 break-words rounded-md border border-current/10 bg-tour-surface/60 px-2.5 py-2 leading-6 text-muted-foreground"
      >
        <span className="font-semibold text-tour-heading"><Trans>建议依据</Trans></span>
        <span className="ml-2">{nextStepReason}</span>
      </div>
      <div
        id={progressSourceId}
        data-testid="review-progress-source"
        className="mt-2 break-words rounded-md border border-current/10 bg-tour-surface/50 px-2.5 py-2 leading-6 text-muted-foreground"
      >
        <span className="font-semibold text-tour-heading"><Trans>进度来源</Trans></span>
        <span className="ml-2">{progressSourceSummary}</span>
      </div>
      {evidenceOverview && (
        <div
          id={evidenceOverviewId}
          data-testid="review-progress-evidence-overview"
          className="mt-2 break-words rounded-md border border-current/10 bg-tour-surface/50 px-2.5 py-2 leading-6 text-muted-foreground"
        >
          <div className="font-semibold text-tour-heading"><Trans>证据概览</Trans></div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <EvidenceCountPill label={t`总计`} value={evidenceOverview.total} />
            <EvidenceCountPill label={t`通过`} value={evidenceOverview.success} />
            <EvidenceCountPill label={t`未通过`} value={evidenceOverview.failure} />
            <EvidenceCountPill label={t`跳过`} value={evidenceOverview.skip} />
            {evidenceOverview.reviewCheck > 0 && <EvidenceCountPill label={t`复习检查`} value={evidenceOverview.reviewCheck} />}
            {evidenceOverview.mastery > 0 && <EvidenceCountPill label={t`掌握证据`} value={evidenceOverview.mastery} />}
            {evidenceOverview.aided > 0 && <EvidenceCountPill label={t`AI 帮助后`} value={evidenceOverview.aided} />}
            {evidenceOverview.selfReport > 0 && <EvidenceCountPill label={t`自述`} value={evidenceOverview.selfReport} />}
            {evidenceOverview.stale > 0 && <EvidenceCountPill label={t`已过期`} value={evidenceOverview.stale} />}
          </div>
          <p className="mt-1 leading-6">{reviewEvidenceOverviewInsight(evidenceOverview)}</p>
        </div>
      )}
      {hasActionDetails && (
        <div
          id={actionDetailsId}
          data-testid="review-progress-action-details"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="break-words"
        >
          {actionDetailMessages.map(message => (
            <p key={message} className="mt-2 leading-6 text-muted-foreground">
              {message}
            </p>
          ))}
        </div>
      )}
      {actionRequested && (
        <p
          id={requestedActionStatusId}
          data-testid="review-action-requested-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-2 break-words leading-6 text-muted-foreground"
        >
          {requestedActionStatus}
        </p>
      )}
      {latestEvidence && (
        <div
          data-testid="review-progress-evidence"
          className="mt-3 break-words border-t border-tour-border pt-2 leading-6 text-muted-foreground"
        >
          <span className="font-semibold text-tour-heading"><Trans>最近记录</Trans></span>
          <span className="ml-2">{reviewEvidenceSummary(latestEvidence)}</span>
        </div>
      )}
    </div>
  )
}

function reviewActionIcon({
  actionRequested,
  blockedByAIService,
  blockedBySharedQuota,
  blockedByLessonGeneration,
  readOnlyConcept,
  unavailableConcept,
}: {
  actionRequested: boolean
  blockedByAIService: boolean
  blockedBySharedQuota: boolean
  blockedByLessonGeneration: boolean
  readOnlyConcept: boolean
  unavailableConcept: boolean
}) {
  if (actionRequested)
    return Loader2
  if (blockedByAIService || blockedBySharedQuota)
    return KeyRound
  if (blockedByLessonGeneration)
    return CircleDashed
  if (unavailableConcept)
    return X
  if (readOnlyConcept)
    return BookOpenCheck
  return PlayCircle
}

interface ReviewEvidenceOverview {
  total: number
  success: number
  failure: number
  skip: number
  selfReport: number
  aided: number
  mastery: number
  stale: number
  reviewCheck: number
}

function EvidenceCountPill({ label, value }: { label: string, value: number }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-tour-border bg-tour-bg px-1.5 py-0.5 text-[11px] leading-5 whitespace-normal">
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 font-mono font-semibold text-tour-heading">{value}</span>
    </span>
  )
}

function reviewEvidenceOverviewForConcept(concept: ClassroomReviewConcept): ReviewEvidenceOverview | null {
  const evidence = concept.progress.evidence
  if (evidence.length === 0)
    return null

  return evidence.reduce<ReviewEvidenceOverview>((stats, item) => {
    stats.total += 1
    if (item.outcome === 'success')
      stats.success += 1
    if (item.outcome === 'failure')
      stats.failure += 1
    if (item.outcome === 'skip')
      stats.skip += 1
    if (item.outcome === 'self_report')
      stats.selfReport += 1
    if (item.strength === 'aided')
      stats.aided += 1
    if (item.strength === 'mastery')
      stats.mastery += 1
    if (item.strength === 'stale')
      stats.stale += 1
    if (item.exerciseIntent === 'review_check')
      stats.reviewCheck += 1
    return stats
  }, {
    total: 0,
    success: 0,
    failure: 0,
    skip: 0,
    selfReport: 0,
    aided: 0,
    mastery: 0,
    stale: 0,
    reviewCheck: 0,
  })
}

function reviewEvidenceOverviewInsight(stats: ReviewEvidenceOverview): string {
  const { aided, failure, mastery, selfReport, skip, stale } = stats
  const notes: string[] = []
  if (mastery > 0)
    notes.push(t`包含 ${mastery} 条独立复习检查掌握证据。`)
  if (aided > 0)
    notes.push(t`有 ${aided} 条是在 AI 帮助后产生，作为较弱证据保留。`)
  if (failure > 0)
    notes.push(t`未通过记录会保留，并用于安排提示或复查。`)
  if (skip > 0)
    notes.push(t`跳过记录只说明学习路径选择，不等同于掌握。`)
  if (stale > 0)
    notes.push(t`有 ${stale} 条证据已过期，需要复查。`)
  if (selfReport > 0)
    notes.push(t`自我反馈需要后续练习验证。`)
  return notes.join('')
}

function reviewEvidenceOverviewTitle(stats: ReviewEvidenceOverview): string {
  const { failure, skip, success, total } = stats
  const insight = reviewEvidenceOverviewInsight(stats)
  const summary = t`证据概览：总计 ${total}，通过 ${success}，未通过 ${failure}，跳过 ${skip}。`
  return insight ? `${summary}${insight}` : summary
}

function latestEvidenceForConcept(concept: ClassroomReviewConcept): LearningEvidence | null {
  let latest: LearningEvidence | null = null
  for (const evidence of concept.progress.evidence) {
    if (!latest || evidence.createdAt >= latest.createdAt)
      latest = evidence
  }
  return latest
}

function reviewNextStepReason(concept: ClassroomReviewConcept, latestEvidence: LearningEvidence | null) {
  const readiness = concept.progress.readiness

  if (readiness === 'content_unavailable')
    return t`此概念尚未通过 AI Classroom 内容验证，不能作为主线课堂、练习或复习检查目标。`

  if (readiness === 'review_only')
    return t`这部分内容可用于复习和提问，但没有验证练习，不能作为主线进度推进。`

  if (readiness === 'needs_remediation') {
    return latestEvidence?.outcome === 'failure'
      ? t`最近练习没有通过，先查看针对性提示比直接继续更有效。`
      : t`已有未解决的练习问题，先查看针对性提示。`
  }

  if (readiness === 'needs_review_check')
    return t`已有证据需要复查，先做一次复习检查再继续依赖这个进度。`

  if (readiness === 'needs_practice') {
    if (latestEvidence?.outcome === 'skip')
      return t`最近跳过了练习，先重新完成一次练习验证。`
    if (latestEvidence?.outcome === 'failure')
      return t`最近练习未通过，继续练习可以补齐这个概念的证据。`
    return t`已有练习记录，但还缺少通过证据。`
  }

  if (readiness === 'ready_for_practice') {
    return concept.exposureStatus === 'skipped'
      ? t`课堂曾跳过这部分内容，先用练习验证是否真的掌握。`
      : t`已看过核心内容，但还没有通过练习证据。`
  }

  if (readiness === 'ready_for_next') {
    if (latestEvidence?.strength === 'aided')
      return t`已有通过记录，但这次通过使用过帮助；继续课堂时仍会保留后续检查机会。`
    return t`已有通过证据，当前概念可以先回到课堂继续推进。`
  }

  return concept.exposureStatus === 'unseen'
    ? t`这部分内容还没有进入课堂主线，先学习核心内容。`
    : t`先补齐核心内容，再开始练习验证。`
}

function reviewProgressSourceSummary(concept: ClassroomReviewConcept) {
  const evidenceCount = concept.progress.evidence.length
  if (concept.progress.readiness === 'content_unavailable')
    return t`内容验证未通过；即使存在历史记录，也不会由 AI 聊天或复习页操作直接生成主线进度。`
  if (evidenceCount > 0)
    return t`由课堂内容记录和 ${evidenceCount} 条练习证据自动推导，不由 AI 聊天直接判定。`
  if (concept.exposureStatus === 'seen')
    return t`由已看过的课堂内容自动推导；还没有练习证据，不由 AI 聊天直接判定。`
  if (concept.exposureStatus === 'skipped')
    return t`由已跳过的课堂内容自动推导；还没有练习证据，不由 AI 聊天直接判定。`
  return t`还没有课堂内容记录或练习证据；不由 AI 聊天直接判定。`
}

function reviewEvidenceSummary(evidence: LearningEvidence) {
  if (evidence.strength === 'stale')
    return <Trans>最近证据已过期，需要重新检查。</Trans>

  const isReviewCheck = evidence.exerciseIntent === 'review_check'

  if (evidence.outcome === 'success') {
    if (isReviewCheck && evidence.strength === 'mastery')
      return <Trans>最近一次复习检查独立通过，已作为掌握证据记录。</Trans>
    if (isReviewCheck && evidence.strength === 'aided')
      return <Trans>最近一次复习检查在 AI 帮助后通过，已记录为较弱证据。</Trans>
    if (evidence.strength === 'aided')
      return <Trans>最近一次练习在 AI 帮助后通过，已记录为较弱证据。</Trans>
    if (evidence.strength === 'mastery')
      return <Trans>最近一次练习已通过，已作为掌握证据记录。</Trans>
    return <Trans>最近一次练习独立通过，已记录为学习证据。</Trans>
  }

  if (evidence.outcome === 'failure') {
    return isReviewCheck
      ? <Trans>最近一次复习检查未通过，已作为需要复查的证据记录。</Trans>
      : <Trans>最近一次练习未通过，已作为需要提示或再练习的证据记录。</Trans>
  }

  if (evidence.outcome === 'skip') {
    return isReviewCheck
      ? <Trans>最近一次复习检查已跳过，仅作为弱记录保留。</Trans>
      : <Trans>最近一次练习已跳过，仅作为学习记录保留。</Trans>
  }

  return <Trans>最近记录来自自我反馈，还需要练习验证。</Trans>
}

function SourceReferenceLinks({ lang, sourceRefs, sourceContext }: { lang: string, sourceRefs: SourceReference[], sourceContext: string }) {
  const links = sourceRefs
    .map((source) => {
      const href = getStaticTourSourceHref(lang, { address: source })
      if (!href)
        return null
      return {
        href,
        label: `${sourceContext}，${sourceReferenceLabel(source)}`,
      }
    })
    .filter((link): link is { href: string, label: string } => Boolean(link))
  const uniqueLinks = Array.from(
    new Map(links.map(link => [link.href, link])).values(),
  )

  if (uniqueLinks.length === 0)
    return null

  return (
    <>
      {uniqueLinks.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          aria-label={t`打开来源教程：${label}`}
          title={t`打开来源教程：${label}`}
          className="inline-flex items-center gap-1 rounded border border-tour-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-tour-bg hover:text-tour-heading"
        >
          <ExternalLink aria-hidden="true" className="size-3" />
          <Trans>来源教程</Trans>
        </a>
      ))}
    </>
  )
}

function sourceReferenceLabel(source: SourceReference): string {
  return [
    humanizeSourceId(source.chapterId),
    source.subChapterId ? humanizeSourceId(source.subChapterId) : null,
    source.sectionId ? humanizeSourceId(source.sectionId) : null,
  ].filter((part): part is string => Boolean(part)).join(' / ')
}

function reviewBlockSourceContext(block: ClassroomReviewBlock): string {
  const content = block.content
  if (content.type === 'heading')
    return content.text
  if (content.type === 'concept_card')
    return content.title
  if (content.type === 'code_example')
    return content.title ?? t`代码示例`
  if (content.type === 'callout')
    return content.title ?? textSummary(content.body)
  if (content.type === 'steps')
    return content.title ?? t`步骤`
  if (content.type === 'compare')
    return `${content.leftTitle} / ${content.rightTitle}`
  return textSummary(content.body)
}

function textSummary(text: string): string {
  const compact = text.replace(/[`*_#>-]/g, '').replace(/\s+/g, ' ').trim()
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact
}

function humanizeSourceId(id: string): string {
  const withoutOrderPrefix = id.replace(/^\d+-/, '')
  const numeric = Number.parseInt(withoutOrderPrefix, 10)
  return Number.isNaN(numeric) ? withoutOrderPrefix : String(numeric)
}

function ProgressStatusBadge({ status, compact = false }: { status: ConceptStatus, compact?: boolean }) {
  const Icon = progressStatusIcon(status)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium',
      compact ? 'text-[10px]' : 'text-[11px]',
      progressBadgeClass(status),
    )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {progressStatusText(status)}
    </span>
  )
}

function ContentStatusBadge({ status }: { status: ClassroomReviewConcept['contentStatus'] }) {
  if (status === 'validated') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-classroom-success-border bg-classroom-success-bg px-2 py-1 font-medium text-classroom-success-fg">
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        <Trans>已验证教程内容</Trans>
      </span>
    )
  }

  if (status === 'read_only') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-tour-border bg-tour-bg px-2 py-1 font-medium text-muted-foreground">
        <ShieldAlert aria-hidden="true" className="size-3.5" />
        <Trans>只读教程内容</Trans>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-classroom-warning-border bg-classroom-warning-bg px-2 py-1 font-medium text-classroom-warning-fg">
      <ShieldAlert aria-hidden="true" className="size-3.5" />
      <Trans>内容不可用</Trans>
    </span>
  )
}

function ExposureBadge({ status }: { status: ReviewExposureStatus }) {
  const label = exposureStatusText(status)
  return (
    <span className="inline-flex rounded border border-tour-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {label}
    </span>
  )
}

function reviewConceptButtonLabel(concept: ClassroomReviewConcept, selected: boolean): string {
  const conceptTitle = concept.title
  const selectedState = selected ? t`当前选中` : t`可切换`
  const progressStatus = progressStatusText(concept.progress.status)
  const exposureStatus = exposureStatusText(concept.exposureStatus)
  return t`查看复习概念 ${conceptTitle}，${selectedState}，进度 ${progressStatus}，${exposureStatus}`
}

function activeConceptStatusText(concept: ClassroomReviewConcept, position: number, total: number): string {
  const conceptTitle = concept.title
  const progressStatus = progressStatusText(concept.progress.status)
  const exposureStatus = exposureStatusText(concept.exposureStatus)
  return t`正在查看复习概念 ${conceptTitle}，概念 ${position} / ${total}，进度 ${progressStatus}，${exposureStatus}`
}

function progressStatusText(status: ConceptStatus): string {
  if (status === 'mastered')
    return t`已掌握`
  if (status === 'demonstrated')
    return t`已证明`
  if (status === 'practicing')
    return t`练习中`
  if (status === 'seen')
    return t`已看过`
  if (status === 'blocked')
    return t`卡住`
  if (status === 'stale')
    return t`需复查`
  return t`未开始`
}

function exposureStatusText(status: ReviewExposureStatus): string {
  if (status === 'seen')
    return t`已看过`
  if (status === 'skipped')
    return t`已跳过`
  return t`未学习`
}

function readinessLabel(readiness: ConceptReadiness): string {
  if (readiness === 'content_unavailable')
    return t`内容不可用`
  if (readiness === 'review_only')
    return t`只读复习`
  if (readiness === 'ready_for_next')
    return t`可以继续下一步`
  if (readiness === 'ready_for_practice')
    return t`做一次练习验证`
  if (readiness === 'needs_practice')
    return t`继续完成练习`
  if (readiness === 'needs_remediation')
    return t`先查看提示，再重新提交`
  if (readiness === 'needs_review_check')
    return t`做一次复习检查`
  return t`先学习核心内容`
}

function reviewActionLabel(readiness: ConceptReadiness): string {
  if (readiness === 'content_unavailable')
    return t`内容不可用`
  if (readiness === 'review_only')
    return t`仅复习内容`
  if (readiness === 'needs_exposure')
    return t`开始学习此概念`
  if (readiness === 'needs_review_check')
    return t`开始复习检查`
  if (readiness === 'needs_remediation')
    return t`请求针对性提示`
  return t`开始练习验证`
}

function reviewBlockedActionLabel(readiness: ConceptReadiness): string {
  if (readiness === 'content_unavailable')
    return t`查看内容`
  if (readiness === 'review_only')
    return t`复习内容`
  if (readiness === 'needs_exposure')
    return t`开始学习`
  if (readiness === 'needs_remediation')
    return t`请求针对性提示`
  if (readiness === 'needs_review_check')
    return t`开始新的复习检查`
  return t`开始练习验证`
}

function reviewIntentForReadiness(readiness: ConceptReadiness): ChatIntentKind {
  if (readiness === 'content_unavailable')
    return 'go_deeper'
  if (readiness === 'review_only')
    return 'go_deeper'
  if (readiness === 'needs_exposure')
    return 'change_topic'
  if (readiness === 'needs_remediation')
    return 'explain_error'
  return 'review_check'
}

function reviewActionSummary(readiness: ConceptReadiness, conceptTitle: string): string {
  if (readiness === 'content_unavailable')
    return t`请围绕 ${conceptTitle} 做临时答疑，不要生成课堂内容或练习。`
  if (readiness === 'review_only')
    return t`请围绕 ${conceptTitle} 做只读复习讲解。`
  if (readiness === 'needs_exposure')
    return t`请从 ${conceptTitle} 开始讲解。`
  if (readiness === 'needs_remediation')
    return t`请围绕 ${conceptTitle} 的未通过练习给出针对性提示。`
  if (readiness === 'needs_review_check')
    return t`请为 ${conceptTitle} 安排一次复习检查。`
  return t`请为 ${conceptTitle} 安排一次练习验证。`
}

function progressStatusIcon(status: ConceptStatus) {
  if (status === 'mastered')
    return Award
  if (status === 'demonstrated')
    return GraduationCap
  if (status === 'practicing')
    return TrendingUp
  if (status === 'blocked')
    return ShieldAlert
  if (status === 'stale')
    return CircleDashed
  return Sprout
}

function progressBadgeClass(status: ConceptStatus): string {
  if (status === 'mastered' || status === 'demonstrated')
    return 'border-classroom-success-border bg-classroom-success-bg text-classroom-success-fg'
  if (status === 'practicing' || status === 'blocked')
    return 'border-classroom-warning-border bg-classroom-warning-bg text-classroom-warning-fg'
  return 'border-tour-border bg-tour-surface text-muted-foreground'
}

function progressToneClass(status: ConceptStatus): string {
  if (status === 'mastered' || status === 'demonstrated')
    return 'border-classroom-success-border bg-classroom-success-bg'
  if (status === 'practicing' || status === 'blocked')
    return 'border-classroom-warning-border bg-classroom-warning-bg'
  return 'border-tour-border bg-tour-bg'
}
