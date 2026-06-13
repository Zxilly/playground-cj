'use client'

import { useCallback } from 'react'
import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { BlockOutcome, LessonState } from '@/lib/teach/lessons/lesson'
import type { RetrievalGrade } from '@/lib/teach/retrieval/scheduler'
import { scheduleNext } from '@/lib/teach/retrieval/scheduler'
import type { BlockOutcomeReport } from '../components/blocks/block-props'

/**
 * Persistence boundary the renderer uses to commit block progress. The Phase 9
 * shell wires this to the workspace repository's `updateLessonState`; tests
 * inject a fake. The full lesson state is supplied so the consumer can persist
 * an immutable snapshot.
 */
export type PersistLessonState = (state: LessonState) => void | Promise<void>

/**
 * The subset of {@link RetrievalStore} the outcome wiring needs: read the
 * current schedule and replace it. Mirrors the toolkit's `RetrievalStore` so
 * the same store satisfies both.
 */
export interface RetrievalStoreLike {
  list: () => Promise<RetrievalItem[]>
  save: (items: RetrievalItem[]) => Promise<void>
}

export interface UseBlockOutcomeDeps {
  lessonId: string
  /** The lesson's current persisted state (status + per-block progress). */
  state: LessonState
  /** Commit an updated lesson state. */
  persist: PersistLessonState
  /** Spaced-retrieval schedule store (seeded/updated for quiz/recall blocks). */
  retrievalStore: RetrievalStoreLike
  /** Injected clock; the hook never reads `Date.now()` directly. */
  now: () => number
}

/** Block types that feed the spaced-retrieval schedule. */
type RetrievalKind = RetrievalItem['kind']

function retrievalKindFor(blockType: string): RetrievalKind | null {
  if (blockType === 'quiz')
    return 'quiz'
  if (blockType === 'recall_prompt')
    return 'recall'
  return null
}

/**
 * Derive a retrieval self-grade from an outcome report. Recall blocks carry an
 * explicit `grade`; quiz blocks only report `correct`, which maps to good/again.
 * Returns null when there is nothing gradeable (no correctness signal yet).
 */
function gradeFor(report: BlockOutcomeReport): RetrievalGrade | null {
  if (report.grade)
    return report.grade
  if (report.correct === true)
    return 'good'
  if (report.correct === false)
    return 'again'
  return null
}

/** Merge a new outcome report into the prior {@link BlockOutcome}. */
function nextOutcome(prev: BlockOutcome | undefined, report: BlockOutcomeReport, now: number): BlockOutcome {
  return {
    attempts: (prev?.attempts ?? 0) + 1,
    correct: report.correct ?? prev?.correct,
    lastAnswer: report.lastAnswer,
    completedAt: now,
  }
}

/**
 * A freshly-seeded retrieval item for a block that has never been scheduled.
 * Defaults mirror the scheduler's expectations (1-day interval, 2.5 ease) and
 * are immediately advanced by the first grade via {@link scheduleNext}.
 */
function seedRetrievalItem(lessonId: string, blockId: string, kind: RetrievalKind, now: number): RetrievalItem {
  return {
    id: `${lessonId}:${blockId}`,
    lessonId,
    blockId,
    kind,
    dueAt: now,
    intervalDays: 1,
    ease: 2.5,
    history: [],
  }
}

/**
 * Wire interactive-block outcomes back into the lesson and the spaced-retrieval
 * schedule. The returned handler:
 *  - merges the report into `lesson.state.blockProgress[blockId]` (incrementing
 *    attempts, recording correctness / last answer / completion time) and
 *    promotes the lesson's status to `in_progress`, then persists;
 *  - for `quiz` / `recall_prompt` blocks, seeds (or advances) a retrieval item
 *    in the store via the SM-2-lite scheduler so the item resurfaces for
 *    spaced review across sessions.
 */
export function useBlockOutcome({ lessonId, state, persist, retrievalStore, now }: UseBlockOutcomeDeps) {
  return useCallback(
    async (blockId: string, blockType: string, report: BlockOutcomeReport) => {
      const at = now()

      const nextState: LessonState = {
        ...state,
        status: state.status === 'completed' ? 'completed' : 'in_progress',
        blockProgress: {
          ...state.blockProgress,
          [blockId]: nextOutcome(state.blockProgress[blockId], report, at),
        },
      }
      await persist(nextState)

      const kind = retrievalKindFor(blockType)
      const grade = gradeFor(report)
      if (kind && grade) {
        const items = await retrievalStore.list()
        const existing = items.find(item => item.lessonId === lessonId && item.blockId === blockId)
        const base = existing ?? seedRetrievalItem(lessonId, blockId, kind, at)
        const updated = scheduleNext(base, grade, at)
        const nextItems = existing
          ? items.map(item => (item.id === existing.id ? updated : item))
          : [...items, updated]
        await retrievalStore.save(nextItems)
      }
    },
    [lessonId, state, persist, retrievalStore, now],
  )
}
