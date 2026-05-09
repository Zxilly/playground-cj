import type { ClassroomSession } from './types'
import { lessonBlockKey } from '@/features/tour-ai/utils/lesson-block-key'

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
  for (let i = session.stream.length - 1; i >= 0; i--) {
    const item = session.stream[i]
    if (item.type !== 'lesson_blocks')
      continue
    for (let j = item.blocks.length - 1; j >= 0; j--) {
      const block = item.blocks[j]
      if (block.type === 'heading')
        return block.text
    }
  }
  return null
}

export interface ChapterIndexEntry {
  id: string
  text: string
  level: 2 | 3
  streamItemId: string
  blockKey: string
}

export function deriveChapterIndex(session: ClassroomSession): ChapterIndexEntry[] {
  const out: ChapterIndexEntry[] = []
  for (const item of session.stream) {
    if (item.type !== 'lesson_blocks')
      continue
    for (const [blockIndex, block] of item.blocks.entries()) {
      if (block.type !== 'heading')
        continue
      const blockKey = lessonBlockKey(block)
      out.push({
        id: `${item.id}:${blockIndex}:${blockKey}`,
        text: block.text,
        level: block.level ?? 2,
        streamItemId: item.id,
        blockKey,
      })
    }
  }
  return out
}
