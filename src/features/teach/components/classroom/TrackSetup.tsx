'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Loader2, Target, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { MAX_LEARNING_TRACK_CONCEPTS } from '@/lib/teach/classroom/state'

const MAX_GOAL_LENGTH = 240

function orderedCourseConcepts(
  catalog: ReturnType<typeof useWorkspace>['catalog'],
): string[] {
  const remaining = catalog.list().map(item => item.conceptId)
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
  return ordered
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
    if (!pack)
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

/** Starting a learning path is deliberately a learner-only UI action. */
export function TrackSetup({ onCancel, onStarted }: TrackSetupProps = {}) {
  const { classroom, catalog, lang } = useWorkspace()
  const orderedConceptIds = useMemo(
    () => orderedCourseConcepts(catalog),
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
          {english ? 'Set your practice goal' : '设置你的练习目标'}
        </h1>
        {onCancel && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={english ? 'Cancel new learning path' : '取消新学习路径'}
            onClick={onCancel}
            className="size-11 lg:size-8"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {english
          ? 'Your goal tailors explanations and practice within the built-in course range you select in this form.'
          : '目标会用于调整讲解与练习，课程范围以你在表单中选择的内置路径为准。'}
      </p>
      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="learning-goal" className="block text-sm font-medium">
            {english ? 'What do you want to be able to do?' : '你希望最终能够完成什么？'}
          </label>
          <span id="learning-goal-count" className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {goal.length}
            /
            {MAX_GOAL_LENGTH}
          </span>
        </div>
        <Input
          id="learning-goal"
          value={goal}
          maxLength={MAX_GOAL_LENGTH}
          aria-describedby="learning-goal-count"
          onChange={event => setGoal(event.target.value)}
          placeholder={english
            ? 'For example: understand Cangjie basics and write small programs independently'
            : '例如：掌握仓颉基础并独立编写小程序'}
          autoComplete="off"
          className="h-11 lg:h-9"
        />
        <label htmlFor="learning-target" className="block text-sm font-medium">
          {english ? 'How far should this built-in path go?' : '这条内置路径学到哪里？'}
        </label>
        <select
          id="learning-target"
          value={targetConceptId}
          onChange={event => setTargetConceptId(event.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:h-9"
        >
          <option value="">
            {orderedConceptIds.length > MAX_LEARNING_TRACK_CONCEPTS
              ? (english
                  ? 'Select an earlier target'
                  : '请选择更早的学习目标')
              : (english ? 'Complete starter course' : '完整入门课程')}
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
              ? `${conceptIds.length} lesson${conceptIds.length === 1 ? '' : 's'}, including prerequisites.`
              : `共 ${conceptIds.length} 课，已按前置关系排好顺序。`}
          </p>
        )}
        {conceptIds.length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            {english
              ? 'The built-in course is unavailable. Rebuild the application to restore it.'
              : '内置课程暂不可用，请重新构建应用。'}
          </p>
        )}
        {exceedsTrackCapacity && (
          <p role="alert" className="text-sm text-destructive">
            {english
              ? `This path requires ${conceptIds.length} lessons, but one path can contain at most ${MAX_LEARNING_TRACK_CONCEPTS}. Select an earlier target.`
              : `这条路径需要 ${conceptIds.length} 课，但单条路径最多容纳 ${MAX_LEARNING_TRACK_CONCEPTS} 课。请选择更早的目标。`}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="min-h-11 lg:min-h-9"
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
          {english ? 'Start learning path' : '开始学习'}
        </Button>
      </form>
    </section>
  )
}
