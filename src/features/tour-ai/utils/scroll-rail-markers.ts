import type { ClassroomSession, ClassroomStreamItem } from '@/lib/ai/classroom/types'
import { lessonBlockDomId } from '@/lib/ai/classroom/selectors'

type ClassroomStream = ClassroomSession['stream']
type ClassroomEventQueue = ClassroomSession['eventQueue']

// Derivation is cached by (stream, eventQueue, activeQuizId) so reducer
// dispatches that don't touch any of those (e.g. lastRun updates) skip the
// O(N blocks) re-walk. Both `WeakMap` keys are guaranteed to be the same
// reference unless the reducer produced a new array, which is the right
// invalidation signal.
const cache = new WeakMap<ClassroomStream, Map<string, ScrollRailMarker[]>>()

function cacheKey(eventQueue: ClassroomEventQueue, activeQuizId: string | null): string {
  // Pending-failure attention markers only care about which quizIds appear in
  // failure events, so the queue's length + the failure quizIds + activeQuizId
  // form a tight fingerprint without serializing the whole queue.
  const failureIds = eventQueue
    .filter(e => e.type === 'quiz_failure')
    .map(e => e.quizId)
    .sort()
    .join(',')
  return `${activeQuizId ?? ''}|${failureIds}`
}

export type ScrollRailMarkerKind
  = | 'heading_h2'
    | 'heading_h3'
    | 'quiz'
    | 'progress_success'
    | 'progress_skip'
    | 'failure'
    | 'generation_error'

/** Extra attention flag used by the unread/todo overlay in ClassroomScrollRail. */
export type ScrollRailAttention = 'active_quiz' | 'failure_pending'

export interface ScrollRailMarker {
  id: string
  /** Position in the *visible* (`run_result`-filtered) stream, 0-based. */
  visibleIndex: number
  /** Total count of visible items at the time of derivation. */
  visibleCount: number
  /** `data-chapter-id` selector hook for items that are rendered as blocks. */
  blockKey?: string
  kind: ScrollRailMarkerKind
  label: string
  attention?: ScrollRailAttention
}

/**
 * `ClassroomStream` filters `run_result` items before passing to Virtuoso —
 * mirror that filter so the rail positions line up with what the user sees.
 */
export function visibleStream(session: ClassroomSession): ClassroomStreamItem[] {
  return session.stream.filter(item => item.type !== 'run_result')
}

export function deriveScrollRailMarkers(session: ClassroomSession): ScrollRailMarker[] {
  const activeQuizId = session.currentQuiz?.status === 'active' ? session.currentQuiz.id : null
  const key = cacheKey(session.eventQueue, activeQuizId)

  let perStream = cache.get(session.stream)
  if (!perStream) {
    perStream = new Map()
    cache.set(session.stream, perStream)
  }
  const hit = perStream.get(key)
  if (hit)
    return hit

  const visible = visibleStream(session)
  const total = visible.length
  if (total === 0) {
    perStream.set(key, [])
    return perStream.get(key)!
  }

  // Pending quiz_failure event lookup: events that have no subsequent
  // quiz_success / quiz_skip / QUIZ_SUCCESS for the same quizId are "stuck"
  // — surface them on the rail so the learner can find the unresolved spot.
  const pendingFailureQuizIds = collectPendingFailureQuizIds(session)

  const markers: ScrollRailMarker[] = []
  visible.forEach((item, visibleIndex) => {
    if (item.type === 'lesson_blocks') {
      item.blocks.forEach((block, blockIndex) => {
        if (block.type !== 'heading')
          return
        markers.push({
          id: `${item.id}:${blockIndex}:heading`,
          visibleIndex,
          visibleCount: total,
          blockKey: lessonBlockDomId(item.id, blockIndex),
          kind: block.level === 3 ? 'heading_h3' : 'heading_h2',
          label: block.text,
        })
      })
      return
    }
    if (item.type === 'quiz') {
      const isActive = activeQuizId === item.quiz.id
      const isPending = pendingFailureQuizIds.has(item.quiz.id)
      markers.push({
        id: `${item.id}:quiz`,
        visibleIndex,
        visibleCount: total,
        kind: 'quiz',
        label: `Quiz · ${item.quiz.conceptId}`,
        attention: isActive ? 'active_quiz' : isPending ? 'failure_pending' : undefined,
      })
      return
    }
    if (item.type === 'progress_update') {
      markers.push({
        id: `${item.id}:progress`,
        visibleIndex,
        visibleCount: total,
        kind: item.outcome === 'success' ? 'progress_success' : 'progress_skip',
        label: item.summary || `${item.outcome}: ${item.conceptId}`,
      })
      return
    }
    if (item.type === 'system_event' && item.event.type === 'lesson_generation_error') {
      markers.push({
        id: `${item.id}:error`,
        visibleIndex,
        visibleCount: total,
        kind: 'generation_error',
        label: item.event.summary || 'Generation error',
      })
      return
    }
    if (item.type === 'system_event' && item.event.type === 'quiz_failure') {
      markers.push({
        id: `${item.id}:failure`,
        visibleIndex,
        visibleCount: total,
        kind: 'failure',
        label: item.event.summary || 'Quiz failure',
      })
    }
  })
  perStream.set(key, markers)
  return markers
}

/**
 * Walk the stream to find quizzes that received a failure event with no
 *  subsequent success/skip resolution for the same quizId. These are the ones
 *  worth flagging on the rail as "unfinished business".
 */
function collectPendingFailureQuizIds(session: ClassroomSession): Set<string> {
  const pending = new Set<string>()
  for (const event of session.eventQueue) {
    if (event.type === 'quiz_failure')
      pending.add(event.quizId)
  }
  // A failure on an active quiz that has since transitioned away is no longer
  // "pending" — currentQuiz status tells us the truth.
  const cq = session.currentQuiz
  if (cq && cq.status !== 'active' && pending.has(cq.id))
    pending.delete(cq.id)
  return pending
}
