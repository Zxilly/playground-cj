import type { ClassroomSession, ClassroomStreamItem } from './types'
import {
  deriveLiveViewChapterIndex,
  latestLiveViewHeading,
  projectClassroomLiveView,
} from './view-projections'
import type { ClassroomChapterIndexEntry, ClassroomLiveViewItem } from './view-projections'
import { deriveConceptProgress } from './concept-progress'
import type { ConceptProgress } from './concept-progress'

export {
  type ConceptProgress,
  type ConceptProgressEntry,
  type ConceptReadiness,
  deriveConceptProgress,
  deriveConceptProgressEntries,
} from './concept-progress'

export { lessonBlockDomId } from './view-projections'

type ClassroomStream = ClassroomSession['stream']

const latestHeadingCache = new WeakMap<ClassroomStream, Map<string, string | null>>()
const chapterIndexCache = new WeakMap<ClassroomStream, Map<string, ClassroomChapterIndexEntry[]>>()

export type SessionPendingWork = 'none' | 'lesson_generation' | 'awaiting_user'

export function deriveSessionPendingWork(session: ClassroomSession): SessionPendingWork {
  if (session.eventQueue.length > 0)
    return 'lesson_generation'
  if (session.currentExercise?.status === 'active')
    return 'awaiting_user'
  return 'none'
}

export interface ClassroomActivity {
  generationRunning: boolean
  runnerRunning: boolean
}

export type ClassroomPendingState
  = | 'idle'
    | 'lesson_generation'
    | 'runner'
    | 'awaiting_user'

export function deriveClassroomPendingState(
  session: ClassroomSession,
  activity: ClassroomActivity,
): ClassroomPendingState {
  if (activity.runnerRunning)
    return 'runner'
  if (activity.generationRunning)
    return 'lesson_generation'
  const work = deriveSessionPendingWork(session)
  if (work === 'lesson_generation')
    return 'lesson_generation'
  if (work === 'awaiting_user')
    return 'awaiting_user'
  return 'idle'
}

export function deriveLatestHeading(session: ClassroomSession): string | null {
  const cached = latestHeadingCache.get(session.stream)?.get(session.lang)
  if (cached !== undefined)
    return cached

  const heading = latestLiveViewHeading(projectClassroomLiveView(session))
  let perLang = latestHeadingCache.get(session.stream)
  if (!perLang) {
    perLang = new Map()
    latestHeadingCache.set(session.stream, perLang)
  }
  perLang.set(session.lang, heading)
  return heading
}

export function deriveActiveConceptId(session: ClassroomSession): string | null {
  const exerciseConceptId = session.currentExercise?.conceptIds[0]
  if (session.currentExercise?.status === 'active' && exerciseConceptId)
    return exerciseConceptId
  if (session.track.targetConceptId)
    return session.track.targetConceptId
  if (exerciseConceptId)
    return exerciseConceptId
  const liveView = projectClassroomLiveView(session)
  for (let i = liveView.items.length - 1; i >= 0; i--) {
    const item = liveView.items[i].source
    if (item.type === 'content_reference_group' || item.type === 'skip_marker' || item.type === 'retention_marker')
      return item.conceptId
    if (item.type === 'bridge_note')
      return item.conceptIds[0] ?? null
    if (item.type === 'exercise_instance')
      return item.exercise.conceptIds[0] ?? null
    if (item.type === 'learning_evidence_marker')
      return item.conceptId
  }
  return null
}

export type ChapterIndexEntry = ClassroomChapterIndexEntry

export interface LessonOutlineRecentItem {
  id: string
  type: ClassroomStreamItem['type']
  summary: string
  createdAt: number
}

export interface LessonOutline {
  chapters: ChapterIndexEntry[]
  recentItems: LessonOutlineRecentItem[]
  activeExercise: {
    id: string
    skillId: string
    conceptIds: string[]
    status: string
    createdAt: number
  } | null
  conceptProgress: ConceptProgress
}

export function deriveChapterIndex(session: ClassroomSession): ChapterIndexEntry[] {
  const cached = chapterIndexCache.get(session.stream)?.get(session.lang)
  if (cached)
    return cached

  const out = deriveLiveViewChapterIndex(projectClassroomLiveView(session))
  let perLang = chapterIndexCache.get(session.stream)
  if (!perLang) {
    perLang = new Map()
    chapterIndexCache.set(session.stream, perLang)
  }
  perLang.set(session.lang, out)
  return out
}

function summarizeLiveViewItem(item: ClassroomLiveViewItem): string {
  if (item.source.type === 'content_reference_group') {
    const title = item.heading
    return title
      ? `Content Reference Group: ${title}`
      : `Content Reference Group: ${item.source.references.length} block(s)`
  }
  const source = item.source
  if (source.type === 'bridge_note')
    return `Bridge Note for ${source.conceptIds.join(', ')}`
  if (source.type === 'skip_marker')
    return `Skipped ${source.blockIds.length} block(s) for ${source.conceptId}`
  if (source.type === 'exercise_instance')
    return `Exercise ${source.exercise.status} for ${source.exercise.skillId}`
  if (source.type === 'run_result')
    return `Run ${source.result.ok ? 'completed' : 'failed'}, matched: ${source.matched === true}`
  if (source.type === 'learning_evidence_marker')
    return source.summary
  if (source.type === 'retention_marker')
    return source.summary
  return source.event.summary ?? source.event.type
}

export function deriveLessonOutline(session: ClassroomSession, limit = 6): LessonOutline {
  const safeLimit = Math.max(1, Math.min(limit, 20))
  const liveView = projectClassroomLiveView(session)
  return {
    chapters: deriveChapterIndex(session),
    recentItems: liveView.items.slice(-safeLimit).map(item => ({
      id: item.id,
      type: item.type,
      summary: summarizeLiveViewItem(item),
      createdAt: item.source.createdAt,
    })),
    activeExercise: session.currentExercise
      ? {
          id: session.currentExercise.id,
          skillId: session.currentExercise.skillId,
          conceptIds: session.currentExercise.conceptIds,
          status: session.currentExercise.status,
          createdAt: session.currentExercise.createdAt,
        }
      : null,
    conceptProgress: deriveConceptProgress(session),
  }
}
