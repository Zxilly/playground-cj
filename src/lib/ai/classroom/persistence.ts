import {
  decodePersistedClassroomRecord,
  describePersistedClassroomRecordDiscard,
  encodePersistedClassroomRecord,
  persistedClassroomRecordKey,
  shouldWarnForPersistedClassroomRecordDiscard,
} from './persisted-record'
import type { ClassroomSession } from './types'

export const CLASSROOM_DB_NAME = 'tour-ai-classroom'
const CLASSROOM_STORE_NAME = 'sessions'
const CLASSROOM_DB_VERSION = 1

type SaveClassroomSession = (session: ClassroomSession) => Promise<void>

interface ClassroomPersistenceQueueOptions {
  save?: SaveClassroomSession
  onSaveFailed?: (error: unknown) => void
  onSaveSucceeded?: () => void
}

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

export async function loadClassroomSession(lang: string): Promise<ClassroomSession | null> {
  const db = await openClassroomDatabase()
  if (!db)
    return null

  try {
    const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readonly')
    const store = transaction.objectStore(CLASSROOM_STORE_NAME)
    const raw = await requestResult<unknown>(store.get(persistedClassroomRecordKey(lang)))
    await transactionDone(transaction)

    const decoded = decodePersistedClassroomRecord(raw, lang)
    if (!decoded.ok) {
      if (shouldWarnForPersistedClassroomRecordDiscard(decoded.discard)) {
        console.warn(
          '[AI Classroom] Persisted record discarded',
          describePersistedClassroomRecordDiscard(decoded.discard),
          decoded.discard,
        )
      }
      return null
    }
    return decoded.session
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
    const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(CLASSROOM_STORE_NAME)
    store.put(encodePersistedClassroomRecord(session))
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
    transaction.objectStore(CLASSROOM_STORE_NAME).delete(persistedClassroomRecordKey(lang))
    await transactionDone(transaction)
  }
  finally {
    db.close()
  }
}

const PERSISTENCE_DEBOUNCE_MS = 200

export function createClassroomPersistenceQueue(options: SaveClassroomSession | ClassroomPersistenceQueueOptions = saveClassroomSession) {
  const save = typeof options === 'function' ? options : options.save ?? saveClassroomSession
  const onSaveFailed = typeof options === 'function' ? undefined : options.onSaveFailed
  const onSaveSucceeded = typeof options === 'function' ? undefined : options.onSaveSucceeded
  let tail = Promise.resolve()
  let cancelled = false
  let pendingSession: ClassroomSession | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingResolvers: Array<() => void> = []

  function flushPending() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingSession == null)
      return
    const sessionToWrite = pendingSession
    const resolvers = pendingResolvers
    pendingSession = null
    pendingResolvers = []
    tail = tail
      .catch(() => {})
      .then(() => {
        if (cancelled)
          return
        return save(sessionToWrite).then(() => {
          onSaveSucceeded?.()
        })
      })
      .catch((error) => {
        console.warn('[AI Classroom] Failed to persist session', error)
        onSaveFailed?.(error)
      })
      .finally(() => {
        for (const r of resolvers) r()
      })
  }

  function scheduleWrite() {
    if (timer != null)
      return
    timer = setTimeout(flushPending, PERSISTENCE_DEBOUNCE_MS)
  }

  return {
    enqueue(session: ClassroomSession): Promise<void> {
      pendingSession = session
      return new Promise<void>((resolve) => {
        if (cancelled) {
          resolve()
          return
        }
        pendingResolvers.push(resolve)
        scheduleWrite()
      })
    },
    flush(): Promise<void> {
      flushPending()
      return tail
    },
    cancel() {
      cancelled = true
      if (timer != null) {
        clearTimeout(timer)
        timer = null
      }
      const resolvers = pendingResolvers
      pendingResolvers = []
      pendingSession = null
      for (const r of resolvers) r()
    },
  }
}
