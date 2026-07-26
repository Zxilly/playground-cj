'use client'

import { useState } from 'react'
import { BookmarkCheck, MessageCircle, Plus, Route, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
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
  english: boolean,
): string {
  if (entry.basis.type === 'successful_evidence') {
    return english
      ? `Current successful observable Evidence covers all ${entry.basis.evidenceIds.length} required Learning Skills.`
      : `当前成功的可观察 Evidence 已覆盖全部 ${entry.basis.evidenceIds.length} 项必需 Learning Skill。`
  }
  const adjustmentId = entry.basis.adjustmentId
  const adjustment = track.adjustments.find(
    candidate => candidate.id === adjustmentId,
  )
  if (adjustment?.type === 'accelerate') {
    return english
      ? 'A verified successful Placement Check explicitly accelerated the Track beyond this Concept.'
      : '已验证成功的 Placement Check 明确将学习路径加速到此 Concept 之后。'
  }
  if (adjustment?.type === 'delay') {
    return english
      ? 'A blocked frontier was explicitly delayed to the next eligible Concept.'
      : '受阻的 frontier 已被明确延后，并转到下一个符合条件的 Concept。'
  }
  return english
    ? 'The verified Skip Marker basis is unavailable.'
    : '已验证的 Skip Marker 依据当前不可用。'
}

export function LiveClassroomView() {
  const { catalog, classroom, lang } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const setPendingPrefill = useWorkspaceStore(state => state.setPendingPrefill)
  const track = snapshot.tracks.find(item => item.id === snapshot.activeTrackId)
  const english = lang === 'en'
  const [creatingTrack, setCreatingTrack] = useState(false)
  const [activatingTrack, setActivatingTrack] = useState(false)
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

  return (
    <section data-testid="live-classroom-view" className="space-y-6">
      <header className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Route aria-hidden="true" className="size-4" />
          Learning Track
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{track.goal}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {english
                ? `${track.conceptIds.length} validated concepts · chronological Classroom Stream`
                : `${track.conceptIds.length} 个已验证概念 · 按时间排列的 Classroom Stream`}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {snapshot.tracks.length > 1 && (
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                <span>{english ? 'Active Learning Track' : '当前学习路径'}</span>
                <select
                  aria-label={english ? 'Active Learning Track' : '当前学习路径'}
                  value={track.id}
                  disabled={activatingTrack}
                  className="h-8 max-w-64 rounded-md border border-input bg-background px-2 text-sm text-foreground"
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
                    }).finally(() => setActivatingTrack(false))
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
              </label>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => setCreatingTrack(true)}>
              <Plus aria-hidden="true" className="size-4" />
              {english ? 'Start a new learning goal' : '开始新的学习目标'}
            </Button>
          </div>
        </div>
        {trackSelectionError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {trackSelectionError}
          </p>
        )}
      </header>

      {stream.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <h2 className="text-lg font-semibold">
            {english ? 'Your Learning Track is ready' : '学习路径已准备好'}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {english
              ? 'Ask the teacher to choose the first validated Core Content references and an Exercise Template.'
              : '请老师从已验证的 Core Content 与 Exercise Template 中选择第一步。'}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => setPendingPrefill(
              english
                ? 'Please start the first tutoring step for my active Learning Track.'
                : '请为我开始当前 Learning Track 的第一个教学步骤。',
            )}
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            {english ? 'Ask teacher to begin' : '请老师开始'}
          </Button>
        </div>
      )}

      <ol aria-label="Classroom Stream" className="space-y-5">
        {stream.map((entry, index) => {
          const pack = catalog.get(entry.conceptId)
          const entryPack = 'contentVersion' in entry
            ? catalog.getVersion(entry.conceptId, entry.contentVersion)
            : pack
          return (
            <li key={entry.id} className="relative">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {index + 1}
                {' · '}
                {entryPack?.concept.title ?? pack?.concept.title ?? entry.conceptId}
              </p>
              {entry.type === 'content_reference_group' && (
                !entryPack || entryPack.id !== entry.packId
                  ? (
                      <HistoricalContentUnavailable
                        contentVersion={entry.contentVersion}
                        english={english}
                      />
                    )
                  : (
                      <ContentReferenceGroup
                        pack={entryPack}
                        blockIds={entry.blockIds}
                      />
                    )
              )}
              {entry.type === 'exercise_instance' && <ExerciseInstanceCard instance={entry} />}
              {entry.type === 'bridge_note' && (
                <article className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    Bridge Note
                  </p>
                  <TeachMarkdown markdown={entry.markdown} />
                </article>
              )}
              {entry.type === 'skip_marker' && (
                <article className="flex gap-3 rounded-lg border border-dashed border-border p-4 text-sm">
                  <SkipForward aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {english ? 'Core Content skipped for this step' : '本步骤跳过了部分 Core Content'}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {skipMarkerExplanation(entry, track, english)}
                    </p>
                  </div>
                </article>
              )}
              {entry.type === 'retention_marker' && (
                <article className="flex gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                  <BookmarkCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    {english
                      ? `A ${entry.artifactType} was retained in Review View.`
                      : `一条${entry.artifactType === 'clarification' ? '澄清' : '补救说明'}已保留到 Review View。`}
                  </p>
                </article>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function HistoricalContentUnavailable({
  contentVersion,
  english,
}: {
  contentVersion: string
  english: boolean
}) {
  return (
    <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      {english
        ? `This Live View references Content Version ${contentVersion}, which is not in the local catalog. It was not silently replaced with newer content.`
        : `这条 Live View 引用了本地目录中不存在的 Content Version ${contentVersion}，系统没有用新版内容静默替换它。`}
    </div>
  )
}
