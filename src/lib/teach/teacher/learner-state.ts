import type { RetrievalItem } from '../retrieval/types'
import type { LearningRecord, Mission } from '../workspace/documents'
import type { WorkspaceRepository } from '../workspace/repository'
import { dueItems } from '../retrieval/scheduler'

/**
 * How many of the most-recent active learning records feed the ZPD signal.
 * Kept small so the teacher reasons over current understanding, not the whole
 * history (older context lives in the full records view).
 */
const RECENT_LEARNING_RECORDS = 8

/**
 * The aggregated learner signal the teacher reads (via `read_learner_state`) to
 * pick the next lesson that sits inside the learner's zone of proximal
 * development. It folds the durable workspace documents plus the spaced
 * retrieval schedule into one snapshot:
 *
 * - `mission` — the current mission (or `null` before the intake interview).
 * - `completedLessonIds` — ids of lessons the learner has finished.
 * - `recentLearningRecords` — the most recent *active* records, newest first.
 * - `knownGlossaryTerms` — terms the learner has genuinely mastered.
 * - `dueRetrieval` — retrieval items at or past their due time, for review.
 */
export interface LearnerState {
  mission: Mission | null
  completedLessonIds: string[]
  recentLearningRecords: LearningRecord[]
  knownGlossaryTerms: string[]
  dueRetrieval: RetrievalItem[]
}

/**
 * Aggregate the durable workspace state plus the spaced-retrieval schedule into
 * a {@link LearnerState}. Pure with respect to time: `now` is injected so the
 * function never reads the clock itself (`dueRetrieval` is derived from it).
 *
 * @param repo The workspace repository to read documents from.
 * @param retrieval The full spaced-retrieval schedule (filtered to due items).
 * @param now Current epoch milliseconds, supplied by the caller.
 */
export async function readLearnerState(
  repo: WorkspaceRepository,
  retrieval: RetrievalItem[],
  now: number,
): Promise<LearnerState> {
  const [mission, lessons, learningRecords, glossary] = await Promise.all([
    repo.getMission(),
    repo.listLessons(),
    repo.listLearningRecords(),
    repo.getGlossary(),
  ])

  const completedLessonIds = lessons
    .filter(lesson => lesson.state.status === 'completed')
    .map(lesson => lesson.id)

  const recentLearningRecords = learningRecords
    .filter(record => record.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_LEARNING_RECORDS)

  const knownGlossaryTerms = glossary.terms.map(term => term.term)

  const dueRetrieval = dueItems(retrieval, now)

  return {
    mission,
    completedLessonIds,
    recentLearningRecords,
    knownGlossaryTerms,
    dueRetrieval,
  }
}
