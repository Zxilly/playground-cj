import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('migrates legacy v2 snapshots before validating', async () => {
    const legacyQuiz = {
      conceptId: 'cj.bindings.let',
      prompt: [{ text: 'Print 3.' }],
      starterCode: '',
      expectedOutput: '3',
      matchMode: 'exact',
      status: 'active',
      createdAt: 1001,
    }

    await writeRawRecord({
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1003,
      session: {
        version: 2,
        lang: 'zh',
        phase: 'practice',
        stream: [{
          id: 'quiz:1001:0',
          type: 'quiz',
          quiz: legacyQuiz,
          createdAt: 1001,
        }],
        learner: { concepts: {}, evidence: [], learningNotes: '' },
        currentQuiz: legacyQuiz,
        lastRun: null,
        sessionSummary: '',
        eventQueue: [{
          type: 'chat_intent',
          intent: 'legacy_custom_intent',
          summary: 'legacy',
          createdAt: 1002,
        }],
      },
    })

    const loaded = await loadClassroomSession('zh')

    expect(loaded).toMatchObject({
      currentQuiz: { id: 'quiz:1001:0' },
      eventQueue: [{ type: 'chat_intent', intent: 'change_topic' }],
      stream: [
        expect.objectContaining({
          type: 'quiz',
          quiz: expect.objectContaining({ id: 'quiz:1001:0' }),
        }),
      ],
    })
  })

  it('preserves queued lesson generation work across reloads', async () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1001 })
    session = classroomReducer(session, { type: 'QUIZ_SUBMIT_FINISHED', result: successRun, now: 1002 })

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

    void queue.enqueue(first)
    const firstFlushed = queue.flush()
    await Promise.resolve()
    await Promise.resolve()

    expect(calls).toEqual([first.sessionSummary])

    void queue.enqueue(second)
    const secondFlushed = queue.flush()

    releaseFirst()
    await firstFlushed
    await secondFlushed

    expect(calls).toEqual([first.sessionSummary, second.sessionSummary])
  })
})

describe('createClassroomPersistenceQueue (debounce)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces multiple enqueues within 200ms into a single save with the latest session', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createClassroomPersistenceQueue(save)
    const s1 = createInitialClassroomSession({ lang: 'zh' })
    const s2 = { ...s1, sessionSummary: 'second' }
    const s3 = { ...s1, sessionSummary: 'third' }
    void queue.enqueue(s1)
    vi.advanceTimersByTime(50)
    void queue.enqueue(s2)
    vi.advanceTimersByTime(50)
    void queue.enqueue(s3)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(s3)
  })

  it('flush() triggers immediate save bypassing the timer', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createClassroomPersistenceQueue(save)
    const s = createInitialClassroomSession({ lang: 'zh' })
    void queue.enqueue(s)
    expect(save).not.toHaveBeenCalled()
    await queue.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('cancel() prevents save and resolves pending promises', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createClassroomPersistenceQueue(save)
    const s = createInitialClassroomSession({ lang: 'zh' })
    const p = queue.enqueue(s)
    queue.cancel()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).not.toHaveBeenCalled()
    await expect(p).resolves.toBeUndefined()
  })

  it('save error does not deadlock the tail; subsequent enqueue still works', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined)
    const queue = createClassroomPersistenceQueue(save)
    const s = createInitialClassroomSession({ lang: 'zh' })
    void queue.enqueue(s)
    await vi.advanceTimersByTimeAsync(200)
    expect(save).toHaveBeenCalledTimes(1)
    void queue.enqueue({ ...s, sessionSummary: 'after-error' })
    await vi.advanceTimersByTimeAsync(200)
    expect(save).toHaveBeenCalledTimes(2)
  })
})
