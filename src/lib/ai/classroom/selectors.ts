import type { ClassroomSession, ClassroomStreamItem } from './types'

type ClassroomStream = ClassroomSession['stream']

const latestHeadingCache = new WeakMap<ClassroomStream, string | null>()
const chapterIndexCache = new WeakMap<ClassroomStream, ChapterIndexEntry[]>()

export type SessionPendingWork = 'none' | 'lesson_generation' | 'awaiting_user'

export function deriveSessionPendingWork(session: ClassroomSession): SessionPendingWork {
  if (session.eventQueue.length > 0)
    return 'lesson_generation'
  if (session.currentQuiz?.status === 'active')
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

export interface ConceptProgress {
  introduced: string[]
  practicing: string[]
  demonstrated: string[]
}

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

export function deriveConceptProgress(session: ClassroomSession): ConceptProgress {
  const progress: ConceptProgress = {
    introduced: [],
    practicing: [],
    demonstrated: [],
  }

  for (const concept of Object.values(session.learner.concepts)) {
    if (concept.status === 'introduced')
      progress.introduced.push(concept.conceptId)
    else if (concept.status === 'practicing')
      progress.practicing.push(concept.conceptId)
    else if (concept.status === 'demonstrated')
      progress.demonstrated.push(concept.conceptId)
  }

  progress.introduced.sort()
  progress.practicing.sort()
  progress.demonstrated.sort()
  return progress
}

export function deriveLatestHeading(session: ClassroomSession): string | null {
  const cached = latestHeadingCache.get(session.stream)
  if (cached !== undefined)
    return cached

  let heading: string | null = null
  for (let i = session.stream.length - 1; i >= 0; i--) {
    const item = session.stream[i]
    if (item.type !== 'lesson_blocks')
      continue
    for (let j = item.blocks.length - 1; j >= 0; j--) {
      const block = item.blocks[j]
      if (block.type === 'heading') {
        heading = block.text
        latestHeadingCache.set(session.stream, heading)
        return heading
      }
    }
  }
  latestHeadingCache.set(session.stream, heading)
  return heading
}

export interface ChapterIndexEntry {
  id: string
  text: string
  level: 2 | 3
  streamItemId: string
  blockKey: string
}

export function lessonBlockDomId(streamItemId: string, blockIndex: number): string {
  return `${streamItemId}:block:${blockIndex}`
}

export interface LessonOutlineRecentItem {
  id: string
  type: ClassroomStreamItem['type']
  summary: string
  createdAt: number
}

export interface LessonOutline {
  chapters: ChapterIndexEntry[]
  recentItems: LessonOutlineRecentItem[]
  activeQuiz: {
    id: string
    conceptId: string
    status: string
    createdAt: number
  } | null
  conceptProgress: ConceptProgress
}

export function deriveChapterIndex(session: ClassroomSession): ChapterIndexEntry[] {
  const cached = chapterIndexCache.get(session.stream)
  if (cached)
    return cached

  const out: ChapterIndexEntry[] = []
  for (const item of session.stream) {
    if (item.type !== 'lesson_blocks')
      continue
    for (const [blockIndex, block] of item.blocks.entries()) {
      if (block.type !== 'heading')
        continue
      const blockKey = lessonBlockDomId(item.id, blockIndex)
      out.push({
        id: `${item.id}:${blockIndex}:${blockKey}`,
        text: block.text,
        level: block.level ?? 2,
        streamItemId: item.id,
        blockKey,
      })
    }
  }
  chapterIndexCache.set(session.stream, out)
  return out
}

function summarizeStreamItem(item: ClassroomStreamItem): string {
  if (item.type === 'lesson_blocks') {
    const headings = item.blocks
      .filter(block => block.type === 'heading')
      .map(block => block.text)
    return headings.length > 0
      ? `Lesson blocks: ${headings.join(' / ')}`
      : `Lesson blocks: ${item.blocks.length} block(s)`
  }
  if (item.type === 'quiz')
    return `Quiz ${item.quiz.status} for ${item.quiz.conceptId}`
  if (item.type === 'run_result')
    return `Run ${item.result.ok ? 'completed' : 'failed'}, matched: ${item.matched === true}`
  if (item.type === 'progress_update')
    return item.summary
  return item.event.summary ?? item.event.type
}

export function deriveLessonOutline(session: ClassroomSession, limit = 6): LessonOutline {
  const safeLimit = Math.max(1, Math.min(limit, 20))
  return {
    chapters: deriveChapterIndex(session),
    recentItems: session.stream.slice(-safeLimit).map(item => ({
      id: item.id,
      type: item.type,
      summary: summarizeStreamItem(item),
      createdAt: item.createdAt,
    })),
    activeQuiz: session.currentQuiz
      ? {
          id: session.currentQuiz.id,
          conceptId: session.currentQuiz.conceptId,
          status: session.currentQuiz.status,
          createdAt: session.currentQuiz.createdAt,
        }
      : null,
    conceptProgress: deriveConceptProgress(session),
  }
}
