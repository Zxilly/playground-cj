import { classroomRecordSchema } from './schema'
import { classroomStorageKey } from './store'
import type { ClassroomEvent, ClassroomSession, ClassroomStreamItem } from './types'

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

type LegacyClassroomEvent = ClassroomEvent | { type: 'lesson_author_error', summary: string, createdAt: number }

function normalizeClassroomEvent(event: LegacyClassroomEvent): ClassroomEvent {
  if (event.type === 'lesson_author_error') {
    return {
      type: 'lesson_generation_error',
      summary: event.summary,
      createdAt: event.createdAt,
    }
  }
  return event
}

function normalizeStreamItem(item: ClassroomStreamItem): ClassroomStreamItem {
  if (item.type !== 'system_event')
    return item
  return {
    ...item,
    event: normalizeClassroomEvent(item.event as LegacyClassroomEvent),
  }
}

function normalizeForPersistence(session: ClassroomSession): ClassroomSession {
  const eventQueue = session.eventQueue.map(event => normalizeClassroomEvent(event as LegacyClassroomEvent))
  return {
    ...session,
    eventQueue,
    stream: session.stream.map(normalizeStreamItem),
  }
}

export async function loadClassroomSession(lang: string): Promise<ClassroomSession | null> {
  const db = await openClassroomDatabase()
  if (!db)
    return null

  try {
    const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readonly')
    const store = transaction.objectStore(CLASSROOM_STORE_NAME)
    const raw = await requestResult<unknown>(store.get(classroomStorageKey(lang)))
    await transactionDone(transaction)

    if (raw == null)
      return null

    const result = classroomRecordSchema.safeParse(raw)
    if (!result.success) {
      console.warn('[AI Classroom] Persisted record failed schema validation, discarding', result.error.issues)
      return null
    }
    if (result.data.lang !== lang || result.data.key !== classroomStorageKey(lang))
      return null
    return normalizeForPersistence(result.data.session)
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

const PERSISTENCE_DEBOUNCE_MS = 200

export function createClassroomPersistenceQueue(save: SaveClassroomSession = saveClassroomSession) {
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
        return save(sessionToWrite)
      })
      .catch((error) => {
        console.warn('[AI Classroom] Failed to persist session', error)
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
