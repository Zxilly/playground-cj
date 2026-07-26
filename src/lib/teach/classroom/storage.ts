import type { DBSchema, IDBPDatabase } from 'idb'
import type { ClassroomSnapshot } from './state'
import { openDB } from 'idb'
import { classroomSnapshotSchema } from './state'

export const AI_CLASSROOM_V8_DATABASE_NAME = 'playground-cj-ai-classroom-v8'
const SNAPSHOT_STORE_NAME = 'classroom-snapshots'

export class ClassroomRevisionConflictError extends Error {
  readonly expectedRevision: number
  readonly actualRevision: number

  constructor(expectedRevision: number, actualRevision: number) {
    super(
      `AI Classroom revision conflict: expected ${expectedRevision}, actual ${actualRevision}`,
    )
    this.name = 'ClassroomRevisionConflictError'
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}

/**
 * Revocable authority checked at the storage mutation boundary. Implementations
 * must call this synchronously immediately before scheduling or performing the
 * durable write, with no intervening await.
 */
export interface ClassroomCommitGuard {
  assertActive: () => void
}

export interface ClassroomStorage {
  /** Returns unknown deliberately: the aggregate owns runtime state validation. */
  load: () => Promise<unknown | null>
  /**
   * Atomically stores `snapshot` only when persisted state still has
   * `expectedRevision`. A successful candidate must advance it by exactly one.
   */
  save: (
    snapshot: ClassroomSnapshot,
    expectedRevision: number,
    commitGuard?: ClassroomCommitGuard,
  ) => Promise<void>
  /** Emits committed revisions written by another adapter/tab when available. */
  subscribe?: (listener: (revision: number) => void) => () => void
  close?: () => Promise<void>
}

function parseCandidate(
  snapshot: ClassroomSnapshot,
  expectedRevision: number,
): ClassroomSnapshot {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('Expected AI Classroom revision must be a non-negative safe integer')
  const parsed = classroomSnapshotSchema.parse(snapshot)
  const requiredRevision = expectedRevision + 1
  if (parsed.revision !== requiredRevision) {
    throw new Error(
      `AI Classroom candidate revision must be ${requiredRevision}, received ${parsed.revision}`,
    )
  }
  return parsed
}

/** In-memory adapter used by tests and non-persistent previews. */
export function createMemoryClassroomStorage(
  initial?: ClassroomSnapshot,
): ClassroomStorage {
  let stored = initial
    ? structuredClone(classroomSnapshotSchema.parse(initial))
    : null
  return {
    load: async () => stored == null ? null : structuredClone(stored),
    save: async (snapshot, expectedRevision, commitGuard) => {
      const candidate = parseCandidate(snapshot, expectedRevision)
      commitGuard?.assertActive()
      const actualRevision = stored?.revision ?? 0
      if (actualRevision !== expectedRevision)
        throw new ClassroomRevisionConflictError(expectedRevision, actualRevision)
      stored = structuredClone(candidate)
    },
  }
}

interface AIClassroomDatabase extends DBSchema {
  [SNAPSHOT_STORE_NAME]: {
    key: string
    value: ClassroomSnapshot
  }
}

export interface IndexedDBClassroomStorageOptions {
  /** Isolates independent classrooms inside the v8 database. */
  scope: string
  /** Primarily useful for isolated tests; production uses the v8 constant. */
  databaseName?: string
}

interface RevisionNotification {
  type: 'revision_committed'
  revision: number
}

function isRevisionNotification(value: unknown): value is RevisionNotification {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<RevisionNotification>
  return candidate.type === 'revision_committed'
    && Number.isSafeInteger(candidate.revision)
    && candidate.revision! >= 0
}

/**
 * Production browser persistence. This intentionally uses a new v8 database
 * and has no legacy database lookup or migration path.
 */
export function createIndexedDBClassroomStorage(
  options: IndexedDBClassroomStorageOptions,
): ClassroomStorage {
  const scope = options.scope.trim()
  if (!scope)
    throw new Error('IndexedDB AI Classroom storage requires a non-empty scope')
  const databaseName = options.databaseName ?? AI_CLASSROOM_V8_DATABASE_NAME
  if (!databaseName.trim())
    throw new Error('IndexedDB AI Classroom storage requires a database name')

  let databasePromise: Promise<IDBPDatabase<AIClassroomDatabase>> | null = null
  let channel: BroadcastChannel | null = null
  let closed = false
  const listeners = new Set<(revision: number) => void>()

  function database(): Promise<IDBPDatabase<AIClassroomDatabase>> {
    if (closed)
      return Promise.reject(new Error('IndexedDB AI Classroom storage is closed'))
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB is unavailable in this environment'))
    databasePromise ??= openDB<AIClassroomDatabase>(databaseName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME))
          db.createObjectStore(SNAPSHOT_STORE_NAME)
      },
    })
    return databasePromise
  }

  function ensureChannel(): BroadcastChannel | null {
    if (closed || typeof BroadcastChannel === 'undefined')
      return null
    if (channel)
      return channel
    channel = new BroadcastChannel(
      `${AI_CLASSROOM_V8_DATABASE_NAME}:${databaseName}:${scope}`,
    )
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isRevisionNotification(event.data))
        return
      for (const listener of listeners)
        listener(event.data.revision)
    }
    return channel
  }

  return {
    load: async () => {
      const db = await database()
      const stored = await db.get(SNAPSHOT_STORE_NAME, scope)
      return stored == null
        ? null
        : classroomSnapshotSchema.parse(stored)
    },
    save: async (snapshot, expectedRevision, commitGuard) => {
      const candidate = parseCandidate(snapshot, expectedRevision)
      const db = await database()
      const transaction = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite')
      const rawStored = await transaction.store.get(scope)
      const stored = rawStored == null
        ? null
        : classroomSnapshotSchema.parse(rawStored)
      const actualRevision = stored?.revision ?? 0
      if (actualRevision !== expectedRevision) {
        transaction.abort()
        await transaction.done.catch(() => undefined)
        throw new ClassroomRevisionConflictError(expectedRevision, actualRevision)
      }
      try {
        // This is the write's cancellation linearization point: if revocation
        // wins, no put is scheduled; once put is scheduled, the commit wins.
        commitGuard?.assertActive()
      }
      catch (error) {
        transaction.abort()
        await transaction.done.catch(() => undefined)
        throw error
      }
      await transaction.store.put(candidate, scope)
      await transaction.done
      ensureChannel()?.postMessage({
        type: 'revision_committed',
        revision: candidate.revision,
      } satisfies RevisionNotification)
    },
    subscribe: (listener) => {
      if (closed)
        throw new Error('IndexedDB AI Classroom storage is closed')
      listeners.add(listener)
      ensureChannel()
      return () => listeners.delete(listener)
    },
    close: async () => {
      if (closed)
        return
      closed = true
      listeners.clear()
      channel?.close()
      channel = null
      if (databasePromise)
        (await databasePromise).close()
    },
  }
}
