'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpenCheck, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { resolveReviewConceptId } from '@/features/teach/state/resolve-review-concept'
import { CoreContent } from '@/features/teach/components/classroom/CoreContent'
import { ExerciseInstanceCard } from '@/features/teach/components/classroom/ExerciseInstanceCard'
import { TeachMarkdown } from '@/features/teach/components/blocks/TeachMarkdown'
import type { ExerciseInstance } from '@/lib/teach/classroom/state'
import {
  isRemediationDiagnosticClaimPotentiallyAbandoned,
} from '@/lib/teach/classroom/state'
import { groupReviewArtifacts } from '@/lib/teach/classroom/retention'
import { deriveTrackPolicyState } from '@/lib/teach/classroom/track-policy'
import { createRemediationProvenanceIndex } from '@/lib/teach/classroom/remediation-provenance'
import { formatRevisionLabel } from '@/lib/teach/classroom/revision-label'

type Exposure = 'seen' | 'skipped' | 'unseen'

function exposureFor(
  snapshot: ReturnType<typeof useClassroomSnapshot>,
  conceptId: string,
  contentVersion: string,
  blockId: string,
): Exposure {
  if (snapshot.stream.some(entry =>
    entry.type === 'content_reference_group'
    && entry.conceptId === conceptId
    && entry.contentVersion === contentVersion
    && entry.blockIds.includes(blockId))) {
    return 'seen'
  }
  if (snapshot.stream.some(entry =>
    entry.type === 'skip_marker'
    && entry.conceptId === conceptId
    && entry.contentVersion === contentVersion
    && entry.blockIds.includes(blockId))) {
    return 'skipped'
  }
  return 'unseen'
}

function artifactTypeLabel(type: 'clarification' | 'remediation', english: boolean): string {
  if (type === 'clarification')
    return english ? 'Saved explanation' : '讲解笔记'
  return english ? 'Mistake diagnosis' : '错题诊断'
}

function revisionLabel(
  type: 'clarification' | 'remediation',
  version: string | null,
  english: boolean,
): string {
  if (type === 'clarification') {
    return english
      ? `Course revision ${formatRevisionLabel(version ?? '')}`
      : `课程版本 ${formatRevisionLabel(version ?? '')}`
  }
  if (version) {
    return english
      ? `Exercise criteria revision ${formatRevisionLabel(version)}`
      : `练习规则版本 ${formatRevisionLabel(version)}`
  }
  return english
    ? 'Exercise criteria revision unavailable'
    : '暂时无法确认练习规则版本'
}

function TeacherArtifactExposureGate({
  children,
  required,
}: {
  children: ReactNode
  required: boolean
}) {
  const { classroom, lang } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const [failed, setFailed] = useState(false)
  const english = lang === 'en'
  const cryptoUnavailable = required
    && !snapshot.teacherExposureEpoch
    && typeof globalThis.crypto?.randomUUID !== 'function'

  useEffect(() => {
    if (
      !required
      || snapshot.teacherExposureEpoch
      || failed
      || cryptoUnavailable
    ) {
      return
    }
    let active = true
    void classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: `artifact:${globalThis.crypto.randomUUID()}`,
    }).then((committed) => {
      if (active && !committed.teacherExposureEpoch)
        setFailed(true)
    }).catch(() => {
      if (active)
        setFailed(true)
    })
    return () => {
      active = false
    }
  }, [
    classroom,
    cryptoUnavailable,
    failed,
    required,
    snapshot.teacherExposureEpoch,
  ])

  if (!required || snapshot.teacherExposureEpoch)
    return children
  if (failed || cryptoUnavailable) {
    return (
      <p role="alert" className="mt-4 text-sm text-destructive">
        {english
          ? 'Retained teacher content could not be revealed safely.'
          : '无法安全展示已保留的教师内容。'}
      </p>
    )
  }
  return (
    <p role="status" className="mt-4 text-sm text-muted-foreground">
      {english
        ? 'Preparing retained teacher content…'
        : '正在准备已保留的教师内容…'}
    </p>
  )
}

