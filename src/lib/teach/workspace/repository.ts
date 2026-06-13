import type { BlockOutcome, Lesson, LessonDraft, LessonState } from '../lessons/lesson'
import type { RetrievalItem } from '../retrieval/types'
import type {
  Glossary,
  GlossaryTerm,
  LearningRecord,
  LearningRecordDraft,
  Mission,
  Notes,
  ReferenceDoc,
  WorkspaceSnapshot,
} from './documents'

/**
 * Abstract persistence boundary for a single teaching workspace.
 *
 * A workspace owns one mission, an append-only log of learning records, a
 * glossary, an ordered set of lessons, reference documents, free-form notes,
 * and the spaced-retrieval schedule. Implementations persist these in the
 * browser (see {@link createIndexedDbWorkspaceRepository}) and expose the whole
 * thing as a portable snapshot via {@link WorkspaceRepository.exportAll} /
 * {@link WorkspaceRepository.importAll}.
 *
 * Every method is async; callers must never assume synchronous reads.
 */
export interface WorkspaceRepository {
  getMission: () => Promise<Mission | null>
  setMission: (mission: Mission) => Promise<void>
  listLearningRecords: () => Promise<LearningRecord[]>
  appendLearningRecord: (draft: LearningRecordDraft) => Promise<LearningRecord>
  /**
   * Mark a learning record as superseded by another. Returns `true` if a record
   * with `id` existed and was updated, `false` if there was nothing to change
   * (so observers can skip a no-op refresh).
   */
  supersedeLearningRecord: (id: string, supersededBy: string) => Promise<boolean>
  getGlossary: () => Promise<Glossary>
  upsertGlossaryTerm: (term: GlossaryTerm) => Promise<void>
  getNotes: () => Promise<Notes>
  setNotes: (notes: Notes) => Promise<void>
  listLessons: () => Promise<Lesson[]>
  getLesson: (id: string) => Promise<Lesson | null>
  appendLesson: (draft: LessonDraft) => Promise<Lesson>
  /**
   * Replace a lesson's whole state. Returns the updated lesson, or `null` if no
   * lesson with `id` exists (so observers can skip a no-op refresh).
   */
  updateLessonState: (id: string, state: LessonState) => Promise<Lesson | null>
  /**
   * Atomically merge a single block's outcome into a lesson's progress.
   *
   * Runs inside the serial write queue as a read-modify-write so concurrent
   * outcome writes for different blocks never lose each other's update (the
   * lost-update hazard a naive `updateLessonState` round-trip would create).
   * Promotes `unstarted` lessons to `in_progress`; leaves `completed` lessons
   * at `completed`. Returns the updated lesson, or `null` if it does not exist.
   */
  recordBlockOutcome: (lessonId: string, blockId: string, outcome: BlockOutcome) => Promise<Lesson | null>
  listReferences: () => Promise<ReferenceDoc[]>
  getReference: (id: string) => Promise<ReferenceDoc | null>
  upsertReference: (ref: ReferenceDoc) => Promise<void>
  /** All persisted spaced-retrieval items. */
  listRetrieval: () => Promise<RetrievalItem[]>
  /**
   * Replace the entire retrieval schedule. Clears the retrieval store and
   * writes `items` in a single transaction so a concurrent read never observes
   * an empty schedule mid-replace.
   */
  replaceRetrieval: (items: RetrievalItem[]) => Promise<void>
  exportAll: () => Promise<WorkspaceSnapshot>
  importAll: (snapshot: WorkspaceSnapshot) => Promise<void>
}
