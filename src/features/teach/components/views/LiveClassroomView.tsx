'use client'

import { useState } from 'react'
import { ArrowUpRight, BookmarkCheck, MessageCircle, Plus, Route, SkipForward } from 'lucide-react'
import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { useWorkspaceHistoryNavigation } from '@/features/teach/navigation/workspace-history-context'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { TeachMarkdown } from '@/features/teach/components/blocks/TeachMarkdown'
import { ContentReferenceGroup } from '@/features/teach/components/classroom/CoreContent'
import { ExerciseInstanceCard } from '@/features/teach/components/classroom/ExerciseInstanceCard'
import { TrackSetup } from '@/features/teach/components/classroom/TrackSetup'
import type {
  ClassroomStreamEntry,
  LearningTrack,
} from '@/lib/teach/classroom/state'

function skipMarkerExplanation(
  entry: Extract<ClassroomStreamEntry, { type: 'skip_marker' }>,
  track: LearningTrack,
  i18n: I18n,
): string {
  if (entry.basis.type === 'successful_evidence') {
    const count = entry.basis.evidenceIds.length
    return i18n._(msg`当前成功记录已覆盖全部 ${count} 项必需能力。`)
  }
  const adjustmentId = entry.basis.adjustmentId
  const adjustment = track.adjustments.find(
    candidate => candidate.id === adjustmentId,
  )
  if (adjustment?.type === 'accelerate') {
    return i18n._(msg`入门检查已通过，学习路径已明确跳到这个知识点之后。`)
  }
  if (adjustment?.type === 'delay') {
    return i18n._(msg`当前受阻知识点已延后，路径转到下一个可学习内容。`)
  }
  return i18n._(msg`当前无法读取跳过本步骤的依据。`)
}

