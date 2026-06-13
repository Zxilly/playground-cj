'use client'

import { useCallback } from 'react'
import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { BlockOutcome, Lesson, LessonState } from '@/lib/teach/lessons/lesson'
import type { RetrievalGrade } from '@/lib/teach/retrieval/scheduler'
import { scheduleNext } from '@/lib/teach/retrieval/scheduler'
import type { BlockOutcomeReport } from '../components/blocks/block-props'

/**
 * Atomically merge a single block's {@link BlockOutcome} into the lesson's
 * persisted progress and return the updated lesson (or `null` if the lesson no
 * longer exists). The shell binds this to `repo.recordBlockOutcome(lessonId, …)`;
 * tests inject a fake.
 *
 * Unlike the previous "read snapshot → spread → updateLessonState whole-replace"
 * flow, this commits inside the repository's serial write queue as a
 * read-modify-write keyed by `blockId`, so answering a second interactive block
 * can never clobber an earlier block's progress (the #6/#14 lost-update bug),
 * regardless of whether the caller's in-memory snapshot is stale.
 */
export type RecordBlockOutcome = (blockId: string, outcome: BlockOutcome) => Promise<Lesson | null>

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
  /**
   * The lesson's current persisted state. Only read to merge the prior outcome
   * of the *same* block (attempt count / last correctness); cross-block merging
   * happens atomically inside {@link record}, so a stale snapshot here cannot
   * drop another block's progress.
   */
  state: LessonState
  /** Atomically commit one block's outcome (see {@link RecordBlockOutcome}). */
  record: RecordBlockOutcome
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
 *    promotes the lesson's status to `in_progress` via an atomic
 *    {@link RecordBlockOutcome} so a concurrent block write cannot lose this
 *    one's progress;
 *  - for `quiz` / `recall_prompt` blocks, seeds (or advances) a retrieval item
 *    in the store via the SM-2-lite scheduler so the item resurfaces for
 *    spaced review across sessions — but only once the lesson still exists
 *    (the atomic record returns `null` for a removed lesson).
 */
export function useBlockOutcome({ lessonId, state, record, retrievalStore, now }: UseBlockOutcomeDeps) {
  return useCallback(
    async (blockId: string, blockType: string, report: BlockOutcomeReport) => {
      const at = now()

      const outcome = nextOutcome(state.blockProgress[blockId], report, at)
      const updatedLesson = await record(blockId, outcome)
      // The lesson was removed out from under us (e.g. a re-author replaced it);
      // there is nothing to schedule a review against.
      if (!updatedLesson)
        return

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
    [lessonId, state, record, retrievalStore, now],
  )
}
