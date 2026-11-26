'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpenCheck, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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

function artifactTypeLabel(type: 'clarification' | 'remediation', i18n: I18n): string {
  if (type === 'clarification')
    return i18n._(msg`讲解笔记`)
  return i18n._(msg`错题诊断`)
}

function revisionLabel(
  type: 'clarification' | 'remediation',
  version: string | null,
  i18n: I18n,
): string {
  if (type === 'clarification') {
    const rev = formatRevisionLabel(version ?? '')
    return i18n._(msg`课程版本 ${rev}`)
  }
  if (version) {
    const rev = formatRevisionLabel(version)
    return i18n._(msg`练习规则版本 ${rev}`)
  }
  return i18n._(msg`暂时无法确认练习规则版本`)
}

function TeacherArtifactExposureGate({
  children,
  required,
}: {
  children: ReactNode
  required: boolean
}) {
  const { classroom } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const [failed, setFailed] = useState(false)
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
      <p role="alert" className="mt-4 text-sm text-error-foreground">
        <Trans>无法显示已保存的复习材料。</Trans>
      </p>
    )
  }
  return (
    <p role="status" className="mt-4 text-sm text-muted-foreground">
      <Trans>正在加载已保存的复习材料…</Trans>
    </p>
  )
}

export function ReviewView() {
  const { i18n, t } = useLingui()
  const { catalog, classroom, now } = useWorkspace()
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
        <Trans>当前没有可复习的课程。</Trans>
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
          revisionLabel('clarification', suppression.contentVersion, i18n),
        ]
      }
      const learningContractVersion = remediationProvenance
        .resolve(suppression)
        ?.learningContractVersion
      return [
        suppression.id,
        revisionLabel('remediation', learningContractVersion ?? null, i18n),
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
    reviewCheckUnavailableReason = t`请先开始一条学习路径，再创建新的复习检查。`
  }
  else if (!activeTrack.conceptIds.includes(pack.concept.id)) {
    reviewCheckUnavailableReason = t`这个知识点不在当前学习路径中；本页仍会保留历史检查。`
  }
  else if (!policyAllowsReview) {
    reviewCheckUnavailableReason = t`这个知识点尚未进入当前学习阶段。`
  }
  else if (!reviewTemplate) {
    reviewCheckUnavailableReason = t`这个知识点暂时没有复习练习。`
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
        throw new TypeError(t`当前无法安全生成复习检查标识。`)
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

  const displayedRev = formatRevisionLabel(pack.version)
  const pathRev = formatRevisionLabel(trackPinnedContentVersion ?? '')

  return (
    <section data-testid="review-view" className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <BookOpenCheck aria-hidden="true" className="size-4" />
          <Trans>复习</Trans>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">
          <Trans>按概念复习</Trans>
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
        <h2 className="text-xl font-semibold">{pack.concept.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{pack.concept.summary}</p>
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
            ? t`已学习`
            : exposure === 'skipped'
              ? t`已跳过`
              : t`未学习`
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
              <Trans>个人复习材料</Trans>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <Trans>已保存的讲解与错题诊断只补充课程内容，不会替代它。</Trans>
            </p>
          </div>
          {canCreateReviewCheck && reviewTemplate && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void createReviewCheck()} className="min-h-11 lg:min-h-8">
              {busy
                ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                : <RotateCcw aria-hidden="true" className="size-4" />}
              <Trans>创建复习检查</Trans>
            </Button>
          )}
        </div>
        {reviewCheckUnavailableReason && (
          <p className="mt-3 text-sm text-muted-foreground">
            {reviewCheckUnavailableReason}
          </p>
        )}
        {canCreateReviewCheck && trackPinnedContentVersion !== pack.version && (
          <details className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              <Trans>新复习检查将使用最新课程版本</Trans>
            </summary>
            <p className="mt-2 font-mono">
              {t`当前展示版本 ${displayedRev} · 学习路径版本 ${pathRev}`}
            </p>
          </details>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-error-foreground">{error}</p>}
        <TeacherArtifactExposureGate required={requiresTeacherArtifactExposure}>
          {artifactGroups.length === 0
            ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  <Trans>这个概念还没有保存的材料。</Trans>
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
                    const artifactVersionLabel = artifact.type === 'clarification'
                      ? revisionLabel('clarification', artifact.contentVersion, i18n)
                      : revisionLabel('remediation', group.learningContractVersion, i18n)
                    return (
                      <li key={group.key} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {artifactTypeLabel(artifact.type, i18n)}
                              </p>
                            </div>
                            <p className="mt-1 text-sm font-medium">
                              {artifact.misconceptionTheme ?? t`正在准备失败诊断…`}
                            </p>
                            {failedAttemptCount > 1 && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t`${failedAttemptCount} 次失败尝试属于同一误区模式。`}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={group.artifacts.length > 1
                              ? t`移除整组保留材料`
                              : t`移除保留材料`}
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
                                  <Trans>这次未通过的作答已保存，错题诊断等待生成。</Trans>
                                </p>
                                {artifact.diagnosticClaim && (
                                  isRemediationDiagnosticClaimPotentiallyAbandoned(
                                    artifact.diagnosticClaim,
                                    claimClock,
                                  )
                                    ? (
                                        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                                          <p className="text-sm text-muted-foreground">
                                            <Trans>这项错题诊断可能已中断。</Trans>
                                          </p>
                                          {recoveryCandidateId === artifact.id
                                            ? (
                                                <div role="alert" className="space-y-2">
                                                  <p className="text-sm text-error-foreground">
                                                    <Trans>先前的模型请求可能仍在运行。恢复后会再次发送请求，并可能产生重复计费。</Trans>
                                                  </p>
                                                  <div className="flex flex-wrap gap-2">
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={recoveringArtifactId !== null}
                                                      onClick={() => setRecoveryCandidateId(null)}
                                                    >
                                                      <Trans>取消</Trans>
                                                    </Button>
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant="destructive"
                                                      disabled={recoveringArtifactId !== null}
                                                      onClick={() => void recoverPotentiallyAbandonedClaim(artifact.id)}
                                                    >
                                                      {recoveringArtifactId === artifact.id && (
                                                        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                                                      )}
                                                      <Trans>接受风险并恢复</Trans>
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
                                                  <Trans>查看恢复选项</Trans>
                                                </Button>
                                              )}
                                        </div>
                                      )
                                    : (
                                        <details className="text-xs text-muted-foreground">
                                          <summary className="cursor-pointer font-medium">
                                            <Trans>技术详情</Trans>
                                          </summary>
                                          <p className="mt-1.5">
                                            <Trans>这项诊断当前由另一个浏览器会话处理，系统不会自动发起新请求。</Trans>
                                          </p>
                                        </details>
                                      )
                                )}
                              </div>
                            )
                          : artifact.type === 'remediation' && artifact.diagnosticStatus === 'failed'
                            ? (
                                <div className="mt-3 space-y-3">
                                  <p role="status" className="text-sm text-error-foreground">
                                    {artifact.diagnosticFailure === 'context_too_large'
                                      ? <Trans>本次作答及相关内容超过自动诊断的处理上限，未保存诊断结果。</Trans>
                                      : (() => {
                                          const failedCount = artifact.diagnosticAttempts
                                          return t`自动诊断在 ${failedCount} 次失败后已停止，不会继续发起后台调用。`
                                        })()}
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
                                        ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                                        : <RotateCcw aria-hidden="true" className="size-4" />}
                                      <Trans>重试诊断</Trans>
                                    </Button>
                                  )}
                                </div>
                              )
                            : artifact.markdown && (
                              <div className="mt-3"><TeachMarkdown markdown={artifact.markdown} /></div>
                            )}
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="cursor-pointer font-medium">
                            <Trans>技术详情</Trans>
                          </summary>
                          <p
                            className="mt-1.5 font-mono"
                            title={artifact.type === 'clarification'
                              ? t`课程版本详情`
                              : group.learningContractVersion !== null
                                ? t`练习规则版本详情`
                                : undefined}
                          >
                            {artifactVersionLabel}
                          </p>
                        </details>
                      </li>
                    )
                  })}
                </ul>
              )}

          {activeSuppressions.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">
                <Trans>已停止保留的主题</Trans>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                <Trans>这些主题会继续显示，方便你恢复。恢复错题诊断后，系统会基于已保存的失败尝试重新诊断，但不会找回已删除的文字。</Trans>
              </p>
              <ul className="mt-3 space-y-2">
                {activeSuppressions.map(suppression => (
                  <li
                    key={suppression.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border p-3"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {artifactTypeLabel(suppression.type, i18n)}
                      </p>
                      <p className="mt-1 text-sm">
                        {suppression.misconceptionTheme ?? t`已保存的失败尝试`}
                      </p>
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium">
                          <Trans>技术详情</Trans>
                        </summary>
                        <p
                          className="mt-1 font-mono"
                          title={suppression.type === 'clarification'
                            ? t`课程版本详情`
                            : t`练习规则版本详情`}
                        >
                          {suppressionVersionLabels.get(suppression.id)}
                        </p>
                      </details>
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
                      <Trans>重新允许保留</Trans>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TeacherArtifactExposureGate>
      </section>

      {reviewChecks.length > 0 && (
        <section className="space-y-3" aria-label={t({ message: '复习检查', context: 'review-section' })}>
          <h2 className="font-semibold"><Trans context="review-section">复习检查</Trans></h2>
          {historicalReviewCheckCount > 0 && (
            <p className="text-sm text-muted-foreground">
              <Trans>本页部分检查来自较早的学习路径；新检查只会创建在当前路径中。</Trans>
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
