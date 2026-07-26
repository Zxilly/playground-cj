'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Loader2, Target, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { MAX_LEARNING_TRACK_CONCEPTS } from '@/lib/teach/classroom/state'

function orderedValidatedConcepts(
  catalog: ReturnType<typeof useWorkspace>['catalog'],
): { conceptIds: string[], unresolvedCount: number } {
  const remaining = catalog.list()
    .filter(item => item.availability === 'validated')
    .map(item => item.conceptId)
  const ordered: string[] = []
  const available = new Set<string>()
  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((conceptId) => {
      const pack = catalog.get(conceptId)
      return pack?.concept.prerequisites.every(id => available.has(id)) ?? false
    })
    if (nextIndex < 0)
      break
    const [conceptId] = remaining.splice(nextIndex, 1)
    ordered.push(conceptId)
    available.add(conceptId)
  }
  return {
    conceptIds: ordered,
    unresolvedCount: remaining.length,
  }
}

function conceptsThroughTarget(
  catalog: ReturnType<typeof useWorkspace>['catalog'],
  orderedConceptIds: string[],
  targetConceptId: string,
): string[] {
  if (!targetConceptId)
    return orderedConceptIds
  const required = new Set<string>()
  const visit = (conceptId: string) => {
    if (required.has(conceptId))
      return
    const pack = catalog.get(conceptId)
    if (!pack || catalog.availability(conceptId) !== 'validated')
      throw new Error(`Learning target ${conceptId} has an unavailable prerequisite`)
    for (const prerequisite of pack.concept.prerequisites)
      visit(prerequisite)
    required.add(conceptId)
  }
  visit(targetConceptId)
  return orderedConceptIds.filter(conceptId => required.has(conceptId))
}

interface TrackSetupProps {
  onCancel?: () => void
  onStarted?: () => void
}

/** Starting a Learning Track is deliberately a learner-only UI action. */
export function TrackSetup({ onCancel, onStarted }: TrackSetupProps = {}) {
  const { classroom, catalog, lang } = useWorkspace()
  const ordered = useMemo(() => orderedValidatedConcepts(catalog), [catalog])
  const orderedConceptIds = ordered.conceptIds
  const unavailableConceptCount = useMemo(
    () => catalog.list().filter(summary =>
      summary.availability === 'read_only').length,
    [catalog],
  )
  const [goal, setGoal] = useState('')
  const [targetConceptId, setTargetConceptId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingStartRef = useRef<{
    payloadKey: string
    trackId: string
  } | null>(null)
  const english = lang === 'en'
  const conceptIds = useMemo(
    () => conceptsThroughTarget(catalog, orderedConceptIds, targetConceptId),
    [catalog, orderedConceptIds, targetConceptId],
  )
  const exceedsTrackCapacity
    = conceptIds.length > MAX_LEARNING_TRACK_CONCEPTS

  const submit = async () => {
    const normalized = goal.trim()
    if (!normalized || submitting || exceedsTrackCapacity)
      return
    setSubmitting(true)
    setError(null)
    try {
      const payloadKey = JSON.stringify([normalized, conceptIds])
      if (pendingStartRef.current?.payloadKey !== payloadKey) {
        if (typeof globalThis.crypto?.randomUUID !== 'function')
          throw new Error('Secure random identifiers are unavailable.')
        pendingStartRef.current = {
          payloadKey,
          trackId: `track:${globalThis.crypto.randomUUID()}`,
        }
      }
      await classroom.execute({
        type: 'start_learning_track',
        trackId: pendingStartRef.current.trackId,
        goal: normalized,
        conceptIds,
        explicitLearnerGoal: true,
      })
      pendingStartRef.current = null
      onStarted?.()
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <section data-testid="track-setup" className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm">
      <span className="mb-4 grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
        <Target aria-hidden="true" className="size-5" />
      </span>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {english ? 'Choose your learning goal' : '先确定你的学习目标'}
        </h1>
        {onCancel && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={english ? 'Cancel new Learning Track' : '取消新学习路径'}
            onClick={onCancel}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {english
          ? 'Your goal starts a stable Learning Track. The teacher may adapt individual steps, but cannot silently replace this path.'
          : '你的目标会启动一条稳定的 Learning Track。老师可以调整局部步骤，但不能悄悄替换整条路径。'}
      </p>
      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="learning-goal" className="block text-sm font-medium">
          {english ? 'What do you want to be able to do?' : '你希望最终能够完成什么？'}
        </label>
        <Input
          id="learning-goal"
          value={goal}
          maxLength={240}
          onChange={event => setGoal(event.target.value)}
          placeholder={english
            ? 'For example: understand Cangjie basics and write small programs independently'
            : '例如：掌握仓颉基础并独立编写小程序'}
          autoComplete="off"
        />
        <label htmlFor="learning-target" className="block text-sm font-medium">
          {english ? 'How far should this track go?' : '这条路径希望学到哪里？'}
        </label>
        <select
          id="learning-target"
          value={targetConceptId}
          onChange={event => setTargetConceptId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">
            {orderedConceptIds.length > MAX_LEARNING_TRACK_CONCEPTS
              ? (english
                  ? 'Select a target (full course exceeds one Track)'
                  : '请选择目标（完整课程超出单条 Track 容量）')
              : (english ? 'Full validated course' : '完整已验证课程')}
          </option>
          {orderedConceptIds.map((conceptId) => {
            const pack = catalog.get(conceptId)
            return (
              <option key={conceptId} value={conceptId}>
                {pack?.concept.title ?? conceptId}
              </option>
            )
          })}
        </select>
        {conceptIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {english
              ? `${conceptIds.length} concept${conceptIds.length === 1 ? '' : 's'}, including required prerequisites.`
              : `共 ${conceptIds.length} 个概念，已包含必要前置概念。`}
          </p>
        )}
        {conceptIds.length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            {english
              ? 'No validated curriculum is available. Mainline tutoring is disabled.'
              : '当前没有通过验证的课程内容，主线教学已停用。'}
          </p>
        )}
        {exceedsTrackCapacity && (
          <p role="alert" className="text-sm text-destructive">
            {english
              ? `This path requires ${conceptIds.length} concepts, but one Learning Track can contain at most ${MAX_LEARNING_TRACK_CONCEPTS}. Select an earlier target; the path will not be silently truncated.`
              : `这条路径需要 ${conceptIds.length} 个概念，但单条 Learning Track 最多容纳 ${MAX_LEARNING_TRACK_CONCEPTS} 个。请选择更早的目标；系统不会静默截断路径。`}
          </p>
        )}
        {(unavailableConceptCount > 0 || ordered.unresolvedCount > 0) && (
          <p role="status" className="text-xs text-muted-foreground">
            {english
              ? `${unavailableConceptCount + ordered.unresolvedCount} concept(s) are excluded because editorial or prerequisite validation is incomplete.`
              : `${unavailableConceptCount + ordered.unresolvedCount} 个概念因编辑审核或前置关系验证未完成而未纳入路径。`}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={
            !goal.trim()
            || conceptIds.length === 0
            || exceedsTrackCapacity
            || submitting
          }
        >
          {submitting
            ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            : <ArrowRight aria-hidden="true" className="size-4" />}
          {english ? 'Start Learning Track' : '启动学习路径'}
        </Button>
      </form>
    </section>
  )
}
