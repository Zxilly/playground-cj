import type { IDBPDatabase } from 'idb'
import type { z } from 'zod'
import type { BlockOutcome, Lesson, LessonDraft, LessonState } from '../lessons/lesson'
import type { RetrievalItem } from '../retrieval/types'
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
import { migrateLegacyBlocks } from '../lessons/blocks'
import { lessonSchema } from '../lessons/lesson'
import { retrievalItemSchema } from '../retrieval/types'
import {
  glossarySchema,
  learningRecordSchema,
  missionSchema,
  notesSchema,
  referenceDocSchema,
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
 * Canonical key for glossary-term identity: trim surrounding whitespace and
 * lowercase. Must stay in sync with the lookup key used by GlossaryProvider so
 * a term has exactly one storage slot regardless of casing/whitespace.
 */
function normalizeTerm(term: string): string {
  return term.trim().toLowerCase()
}

/**
 * Forward-migrate a raw lesson record loaded from storage so legacy lessons
 * (e.g. the old single-question quiz shape) survive the current schema. Applied
 * right after read and before any zod validation. Returns a new object when a
 * lesson carries a `blocks` array; passes anything else through untouched.
 */
function migrateLessonRecord(lesson: unknown): unknown {
  if (
    lesson != null
    && typeof lesson === 'object'
    && Array.isArray((lesson as { blocks?: unknown }).blocks)
  ) {
    return {
      ...(lesson as object),
      blocks: migrateLegacyBlocks((lesson as { blocks: unknown[] }).blocks),
    }
  }
  return lesson
}

/**
 * Keep only the records that satisfy `schema`, logging a single warning per
 * store when any are dropped. Used by `exportAll` to make the export resilient
 * to individually corrupt rows instead of failing the whole snapshot.
 */
function filterValid<T>(records: unknown[], schema: z.ZodType<T>, store: string): T[] {
  const valid: T[] = []
  let dropped = 0
  for (const record of records) {
    const result = schema.safeParse(record)
    if (result.success)
      valid.push(result.data)
    else
      dropped += 1
  }
  if (dropped > 0)
    console.warn(`exportAll: dropped ${dropped} invalid record(s) from "${store}"`)
  return valid
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
export function createIndexedDbWorkspaceRepository(
  dbName: string,
  open: typeof openDB = openDB,
): WorkspaceRepository {
  let dbPromise: Promise<IDBPDatabase> | null = null

  function getDb(): Promise<IDBPDatabase> {
    // Cache the in-flight/resolved open so the database is opened exactly once,
    // but if the open REJECTS, drop the cached promise so a later call can
    // retry. Caching a rejected promise would wedge the repository permanently:
    // every subsequent call would re-await the same failure with no path to
    // recovery. Assigning before attaching `.catch` keeps the open-once,
    // concurrency-safe semantics (concurrent callers share this one promise).
    dbPromise ??= open(dbName, DB_VERSION, { upgrade }).catch((err) => {
      dbPromise = null
      throw err
    })
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
          return false
        const updated: LearningRecord = { ...existing, status: 'superseded', supersededBy }
        await db.put(LEARNING_RECORDS_STORE, updated)
        return true
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
        // Dedupe on a normalized key (trim + lowercase) so the storage
        // uniqueness key matches how GlossaryProvider looks terms up. Without
        // this, "Option" and "option" would coexist as two entries yet only one
        // would ever be found — last write must replace the same concept.
        const key = normalizeTerm(term.term)
        const terms = glossary.terms.filter(t => normalizeTerm(t.term) !== key)
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
      const lessons = (await db.getAll(LESSONS_STORE) as unknown[]).map(migrateLessonRecord) as Lesson[]
      return lessons.sort((a, b) => a.id.localeCompare(b.id))
    },

    async getLesson(id: string) {
      const db = await getDb()
      const lesson = await db.get(LESSONS_STORE, id) as unknown
      return lesson == null ? null : migrateLessonRecord(lesson) as Lesson
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
          return null
        const updated: Lesson = { ...existing, state }
        await db.put(LESSONS_STORE, updated)
        return updated
      })
    },

    recordBlockOutcome(lessonId: string, blockId: string, outcome: BlockOutcome) {
      // Read-modify-write INSIDE the serial queue: two outcome writes for
      // different blocks of the same lesson would otherwise both read the same
      // base state and the later put would clobber the earlier block's progress
      // (the #6/#14 lost-update bug). Serializing the whole cycle makes the
      // merge atomic.
      return enqueue(async () => {
        const db = await getDb()
        const existing = await db.get(LESSONS_STORE, lessonId) as Lesson | undefined
        if (!existing)
          return null
        const status: LessonState['status'] = existing.state.status === 'completed'
          ? 'completed'
          : 'in_progress'
        const updated: Lesson = {
          ...existing,
          state: {
            ...existing.state,
            status,
            blockProgress: { ...existing.state.blockProgress, [blockId]: outcome },
          },
        }
        await db.put(LESSONS_STORE, updated)
        return updated
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

    async listRetrieval(): Promise<RetrievalItem[]> {
      const db = await getDb()
      const items = await db.getAll(RETRIEVAL_STORE) as RetrievalItem[]
      return items.sort((a, b) => a.id.localeCompare(b.id))
    },

    replaceRetrieval(items: RetrievalItem[]) {
      return enqueue(async () => {
        const db = await getDb()
        // Clear + repopulate in ONE transaction so a concurrent read (reads are
        // not enqueued) can never observe an empty schedule mid-replace.
        const tx = db.transaction(RETRIEVAL_STORE, 'readwrite')
        const store = tx.objectStore(RETRIEVAL_STORE)
        void store.clear()
        for (const item of items) void store.put(item)
        await tx.done
      })
    },

    async exportAll(): Promise<WorkspaceSnapshot> {
      const db = await getDb()
      const [mission, glossary, notes, learningRecords, lessons, references, retrieval] = await Promise.all([
        db.get(META_STORE, MISSION_KEY) as Promise<unknown>,
        db.get(META_STORE, GLOSSARY_KEY) as Promise<unknown>,
        db.get(META_STORE, NOTES_KEY) as Promise<unknown>,
        db.getAll(LEARNING_RECORDS_STORE) as Promise<unknown[]>,
        db.getAll(LESSONS_STORE) as Promise<unknown[]>,
        db.getAll(REFERENCES_STORE) as Promise<unknown[]>,
        db.getAll(RETRIEVAL_STORE) as Promise<unknown[]>,
      ])

      // Best-effort export: validate each record with its own item schema and
      // drop the ones that fail, keeping every good record. A single corrupt
      // entry (e.g. from a partially-applied migration or a hand-edited store)
      // must never make the whole export throw and leave the user unable to
      // back up any of their data.
      const missionResult = missionSchema.nullable().safeParse(mission ?? null)
      const glossaryResult = glossarySchema.safeParse(glossary ?? EMPTY_GLOSSARY)
      const notesResult = notesSchema.safeParse(notes ?? EMPTY_NOTES)

      const snapshot: WorkspaceSnapshot = {
        version: WORKSPACE_SNAPSHOT_VERSION,
        mission: missionResult.success ? missionResult.data : null,
        learningRecords: filterValid(learningRecords, learningRecordSchema, LEARNING_RECORDS_STORE)
          .sort((a, b) => a.id.localeCompare(b.id)),
        glossary: glossaryResult.success ? glossaryResult.data : EMPTY_GLOSSARY,
        lessons: filterValid(lessons.map(migrateLessonRecord), lessonSchema, LESSONS_STORE)
          .sort((a, b) => a.id.localeCompare(b.id)),
        references: filterValid(references, referenceDocSchema, REFERENCES_STORE)
          .sort((a, b) => a.id.localeCompare(b.id)),
        notes: notesResult.success ? notesResult.data : EMPTY_NOTES,
        retrieval: filterValid(retrieval, retrievalItemSchema, RETRIEVAL_STORE)
          .sort((a, b) => a.id.localeCompare(b.id)),
      }
      // The filtered snapshot is built from already-validated parts, so this
      // final parse normalizes defaults and is expected to succeed.
      return workspaceSnapshotSchema.parse(snapshot)
    },

    importAll(snapshot: WorkspaceSnapshot) {
      return enqueue(async () => {
        // Validate before touching the database so an invalid snapshot rejects
        // the returned promise and leaves existing data untouched.
        const parsed = workspaceSnapshotSchema.parse(snapshot)
        // Guard the schema version *before* the wipe-and-write below: importing a
        // snapshot from an incompatible (e.g. future) schema would otherwise pass
        // the shape check, clear every store, and silently corrupt or destroy the
        // current workspace. Reject with a clear message instead.
        if (parsed.version !== WORKSPACE_SNAPSHOT_VERSION) {
          throw new Error(
            `不支持的工作区快照版本 ${parsed.version}（当前支持 ${WORKSPACE_SNAPSHOT_VERSION}）。请使用匹配版本的应用导入。`,
          )
        }
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