export function LiveClassroomView() {
  const { i18n, t } = useLingui()
  const { catalog, classroom } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const setPendingPrefill = useWorkspaceStore(state => state.setPendingPrefill)
  const openReviewConcept = useWorkspaceStore(state => state.openReviewConcept)
  const navigate = useWorkspaceHistoryNavigation()
  const track = snapshot.tracks.find(item => item.id === snapshot.activeTrackId)
  const [creatingTrack, setCreatingTrack] = useState(false)
  const [activatingTrack, setActivatingTrack] = useState(false)
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  const [trackSelectionError, setTrackSelectionError] = useState<string | null>(null)

  if (!track)
    return <TrackSetup />

  if (creatingTrack) {
    return (
      <TrackSetup
        onCancel={() => setCreatingTrack(false)}
        onStarted={() => setCreatingTrack(false)}
      />
    )
  }

  const stream = snapshot.stream.filter(entry => entry.learningTrackId === track.id)
  const lessonCount = track.conceptIds.length
  const trackGoal = track.goal

  return (
    <section data-testid="live-classroom-view" className="space-y-6">
      <header className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Route aria-hidden="true" className="size-4" />
          <Trans>学习路径</Trans>
        </div>
        <div className="mt-2 grid gap-3">
          <div className="min-w-0">
            <h1
              id="active-learning-goal"
              className={cn(
                'break-words text-xl font-semibold',
                expandedGoalId !== track.id && 'line-clamp-3',
              )}
            >
              {track.goal}
            </h1>
            {track.goal.length > 96 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-controls="active-learning-goal"
                aria-expanded={expandedGoalId === track.id}
                onClick={() => setExpandedGoalId(current => current === track.id ? null : track.id)}
                className="mt-1 min-h-11 px-0 text-xs text-muted-foreground hover:bg-transparent"
              >
                {expandedGoalId === track.id
                  ? <Trans>收起完整目标</Trans>
                  : <Trans>查看完整目标</Trans>}
              </Button>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {t`${lessonCount} 课 · 按学习顺序排列`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {snapshot.tracks.length > 1 && (
              <label className="grid min-w-0 flex-[1_1_16rem] gap-1 text-xs font-medium text-muted-foreground">
                <span><Trans>当前学习路径</Trans></span>
                <select
                  data-testid="active-learning-track"
                  aria-label={t`当前学习路径`}
                  aria-describedby="active-learning-track-description"
                  title={track.goal}
                  value={track.id}
                  disabled={activatingTrack}
                  className="h-11 min-w-0 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground lg:h-8"
                  onChange={(event) => {
                    const trackId = event.target.value
                    setActivatingTrack(true)
                    setTrackSelectionError(null)
                    void classroom.execute({
                      type: 'activate_learning_track',
                      trackId,
                      explicitLearnerChoice: true,
                    }).catch((reason: unknown) => {
                      setTrackSelectionError(
                        reason instanceof Error ? reason.message : String(reason),
                      )
                    }).finally(() => {
                      setActivatingTrack(false)
                      requestAnimationFrame(() => {
                        if (document.activeElement !== document.body)
                          return
                        document.querySelector<HTMLSelectElement>(
                          '[data-testid="active-learning-track"]',
                        )?.focus()
                      })
                    })
                  }}
                >
                  {snapshot.tracks.map((candidate, index) => (
                    <option key={candidate.id} value={candidate.id}>
                      {index + 1}
                      .
                      {' '}
                      {candidate.goal}
                    </option>
                  ))}
                </select>
                <span id="active-learning-track-description" className="sr-only">
                  {t`当前选中的学习目标：${trackGoal}`}
                </span>
              </label>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreatingTrack(true)}
              className="min-h-11 lg:min-h-8"
            >
              <Plus aria-hidden="true" className="size-4" />
              <Trans>开始新的学习目标</Trans>
            </Button>
          </div>
        </div>
        {trackSelectionError && (
          <p role="alert" className="mt-3 text-sm text-error-foreground">
            {trackSelectionError}
          </p>
        )}
      </header>

      {stream.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <h2 className="text-lg font-semibold">
            <Trans>学习路径已准备好</Trans>
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            <Trans>先把第一课请求放入老师对话，确认内容后再发送。</Trans>
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-foreground">
            <Trans>查看老师讲解后，这个工作区内后续的作答会作为有指导练习，而不会计为独立测验。</Trans>
          </p>
          <Button
            type="button"
            className="mt-4 min-h-11 lg:min-h-9"
            onClick={() => setPendingPrefill(
              t`请开始当前学习路径的第一课。`,
              { type: 'first_lesson', learningTrackId: track.id },
            )}
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            <Trans>准备第一课请求</Trans>
          </Button>
        </div>
      )}

      {stream.length > 0 && (
        <h2 className="text-lg font-semibold">
          <Trans context="live-classroom">课堂活动</Trans>
        </h2>
      )}

      <ol aria-label={t`课堂活动流`} className="space-y-5">
        {stream.map((entry, index) => {
          const pack = catalog.require(entry.conceptId)
          const entryPack = 'contentVersion' in entry
            ? catalog.require(entry.conceptId, entry.contentVersion)
            : pack
          return (
            <li key={entry.id} className="relative">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {index + 1}
                {' · '}
                {entryPack.concept.title}
              </p>
              {entry.type === 'content_reference_group' && (
                <ContentReferenceGroup
                  pack={entryPack}
                  blockIds={entry.blockIds}
                />
              )}
              {entry.type === 'exercise_instance' && <ExerciseInstanceCard instance={entry} />}
              {entry.type === 'bridge_note' && (
                <article className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Trans>课程衔接说明</Trans>
                  </p>
                  <TeachMarkdown markdown={entry.markdown} />
                </article>
              )}
              {entry.type === 'skip_marker' && (
                <article className="flex gap-3 rounded-lg border border-dashed border-border p-4 text-sm">
                  <SkipForward aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      <Trans>本步骤跳过了部分课程内容</Trans>
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {skipMarkerExplanation(entry, track, i18n)}
                    </p>
                  </div>
                </article>
              )}
              {entry.type === 'retention_marker' && (
                <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                  <div className="flex min-w-0 items-start gap-3">
                    <BookmarkCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p>
                      {entry.artifactType === 'clarification'
                        ? <Trans>一条讲解笔记已保存到复习页。</Trans>
                        : <Trans>一条错题诊断已保存到复习页。</Trans>}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`retention-marker-open-${entry.conceptId}`}
                    onClick={() => {
                      navigate('review')
                      openReviewConcept(entry.conceptId)
                    }}
                    className="min-h-11 shrink-0 lg:min-h-8"
                  >
                    <Trans>前往复习页查看</Trans>
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </Button>
                </article>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
