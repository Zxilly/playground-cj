import type { IDBPDatabase } from 'idb'
import type { Lesson, LessonDraft, LessonState } from '../lessons/lesson'
import type { WorkspaceRepository } from './repository'
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
import { openDB } from 'idb'
import {
  WORKSPACE_SNAPSHOT_VERSION,
  workspaceSnapshotSchema,
} from './documents'

const DB_VERSION = 1

const META_STORE = 'meta'
const LEARNING_RECORDS_STORE = 'learningRecords'
const LESSONS_STORE = 'lessons'
const REFERENCES_STORE = 'references'
const RETRIEVAL_STORE = 'retrieval'

/** Stores keyed by an explicit `id` keyPath. */
const KEYED_STORES = [LEARNING_RECORDS_STORE, LESSONS_STORE, REFERENCES_STORE, RETRIEVAL_STORE] as const

/** Singleton keys living inside the shared `meta` store. */
const MISSION_KEY = 'mission'
const NOTES_KEY = 'notes'
const GLOSSARY_KEY = 'glossary'

const EMPTY_GLOSSARY: Glossary = { terms: [] }
const EMPTY_NOTES: Notes = { body: '' }

/**
 * Zero-pad a 1-based sequence number to a 4-digit id (`0001`, `0002`, ...),
 * matching the teach skill's `learning-records/0001.md` numbering. Falls back to
 * the raw decimal string once it overflows four digits.
 */
function formatSequence(n: number): string {
  return String(n).padStart(4, '0')
}

/**
 * Migration hook. Each schema version owns a branch that brings the database up
 * to that version's store layout. Bump {@link DB_VERSION} and add a branch when
 * the layout evolves.
 */
function upgrade(db: IDBPDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore(META_STORE)
    db.createObjectStore(LEARNING_RECORDS_STORE, { keyPath: 'id' })
    db.createObjectStore(LESSONS_STORE, { keyPath: 'id' })
    db.createObjectStore(REFERENCES_STORE, { keyPath: 'id' })
    db.createObjectStore(RETRIEVAL_STORE, { keyPath: 'id' })
  }
}

/**
 * Browser-backed {@link WorkspaceRepository} on top of IndexedDB (via `idb`).
 *
 * All mutating operations funnel through a single serial promise queue so that
 * sequence-number allocation (`max(id) + 1`) can never race: two concurrent
 * `appendLesson` calls observe distinct maxima and receive distinct ids.
 *
 * `exportAll` / `importAll` move the entire workspace as one
 * {@link WorkspaceSnapshot}; `importAll` validates with `workspaceSnapshotSchema`
 * and clears every store before applying the snapshot (no merge semantics).
 */
