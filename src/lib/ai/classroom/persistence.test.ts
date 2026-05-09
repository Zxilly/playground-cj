import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLASSROOM_DB_NAME,
  clearClassroomSession,
  createClassroomPersistenceQueue,
  loadClassroomSession,
  saveClassroomSession,
} from './persistence'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import { classroomStorageKey } from './store'
import type { ClassroomSession, LessonContentBlock, RunResult } from './types'

const CLASSROOM_STORE_NAME = 'sessions'

const lessonBlock: LessonContentBlock = {
  type: 'heading',
  text: 'Persisted lesson',
  level: 2,
}

const quizBlock: Extract<LessonContentBlock, { type: 'quiz' }> = {
  type: 'quiz',
  conceptId: 'cj.bindings.let',
  prompt: [{ text: 'Print 3.' }],
  starterCode: 'main() {\n    println(0)\n}',
  expectedOutput: '3',
  matchMode: 'exact',
}

const successRun: RunResult = {
  ok: true,
  stdout: '3\n',
  stderr: '',
  exitCode: 0,
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

function openRawDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CLASSROOM_DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CLASSROOM_STORE_NAME))
        request.result.createObjectStore(CLASSROOM_STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function writeRawRecord(record: unknown): Promise<void> {
  const db = await openRawDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CLASSROOM_STORE_NAME, 'readwrite')
      transaction.objectStore(CLASSROOM_STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
  finally {
    db.close()
  }
}

describe('classroom IndexedDB persistence', () => {
  beforeEach(async () => {
    await deleteDatabase(CLASSROOM_DB_NAME)
  })

  it('saves and loads a versioned classroom snapshot by language', async () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [lessonBlock],
      now: 1001,
    })

    await saveClassroomSession(session)

    const loaded = await loadClassroomSession('zh')
    expect(loaded).toMatchObject({
      version: 2,
      lang: 'zh',
      phase: 'teach',
      stream: [
        expect.objectContaining({
          type: 'lesson_blocks',
          blocks: [lessonBlock],
        }),
      ],
    })
    expect(await loadClassroomSession('en')).toBeNull()
  })

  it('rejects v1 session payload as schema-invalid and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeRawRecord({
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1001,
      session: { version: 1, lang: 'zh', phase: 'orient' },
    })

    expect(await loadClassroomSession('zh')).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('persists session content and reloads structurally', async () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1002 })
    await saveClassroomSession(session)

    const loaded = await loadClassroomSession('zh')
    expect(loaded).toMatchObject({
      version: 2,
      currentQuiz: expect.objectContaining({ status: 'active' }),
      eventQueue: [],
    })
  })

  it('preserves queued lesson generation work across reloads', async () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1001 })
    session = classroomReducer(session, { type: 'QUIZ_RUN_FINISHED', result: successRun, now: 1002 })

    await saveClassroomSession(session)

    const loaded = await loadClassroomSession('zh')
    expect(loaded).toMatchObject({
      eventQueue: [
        expect.objectContaining({
          type: 'quiz_success',
          conceptId: 'cj.bindings.let',
        }),
      ],
    })
  })

  it('rejects records with legacy event names', async () => {
    await writeRawRecord({
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1001,
      session: {
        ...createInitialClassroomSession({ lang: 'zh' }),
        eventQueue: [{ type: 'lesson_author_error', summary: 'network', createdAt: 1001 }],
      } as unknown as ClassroomSession,
    })
    expect(await loadClassroomSession('zh')).toBeNull()
  })

  it('clears a classroom snapshot for a language', async () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    await saveClassroomSession(session)

    await clearClassroomSession('zh')

    expect(await loadClassroomSession('zh')).toBeNull()
  })

  it('serializes snapshot writes so older saves cannot overwrite newer saves', async () => {
    const first = createInitialClassroomSession({ lang: 'zh' })
    const second = classroomReducer(first, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [lessonBlock],
      now: 1001,
    })
    let releaseFirst!: () => void
    const calls: string[] = []
    const queue = createClassroomPersistenceQueue(async (session) => {
      calls.push(session.sessionSummary)
      if (calls.length === 1)
        await new Promise<void>((resolve) => { releaseFirst = resolve })
    })

    queue.enqueue(first)
    queue.enqueue(second)
    await Promise.resolve()
    await Promise.resolve()

    expect(calls).toEqual([first.sessionSummary])

    releaseFirst()
    await queue.flush()

    expect(calls).toEqual([first.sessionSummary, second.sessionSummary])
  })
})
