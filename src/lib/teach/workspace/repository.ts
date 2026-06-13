import type { Lesson, LessonDraft, LessonState } from '../lessons/lesson'
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
  supersedeLearningRecord: (id: string, supersededBy: string) => Promise<void>
  getGlossary: () => Promise<Glossary>
  upsertGlossaryTerm: (term: GlossaryTerm) => Promise<void>
  getNotes: () => Promise<Notes>
  setNotes: (notes: Notes) => Promise<void>
  listLessons: () => Promise<Lesson[]>
  getLesson: (id: string) => Promise<Lesson | null>
  appendLesson: (draft: LessonDraft) => Promise<Lesson>
  updateLessonState: (id: string, state: LessonState) => Promise<void>
  listReferences: () => Promise<ReferenceDoc[]>
  getReference: (id: string) => Promise<ReferenceDoc | null>
  upsertReference: (ref: ReferenceDoc) => Promise<void>
  exportAll: () => Promise<WorkspaceSnapshot>
  importAll: (snapshot: WorkspaceSnapshot) => Promise<void>
}