export function createIndexedDbWorkspaceRepository(dbName: string): WorkspaceRepository {
  let dbPromise: Promise<IDBPDatabase> | null = null

  function getDb(): Promise<IDBPDatabase> {
    dbPromise ??= openDB(dbName, DB_VERSION, { upgrade })
    return dbPromise
  }

  // Serial write queue: every mutation chains onto the previous one so the
  // max-id scan used for id allocation is never interleaved.
  let writeTail: Promise<unknown> = Promise.resolve()

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = writeTail.then(work, work)
    // Keep the tail alive even if `work` rejects, but don't swallow the result
    // returned to the caller.
    writeTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  // Next id is `max(existing numeric id) + 1`, not `count + 1`: an imported
  // snapshot whose ids skip numbers (e.g. a hand-edited export missing `0002`)
  // would otherwise hand out an id that collides with an existing record.
  async function nextSequence(store: typeof KEYED_STORES[number]): Promise<string> {
    const db = await getDb()
    const keys = await db.getAllKeys(store)
    let max = 0
    for (const key of keys) {
      const n = Number.parseInt(String(key), 10)
      if (Number.isFinite(n) && n > max)
        max = n
    }
    return formatSequence(max + 1)
  }

  return {
    async getMission() {
      const db = await getDb()
      const mission = await db.get(META_STORE, MISSION_KEY)
      return (mission as Mission | undefined) ?? null
    },

    setMission(mission: Mission) {
      return enqueue(async () => {
        const db = await getDb()
        await db.put(META_STORE, mission, MISSION_KEY)
      })
    },

    async listLearningRecords() {
      const db = await getDb()
      const records = await db.getAll(LEARNING_RECORDS_STORE) as LearningRecord[]
      return records.sort((a, b) => a.id.localeCompare(b.id))
    },

    appendLearningRecord(draft: LearningRecordDraft) {
      return enqueue(async () => {
        const db = await getDb()
        const id = await nextSequence(LEARNING_RECORDS_STORE)
        const record: LearningRecord = {
          id,
          title: draft.title,
          body: draft.body,
          ...(draft.evidence === undefined ? {} : { evidence: draft.evidence }),
          status: 'active',
          createdAt: Date.now(),
        }
        await db.put(LEARNING_RECORDS_STORE, record)
        return record
      })
    },

    supersedeLearningRecord(id: string, supersededBy: string) {
      return enqueue(async () => {
        const db = await getDb()
        const existing = await db.get(LEARNING_RECORDS_STORE, id) as LearningRecord | undefined
        if (!existing)
          return
        const updated: LearningRecord = { ...existing, status: 'superseded', supersededBy }
        await db.put(LEARNING_RECORDS_STORE, updated)
      })
    },

    async getGlossary() {
      const db = await getDb()
      const glossary = await db.get(META_STORE, GLOSSARY_KEY) as Glossary | undefined
      return glossary ?? EMPTY_GLOSSARY
    },

    upsertGlossaryTerm(term: GlossaryTerm) {
      return enqueue(async () => {
        const db = await getDb()
        const glossary = (await db.get(META_STORE, GLOSSARY_KEY) as Glossary | undefined) ?? EMPTY_GLOSSARY
        const terms = glossary.terms.filter(t => t.term !== term.term)
        terms.push(term)
        await db.put(META_STORE, { terms } satisfies Glossary, GLOSSARY_KEY)
      })
    },

    async getNotes() {
      const db = await getDb()
      const notes = await db.get(META_STORE, NOTES_KEY) as Notes | undefined
      return notes ?? EMPTY_NOTES
    },

    setNotes(notes: Notes) {
      return enqueue(async () => {
        const db = await getDb()
        await db.put(META_STORE, notes, NOTES_KEY)
      })
    },

    async listLessons() {
      const db = await getDb()
      const lessons = await db.getAll(LESSONS_STORE) as Lesson[]
      return lessons.sort((a, b) => a.id.localeCompare(b.id))
    },

    async getLesson(id: string) {
      const db = await getDb()
      const lesson = await db.get(LESSONS_STORE, id) as Lesson | undefined
      return lesson ?? null
    },

    appendLesson(draft: LessonDraft) {
      return enqueue(async () => {
        const db = await getDb()
        const id = await nextSequence(LESSONS_STORE)
        const lesson: Lesson = {
          ...draft,
          id,
          state: { status: 'unstarted', blockProgress: {} },
          createdAt: Date.now(),
        }
        await db.put(LESSONS_STORE, lesson)
        return lesson
      })
    },

    updateLessonState(id: string, state: LessonState) {
      return enqueue(async () => {
        const db = await getDb()
        const existing = await db.get(LESSONS_STORE, id) as Lesson | undefined
        if (!existing)
          return
        await db.put(LESSONS_STORE, { ...existing, state })
      })
    },

    async listReferences() {
      const db = await getDb()
      const references = await db.getAll(REFERENCES_STORE) as ReferenceDoc[]
      return references.sort((a, b) => a.id.localeCompare(b.id))
    },

    async getReference(id: string) {
      const db = await getDb()
      const reference = await db.get(REFERENCES_STORE, id) as ReferenceDoc | undefined
      return reference ?? null
    },

    upsertReference(ref: ReferenceDoc) {
      return enqueue(async () => {
        const db = await getDb()
        await db.put(REFERENCES_STORE, ref)
      })
    },

    async exportAll(): Promise<WorkspaceSnapshot> {
      const db = await getDb()
      const [mission, glossary, notes, learningRecords, lessons, references, retrieval] = await Promise.all([
        db.get(META_STORE, MISSION_KEY) as Promise<Mission | undefined>,
        db.get(META_STORE, GLOSSARY_KEY) as Promise<Glossary | undefined>,
        db.get(META_STORE, NOTES_KEY) as Promise<Notes | undefined>,
        db.getAll(LEARNING_RECORDS_STORE) as Promise<WorkspaceSnapshot['learningRecords']>,
        db.getAll(LESSONS_STORE) as Promise<WorkspaceSnapshot['lessons']>,
        db.getAll(REFERENCES_STORE) as Promise<WorkspaceSnapshot['references']>,
        db.getAll(RETRIEVAL_STORE) as Promise<WorkspaceSnapshot['retrieval']>,
      ])

      const snapshot: WorkspaceSnapshot = {
        version: WORKSPACE_SNAPSHOT_VERSION,
        mission: mission ?? null,
        learningRecords: [...learningRecords].sort((a, b) => a.id.localeCompare(b.id)),
        glossary: glossary ?? EMPTY_GLOSSARY,
        lessons: [...lessons].sort((a, b) => a.id.localeCompare(b.id)),
        references: [...references].sort((a, b) => a.id.localeCompare(b.id)),
        notes: notes ?? EMPTY_NOTES,
        retrieval: [...retrieval].sort((a, b) => a.id.localeCompare(b.id)),
      }
      return workspaceSnapshotSchema.parse(snapshot)
    },

    importAll(snapshot: WorkspaceSnapshot) {
      return enqueue(async () => {
        // Validate before touching the database so an invalid snapshot rejects
        // the returned promise and leaves existing data untouched.
        const parsed = workspaceSnapshotSchema.parse(snapshot)
        const db = await getDb()

        // Clear and write in a SINGLE transaction. If the clears ran in separate
        // auto-commit transactions before the write transaction, a concurrent
        // read (reads are not enqueued) could land in the gap and observe a
        // fully empty workspace — flashing a blank shell or spuriously
        // re-triggering the mission-first gate right after a successful import.
        const tx = db.transaction([META_STORE, ...KEYED_STORES], 'readwrite')
        const meta = tx.objectStore(META_STORE)
        const records = tx.objectStore(LEARNING_RECORDS_STORE)
        const lessons = tx.objectStore(LESSONS_STORE)
        const references = tx.objectStore(REFERENCES_STORE)
        const retrieval = tx.objectStore(RETRIEVAL_STORE)

        // Import replaces, never merges — clear every store first, same tx.
        void meta.clear()
        void records.clear()
        void lessons.clear()
        void references.clear()
        void retrieval.clear()

        if (parsed.mission)
          void meta.put(parsed.mission, MISSION_KEY)
        void meta.put(parsed.glossary, GLOSSARY_KEY)
        void meta.put(parsed.notes, NOTES_KEY)
        for (const record of parsed.learningRecords) void records.put(record)
        for (const lesson of parsed.lessons) void lessons.put(lesson)
        for (const reference of parsed.references) void references.put(reference)
        for (const item of parsed.retrieval) void retrieval.put(item)

        await tx.done
      })
    },
  }
}
