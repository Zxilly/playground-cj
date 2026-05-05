import { classroomStorageKey } from './store'
import type { ClassroomSession, PendingAction } from './types'

export const CLASSROOM_DB_NAME = 'tour-ai-classroom'
const CLASSROOM_STORE_NAME = 'sessions'
const CLASSROOM_DB_VERSION = 1

interface ClassroomSnapshotRecord {
  key: string
  version: 1
  lang: string
  updatedAt: number
  session: ClassroomSession
}

type SaveClassroomSession = (session: ClassroomSession) => Promise<void>

let writeTail = Promise.resolve()

function idb(): IDBFactory | null {
  return typeof indexedDB === 'undefined' ? null : indexedDB
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openClassroomDatabase(): Promise<IDBDatabase | null> {
  const factory = idb()
  if (!factory)
    return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    const request = factory.open(CLASSROOM_DB_NAME, CLASSROOM_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CLASSROOM_STORE_NAME))
        db.createObjectStore(CLASSROOM_STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function stablePendingAction(session: ClassroomSession): PendingAction {
  if (session.eventQueue.length > 0)
    return 'lesson_author'
  if (session.currentQuiz?.status === 'active')
    return 'user'
  return 'none'
}

function normalizeForPersistence(session: ClassroomSession): ClassroomSession {
  return {
    ...session,
    pendingAction: stablePendingAction(session),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isClassroomSession(value: unknown, lang: string): value is ClassroomSession {
  if (!isObject(value))
    return false
  return value.version === 1
    && value.lang === lang
    && typeof value.phase === 'string'
    && typeof value.pendingAction === 'string'
    && Array.isArray(value.stream)
    && isObject(value.learner)
    && typeof value.sessionSummary === 'string'
    && Array.isArray(value.eventQueue)
}

function isClassroomRecord(value: unknown, lang: string): value is ClassroomSnapshotRecord {
  if (!isObject(value))
    return false
  return value.version === 1
    && value.lang === lang
    && value.key === classroomStorageKey(lang)
    && isClassroomSession(value.session, lang)
}

export async function loadClassroomSession(lang: string): Promise<ClassroomSession | null> {
  const db = await openClassroomDatabase()
  if (!db)
    return null

  try {
    const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readonly')
    const store = transaction.objectStore(CLASSROOM_STORE_NAME)
    const record = await requestResult<unknown>(store.get(classroomStorageKey(lang)))
    await transactionDone(transaction)
    if (!isClassroomRecord(record, lang))
      return null
    return normalizeForPersistence(record.session)
  }
  finally {
    db.close()
  }
}

async function writeClassroomSession(session: ClassroomSession): Promise<void> {
  const db = await openClassroomDatabase()
  if (!db)
    return

  try {
    const stableSession = normalizeForPersistence(session)
    const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(CLASSROOM_STORE_NAME)
    store.put({
      key: classroomStorageKey(stableSession.lang),
      version: 1,
      lang: stableSession.lang,
      updatedAt: Date.now(),
      session: stableSession,
    } satisfies ClassroomSnapshotRecord)
    await transactionDone(transaction)
  }
  finally {
    db.close()
  }
}

export function saveClassroomSession(session: ClassroomSession): Promise<void> {
  writeTail = writeTail
    .catch(() => {})
    .then(() => writeClassroomSession(session))
  return writeTail
}

export async function clearClassroomSession(lang: string): Promise<void> {
  await writeTail.catch(() => {})
  const db = await openClassroomDatabase()
  if (!db)
    return

  try {
    const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readwrite')
    transaction.objectStore(CLASSROOM_STORE_NAME).delete(classroomStorageKey(lang))
    await transactionDone(transaction)
  }
  finally {
    db.close()
  }
}

export function createClassroomPersistenceQueue(save: SaveClassroomSession = saveClassroomSession) {
  let tail = Promise.resolve()
  let cancelled = false

  return {
    enqueue(session: ClassroomSession) {
      tail = tail
        .catch(() => {})
        .then(() => {
          if (cancelled)
            return
          return save(session)
        })
        .catch((error) => {
          console.warn('[AI Classroom] Failed to persist session', error)
        })
      return tail
    },
    flush() {
      return tail
    },
    cancel() {
      cancelled = true
    },
  }
}