export function ReviewView() {
  const { catalog, classroom, lang, now } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const selectedId = useWorkspaceStore(state => state.reviewConceptId)
  const openReviewConcept = useWorkspaceStore(state => state.openReviewConcept)

  const selectReviewConcept = (conceptId: string) => {
    openReviewConcept(conceptId)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const button = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[data-review-concept-id]'),
        ).find(candidate => candidate.dataset.reviewConceptId === conceptId)
        button?.focus()
      })
    })
  }
  const summaries = catalog.list()
  const conceptId = resolveReviewConceptId(selectedId, snapshot, catalog)
  const currentPack = conceptId ? catalog.get(conceptId) : undefined
  const english = lang === 'en'
  const [busy, setBusy] = useState(false)
  const [retryingArtifactId, setRetryingArtifactId] = useState<string | null>(null)
  const [recoveringArtifactId, setRecoveringArtifactId] = useState<string | null>(null)
  const [recoveryCandidateId, setRecoveryCandidateId] = useState<string | null>(null)
  const [claimClock, setClaimClock] = useState(() => now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const nextStaleAt = Math.min(...snapshot.reviewArtifacts.flatMap((artifact) => {
      const expiresAt = artifact.type === 'remediation'
        ? artifact.diagnosticClaim?.expiresAt
        : undefined
      return expiresAt !== undefined && expiresAt > claimClock
        ? [expiresAt]
        : []
    }))
    if (!Number.isFinite(nextStaleAt))
      return
    const timer = setTimeout(() => {
      setClaimClock(current => Math.max(current, nextStaleAt, now()))
    }, Math.min(Math.max(0, nextStaleAt - claimClock), 2_147_483_647))
    return () => clearTimeout(timer)
  }, [claimClock, now, snapshot.reviewArtifacts])

  const pack = currentPack

  if (!pack) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        {english ? 'No lessons are available for review.' : '当前没有可复习的课程。'}
      </p>
    )
  }

  const artifacts = snapshot.reviewArtifacts.filter(item => item.conceptId === pack.concept.id)
  const remediationProvenance = createRemediationProvenanceIndex(snapshot)
  const artifactGroups = groupReviewArtifacts(artifacts, {
    learningContractVersionFor: artifact =>
      remediationProvenance.resolve(artifact)?.learningContractVersion ?? null,
  })
  const activeSuppressions = snapshot.removedReviewArtifacts.filter(item =>
    item.conceptId === pack.concept.id && item.suppressionActive)
  const suppressionVersionLabels = new Map(
    activeSuppressions.map((suppression) => {
      if (suppression.type === 'clarification') {
        return [
          suppression.id,
          revisionLabel('clarification', suppression.contentVersion, english),
        ]
      }
      const learningContractVersion = remediationProvenance
        .resolve(suppression)
        ?.learningContractVersion
      return [
        suppression.id,
        revisionLabel('remediation', learningContractVersion ?? null, english),
      ]
    }),
  )
  const activeTrack = snapshot.tracks.find(track => track.id === snapshot.activeTrackId)
  const trackPinnedContentVersion = activeTrack?.contentVersions[pack.concept.id]
  const reviewTemplate = pack.exerciseTemplates.find(
    template => template.purpose === 'review',
  )
  const trackPolicy = activeTrack
    ? deriveTrackPolicyState(snapshot, activeTrack, catalog)
    : null
  const policyAllowsReview = trackPolicy !== null && (
    trackPolicy.frontierConceptId === pack.concept.id
    || trackPolicy.encounteredConceptIds.includes(pack.concept.id)
    || trackPolicy.adjustmentTargetConceptId === pack.concept.id
  )
  let reviewCheckUnavailableReason: string | null = null
  if (!activeTrack) {
    reviewCheckUnavailableReason = english
      ? 'Start a learning path before creating a new review check.'
      : '请先开始一条学习路径，再创建新的复习检查。'
  }
  else if (!activeTrack.conceptIds.includes(pack.concept.id)) {
    reviewCheckUnavailableReason = english
      ? 'This concept is outside the current learning path. Historical checks remain available on this page.'
      : '这个知识点不在当前学习路径中；本页仍会保留历史检查。'
  }
  else if (!policyAllowsReview) {
    reviewCheckUnavailableReason = english
      ? 'This concept is not yet available for review in the current learning path.'
      : '这个知识点尚未进入当前学习阶段。'
  }
  else if (!reviewTemplate) {
    reviewCheckUnavailableReason = english
      ? 'This course revision does not include a review check.'
      : '这个知识点暂时没有复习练习。'
  }
  const canCreateReviewCheck = reviewCheckUnavailableReason === null
  const reviewChecks = snapshot.stream.filter((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance'
    && entry.conceptId === pack.concept.id
    && entry.purpose === 'review')
  const historicalReviewCheckCount = reviewChecks.filter(
    check => check.learningTrackId !== activeTrack?.id,
  ).length
  const requiresTeacherArtifactExposure = artifactGroups.some((group) => {
    const artifact = group.representative
    return artifact.misconceptionTheme !== null || artifact.markdown !== null
  }) || activeSuppressions.some(
    suppression => suppression.misconceptionTheme !== null,
  )

  const createReviewCheck = async () => {
    if (!reviewTemplate || !activeTrack || busy)
      return
    setBusy(true)
    setError(null)
    try {
      if (typeof globalThis.crypto?.randomUUID !== 'function') {
        throw new TypeError(english
          ? 'Secure review-check identity generation is unavailable.'
          : '当前无法安全生成复习检查标识。')
      }
      await classroom.execute({
        type: 'create_review_check',
        learningTrackId: activeTrack.id,
        tutoringStepId: `review-${globalThis.crypto.randomUUID()}`,
        conceptId: pack.concept.id,
        contentVersion: pack.version,
        templateId: reviewTemplate.id,
        personalizationInputs: {},
      })
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      setBusy(false)
    }
  }

  const retryDiagnostic = async (artifactId: string) => {
    if (retryingArtifactId !== null)
      return
    setRetryingArtifactId(artifactId)
    setError(null)
    try {
      await classroom.execute({
        type: 'retry_remediation_diagnostic',
        artifactId,
        explicitLearnerRetry: true,
      })
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      setRetryingArtifactId(null)
    }
  }

  const recoverPotentiallyAbandonedClaim = async (artifactId: string) => {
    if (recoveringArtifactId !== null)
      return
    setRecoveringArtifactId(artifactId)
    setError(null)
    try {
      await classroom.execute({
        type: 'recover_potentially_abandoned_remediation_diagnostic_claim',
        artifactId,
        observedAt: Math.max(claimClock, now()),
        acknowledgePotentialDuplicateProviderCall: true,
      })
      setRecoveryCandidateId(null)
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      setRecoveringArtifactId(null)
    }
  }

  return (
    <section data-testid="review-view" className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <BookOpenCheck aria-hidden="true" className="size-4" />
          {english ? 'Review' : '复习'}
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          {english ? 'Review by concept' : '按概念复习'}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {summaries.map(summary => (
          <button
            key={summary.conceptId}
            type="button"
            aria-pressed={summary.conceptId === pack.concept.id}
            data-review-concept-id={summary.conceptId}
            onClick={() => selectReviewConcept(summary.conceptId)}
            className="min-h-11 min-w-0 rounded-md border border-border px-3 py-2 text-sm leading-5 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground lg:min-h-0 lg:shrink-0"
          >
            {summary.title}
          </button>
        ))}
      </div>

      <article className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{pack.concept.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{pack.concept.summary}</p>
          </div>
          <div className="flex items-center gap-2" />
        </div>
      </article>

      <div className="space-y-3">
        {pack.blocks.map((block) => {
          const exposure = exposureFor(
            snapshot,
            pack.concept.id,
            pack.version,
            block.id,
          )
          const exposureLabel = exposure === 'seen'
            ? (english ? 'Viewed' : '已学习')
            : exposure === 'skipped'
              ? (english ? 'Skipped' : '已跳过')
              : (english ? 'Not viewed' : '未学习')
          return (
            <CoreContent
              key={block.id}
              block={block}
              exposure={exposure}
              exposureLabel={exposureLabel}
            />
          )
        })}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {english ? 'Personal review artifacts' : '个人复习材料'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {english
                ? 'Saved explanations and mistake diagnoses supplement the lesson; they never replace it.'
                : '已保存的讲解与错题诊断只补充课程内容，不会替代它。'}
            </p>
          </div>
          {canCreateReviewCheck && reviewTemplate && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void createReviewCheck()} className="min-h-11 lg:min-h-8">
              {busy
                ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                : <RotateCcw aria-hidden="true" className="size-4" />}
              {english ? 'Create Review Check' : '创建复习检查'}
            </Button>
          )}
        </div>
        {reviewCheckUnavailableReason && (
          <p className="mt-3 text-sm text-muted-foreground">
            {reviewCheckUnavailableReason}
          </p>
        )}
        {canCreateReviewCheck && trackPinnedContentVersion !== pack.version && (
          <p className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {english
              ? `A new review check will use the displayed course revision ${formatRevisionLabel(pack.version)}. Your current path uses revision ${formatRevisionLabel(trackPinnedContentVersion ?? '')}.`
              : '新的复习检查将使用当前展示的课程版本。'}
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <TeacherArtifactExposureGate required={requiresTeacherArtifactExposure}>
          {artifactGroups.length === 0
            ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {english ? 'No retained items for this concept.' : '这个概念还没有保留材料。'}
                </p>
              )
            : (
                <ul className="mt-4 space-y-3">
                  {artifactGroups.map((group) => {
                    const artifact = group.representative
                    const failedAttemptCount = group.artifacts.reduce(
                      (count, item) => count + (item.type === 'remediation' ? item.attemptIds.length : 0),
                      0,
                    )
                    return (
                      <li key={group.key} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {artifactTypeLabel(artifact.type, english)}
                              </p>
                            </div>
                            <p className="mt-1 text-sm font-medium">
                              {artifact.misconceptionTheme
                                ?? (english ? 'Preparing failure diagnosis…' : '正在准备失败诊断…')}
                            </p>
                            <p
                              className="mt-1 font-mono text-xs text-muted-foreground"
                              title={artifact.type === 'clarification'
                                ? (english ? 'Course revision details' : '课程版本详情')
                                : group.learningContractVersion !== null
                                  ? (english ? 'Exercise criteria revision details' : '练习规则版本详情')
                                  : undefined}
                            >
                              {artifact.type === 'clarification'
                                ? revisionLabel('clarification', artifact.contentVersion, english)
                                : revisionLabel('remediation', group.learningContractVersion, english)}
                            </p>
                            {failedAttemptCount > 1 && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {english
                                  ? `${failedAttemptCount} failed attempts share this pattern.`
                                  : `${failedAttemptCount} 次失败尝试属于同一误区模式。`}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={group.artifacts.length > 1
                              ? (english ? 'Remove retained group' : '移除整组保留材料')
                              : (english ? 'Remove retained item' : '移除保留材料')}
                            onClick={() => void classroom.execute({
                              type: 'remove_review_artifact',
                              artifactId: artifact.id,
                            }).catch((reason: unknown) => {
                              setError(reason instanceof Error ? reason.message : String(reason))
                            })}
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                        {artifact.type === 'remediation' && artifact.diagnosticStatus === 'pending'
                          ? (
                              <div className="mt-3 space-y-3">
                                <p role="status" className="text-sm text-muted-foreground">
                                  {english
                                    ? 'This failed attempt is already retained. The diagnostic is still pending and will not be presented as complete.'
                                    : '这次失败已经保留；诊断仍在等待生成，不会被冒充为已完成内容。'}
                                </p>
                                {artifact.diagnosticClaim && (
                                  isRemediationDiagnosticClaimPotentiallyAbandoned(
                                    artifact.diagnosticClaim,
                                    claimClock,
                                  )
                                    ? (
                                        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                                          <p className="text-sm text-muted-foreground">
                                            {english
                                              ? 'This saved diagnostic task may have been interrupted. The app cannot know whether its earlier model request has stopped, so it will not start another automatically.'
                                              : '这项已保存的诊断任务可能已经中断。应用无法确认先前的模型请求是否已停止，因此不会自动再次发起请求。'}
                                          </p>
                                          {recoveryCandidateId === artifact.id
                                            ? (
                                                <div role="alert" className="space-y-2">
                                                  <p className="text-sm text-destructive">
                                                    {english
                                                      ? 'The previous model request may still be running. Recovering can send another request and may cause duplicate charges.'
                                                      : '先前的模型请求可能仍在运行。恢复后会再次发送请求，并可能产生重复计费。'}
                                                  </p>
                                                  <div className="flex flex-wrap gap-2">
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={recoveringArtifactId !== null}
                                                      onClick={() => setRecoveryCandidateId(null)}
                                                    >
                                                      {english ? 'Cancel' : '取消'}
                                                    </Button>
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant="destructive"
                                                      disabled={recoveringArtifactId !== null}
                                                      onClick={() => void recoverPotentiallyAbandonedClaim(artifact.id)}
                                                    >
                                                      {recoveringArtifactId === artifact.id && (
                                                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                                      )}
                                                      {english ? 'Accept risk and recover' : '接受风险并恢复'}
                                                    </Button>
                                                  </div>
                                                </div>
                                              )
                                            : (
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant="outline"
                                                  disabled={recoveringArtifactId !== null}
                                                  onClick={() => setRecoveryCandidateId(artifact.id)}
                                                >
                                                  {english ? 'Review manual recovery' : '查看人工恢复'}
                                                </Button>
                                              )}
                                        </div>
                                      )
                                    : (
                                        <p className="text-xs text-muted-foreground">
                                          {english
                                            ? 'Another browser session is still marked as handling this diagnosis. It will not be replaced automatically.'
                                            : '另一个浏览器会话仍在处理这项诊断，系统不会自动替换它。'}
                                        </p>
                                      )
                                )}
                              </div>
                            )
                          : artifact.type === 'remediation' && artifact.diagnosticStatus === 'failed'
                            ? (
                                <div className="mt-3 space-y-3">
                                  <p role="status" className="text-sm text-destructive">
                                    {artifact.diagnosticFailure === 'context_too_large'
                                      ? (english
                                          ? 'Automated diagnosis was not retained because the complete attempt context is too large to ground safely.'
                                          : '完整尝试上下文过大，无法安全据此生成诊断，因此未保留自动诊断。')
                                      : (english
                                          ? `Automated diagnosis stopped after ${artifact.diagnosticAttempts} failed attempts. No further background calls will run.`
                                          : `自动诊断在 ${artifact.diagnosticAttempts} 次失败后已停止，不会继续发起后台调用。`)}
                                  </p>
                                  {artifact.diagnosticFailure !== 'context_too_large' && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={retryingArtifactId !== null}
                                      onClick={() => void retryDiagnostic(artifact.id)}
                                    >
                                      {retryingArtifactId === artifact.id
                                        ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                        : <RotateCcw aria-hidden="true" className="size-4" />}
                                      {english ? 'Retry diagnostic' : '重试诊断'}
                                    </Button>
                                  )}
                                </div>
                              )
                            : artifact.markdown && (
                              <div className="mt-3"><TeachMarkdown markdown={artifact.markdown} /></div>
                            )}
                      </li>
                    )
                  })}
                </ul>
              )}

          {activeSuppressions.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">
                {english ? 'Dismissed retained topics' : '已停止保留的主题'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {english
                  ? 'These topics stay visible so you can restore them. Restoring a mistake diagnosis starts again from the saved failed attempt; deleted text is never recovered.'
                  : '这些主题会继续显示，方便你恢复。恢复错题诊断后，系统会基于已保存的失败尝试重新诊断，但不会找回已删除的文字。'}
              </p>
              <ul className="mt-3 space-y-2">
                {activeSuppressions.map(suppression => (
                  <li
                    key={suppression.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border p-3"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {artifactTypeLabel(suppression.type, english)}
                      </p>
                      <p className="mt-1 text-sm">
                        {suppression.misconceptionTheme
                          ?? (english
                            ? 'Saved failed attempt'
                            : '已保存的失败尝试')}
                      </p>
                      <p
                        className="mt-1 font-mono text-xs text-muted-foreground"
                        title={suppression.type === 'clarification'
                          ? (english ? 'Course revision details' : '课程版本详情')
                          : (english ? 'Exercise criteria revision details' : '练习规则版本详情')}
                      >
                        {suppressionVersionLabels.get(suppression.id)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void classroom.execute({
                        type: 'allow_review_artifact_retention',
                        artifactId: suppression.id,
                      }).catch((reason: unknown) => {
                        setError(reason instanceof Error ? reason.message : String(reason))
                      })}
                    >
                      <RotateCcw aria-hidden="true" className="size-4" />
                      {english ? 'Allow retention again' : '重新允许保留'}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TeacherArtifactExposureGate>
      </section>

      {reviewChecks.length > 0 && (
        <section className="space-y-3" aria-label={english ? 'Review checks' : '复习检查'}>
          <h2 className="font-semibold">{english ? 'Review checks' : '复习检查'}</h2>
          {historicalReviewCheckCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {english
                ? 'Some checks on this page come from an earlier learning path. New checks are created only in the current path.'
                : '本页部分检查来自较早的学习路径；新检查只会创建在当前路径中。'}
            </p>
          )}
          {reviewChecks.map(instance => (
            <ExerciseInstanceCard key={instance.id} instance={instance} />
          ))}
        </section>
      )}
    </section>
  )
}
