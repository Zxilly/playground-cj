import type { ClassroomSession, ClassroomStreamItem } from '@/lib/ai/classroom/types'
import { projectClassroomLiveViewSurface, visibleClassroomStream } from '@/lib/ai/classroom/view-projections'
import type { ClassroomLiveViewSurface } from '@/lib/ai/classroom/view-projections'

type ClassroomStream = ClassroomSession['stream']
type ClassroomEventQueue = ClassroomSession['eventQueue']

const cache = new WeakMap<ClassroomStream, Map<string, ScrollRailMarker[]>>()

function cacheKey(eventQueue: ClassroomEventQueue, activeExerciseId: string | null): string {
  const failureIds = eventQueue
    .filter(e => e.type === 'exercise_failure')
    .map(e => e.exerciseInstanceId)
    .sort()
    .join(',')
  return `${activeExerciseId ?? ''}|${failureIds}`
}

export type ScrollRailMarkerKind
  = | 'heading_h2'
    | 'heading_h3'
    | 'exercise'
    | 'progress_success'
    | 'progress_skip'
    | 'failure'
    | 'generation_error'
    | 'retained'

export type ScrollRailAttention = 'active_exercise' | 'failure_pending'

export interface ScrollRailMarker {
  id: string
  visibleIndex: number
  visibleCount: number
  blockKey?: string
  kind: ScrollRailMarkerKind
  label: string
  attention?: ScrollRailAttention
}

export function visibleStream(session: ClassroomSession): ClassroomStreamItem[] {
  return visibleClassroomStream(session)
}

type LearningEvidenceMarker = Extract<ClassroomStreamItem, { type: 'learning_evidence_marker' }>

function progressMarkerKind(outcome: LearningEvidenceMarker['outcome']): ScrollRailMarkerKind {
  if (outcome === 'success')
    return 'progress_success'
  if (outcome === 'failure')
    return 'failure'
  return 'progress_skip'
}

function learningEvidenceRailLabel(item: LearningEvidenceMarker, lang: 'en' | 'zh'): string {
  const isReviewCheck = item.exerciseIntent === 'review_check'

  if (lang === 'en') {
    if (isReviewCheck) {
      if (item.outcome === 'success' && item.strength === 'mastery')
        return 'Review check passed; mastery evidence recorded'
      if (item.outcome === 'success')
        return 'Review check recorded'
      if (item.outcome === 'skip')
        return 'Skipped review check recorded'
      if (item.outcome === 'failure')
        return 'Review check attempt did not pass'
      return 'Review check attempt recorded'
    }

    if (item.outcome === 'success')
      return 'Completed practice recorded'
    if (item.outcome === 'skip')
      return 'Skipped exercise recorded'
    if (item.outcome === 'failure')
      return 'Exercise attempt did not pass'
    return 'Learning record updated'
  }

  if (isReviewCheck) {
    if (item.outcome === 'success' && item.strength === 'mastery')
      return '复习检查通过，已记录掌握证据'
    if (item.outcome === 'success')
      return '复习检查完成已记录'
    if (item.outcome === 'skip')
      return '已记录跳过复习检查'
    if (item.outcome === 'failure')
      return '复习检查尝试未通过'
    return '复习检查尝试已记录'
  }

  if (item.outcome === 'success')
    return '练习完成已记录'
  if (item.outcome === 'skip')
    return '已记录跳过练习'
  if (item.outcome === 'failure')
    return '练习尝试未通过'
  return '学习记录已更新'
}

export function deriveScrollRailMarkers(session: ClassroomSession): ScrollRailMarker[] {
  return deriveScrollRailMarkersForSurface(session, projectClassroomLiveViewSurface(session))
}

export function deriveScrollRailMarkersForSurface(
  session: ClassroomSession,
  surface: ClassroomLiveViewSurface,
): ScrollRailMarker[] {
  const activeExerciseId = session.currentExercise?.status === 'active' ? session.currentExercise.id : null
  const key = `${session.lang}|${cacheKey(session.eventQueue, activeExerciseId)}`

  let perStream = cache.get(session.stream)
  if (!perStream) {
    perStream = new Map()
    cache.set(session.stream, perStream)
  }
  const hit = perStream.get(key)
  if (hit)
    return hit

  const visible = surface.visibleItems
  const lang = session.lang === 'en' ? 'en' : 'zh'
  const total = visible.length
  if (total === 0) {
    perStream.set(key, [])
    return perStream.get(key)!
  }

  const pendingFailureExerciseIds = collectPendingFailureExerciseIds(session)

  const markers: ScrollRailMarker[] = []
  visible.forEach((viewItem, visibleIndex) => {
    const item = viewItem.source
    if (item.type === 'content_reference_group') {
      viewItem.resolvedBlocks.forEach((block) => {
        if (block.content.type !== 'heading')
          return
        markers.push({
          id: `${item.id}:${block.blockIndex}:heading`,
          visibleIndex,
          visibleCount: total,
          blockKey: block.blockKey,
          kind: block.content.level === 3 ? 'heading_h3' : 'heading_h2',
          label: block.content.text,
        })
      })
      return
    }
    if (item.type === 'exercise_instance') {
      const isActive = activeExerciseId === item.exercise.id
      const isPending = pendingFailureExerciseIds.has(item.exercise.id)
      const isReviewCheck = item.exercise.intent === 'review_check'
      markers.push({
        id: `${item.id}:exercise`,
        visibleIndex,
        visibleCount: total,
        kind: 'exercise',
        label: lang === 'en' ? isReviewCheck ? 'Review check' : 'Exercise' : isReviewCheck ? '复习检查' : '练习',
        attention: isActive ? 'active_exercise' : isPending ? 'failure_pending' : undefined,
      })
      return
    }
    if (item.type === 'learning_evidence_marker') {
      markers.push({
        id: `${item.id}:progress`,
        visibleIndex,
        visibleCount: total,
        kind: progressMarkerKind(item.outcome),
        label: learningEvidenceRailLabel(item, lang),
      })
      return
    }
    if (item.type === 'retention_marker') {
      markers.push({
        id: `${item.id}:retention`,
        visibleIndex,
        visibleCount: total,
        kind: 'retained',
        label: lang === 'en' ? 'Saved review note' : '已保存复习内容',
      })
      return
    }
    if (item.type === 'system_event' && item.event.type === 'lesson_generation_error') {
      markers.push({
        id: `${item.id}:error`,
        visibleIndex,
        visibleCount: total,
        kind: 'generation_error',
        label: lang === 'en' ? 'Failed to prepare the next step' : '准备下一步失败',
      })
      return
    }
    if (item.type === 'system_event' && item.event.type === 'exercise_failure') {
      const isReviewCheck = item.event.exerciseIntent === 'review_check'
      markers.push({
        id: `${item.id}:failure`,
        visibleIndex,
        visibleCount: total,
        kind: 'failure',
        label: lang === 'en' ? isReviewCheck ? 'Review check needs attention' : 'Exercise needs review' : isReviewCheck ? '复习检查需要再看' : '练习需要再检查',
      })
    }
  })
  perStream.set(key, markers)
  return markers
}

function collectPendingFailureExerciseIds(session: ClassroomSession): Set<string> {
  const pending = new Set<string>()
  for (const event of session.eventQueue) {
    if (event.type === 'exercise_failure')
      pending.add(event.exerciseInstanceId)
  }
  const currentExercise = session.currentExercise
  if (currentExercise && currentExercise.status !== 'active' && pending.has(currentExercise.id))
    pending.delete(currentExercise.id)
  return pending
}
