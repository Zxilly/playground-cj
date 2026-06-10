import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLASSROOM_DB_NAME,
  clearClassroomSession,
  createClassroomPersistenceQueue,
  loadClassroomSession,
  saveClassroomSession,
} from './persistence'
import { persistedClassroomRecordKey } from './persisted-record'
import { classroomReducer, createInitialClassroomSession } from './reducer'

const CLASSROOM_STORE_NAME = 'sessions'

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

  it('saves and loads a v3 classroom snapshot by language', async () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1001,
    })

    await saveClassroomSession(session)

    const loaded = await loadClassroomSession('zh')
    expect(loaded).toMatchObject({
      version: 3,
      lang: 'zh',
      phase: 'teach',
      stream: [
        expect.objectContaining({
          type: 'content_reference_group',
          conceptId: 'cj.io.println',
        }),
      ],
    })
    expect(await loadClassroomSession('en')).toBeNull()
  })

  it('rejects legacy v2 snapshots instead of migrating them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeRawRecord({
      key: persistedClassroomRecordKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1003,
      session: {
        version: 2,
        lang: 'zh',
        phase: 'practice',
        stream: [],
        learner: { concepts: {}, evidence: [], learningNotes: '' },
        currentQuiz: null,
        lastRun: null,
        sessionSummary: '',
        eventQueue: [],
      },
    })

    expect(await loadClassroomSession('zh')).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      '[AI Classroom] Persisted record discarded',
      expect.stringContaining('Unsupported classroom session version 2'),
      { reason: 'unsupported_session_version', version: 2 },
    )
    warn.mockRestore()
  })

  it('preserves queued exercise events across reloads', async () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print Cangjie.',
        starterCode: '',
        expectedOutput: 'Cangjie',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1002,
    })

    await saveClassroomSession(session)

    expect(await loadClassroomSession('zh')).toMatchObject({
      lastRun: {
        attemptMode: 'submit',
      },
      stream: expect.arrayContaining([
        expect.objectContaining({
          type: 'run_result',
          result: expect.objectContaining({
            attemptMode: 'submit',
          }),
        }),
      ]),
      eventQueue: [
        expect.objectContaining({
          type: 'exercise_success',
          skillId: 'cj.io.println.print-value',
        }),
      ],
    })
  })

  it('clears a classroom snapshot for a language', async () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    await saveClassroomSession(session)

    await clearClassroomSession('zh')

    expect(await loadClassroomSession('zh')).toBeNull()
  })
})

describe('createClassroomPersistenceQueue', () => {
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

  it('flushes immediately and cancel resolves pending writes without saving', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const queue = createClassroomPersistenceQueue(save)
    const session = createInitialClassroomSession({ lang: 'zh' })

    void queue.enqueue(session)
    await queue.flush()
    expect(save).toHaveBeenCalledWith(session)

    const cancelled = createClassroomPersistenceQueue(save)
    const pending = cancelled.enqueue(session)
    cancelled.cancel()
    await vi.advanceTimersByTimeAsync(500)
    await expect(pending).resolves.toBeUndefined()
  })

  it('reports save failures and later save recovery without rejecting callers', async () => {
    const onSaveFailed = vi.fn()
    const onSaveSucceeded = vi.fn()
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('idb full'))
      .mockResolvedValueOnce(undefined)
    const queue = createClassroomPersistenceQueue({ save, onSaveFailed, onSaveSucceeded })
    const session = createInitialClassroomSession({ lang: 'zh' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const failedWrite = queue.enqueue(session)
    await vi.advanceTimersByTimeAsync(200)
    await expect(failedWrite).resolves.toBeUndefined()

    expect(onSaveFailed).toHaveBeenCalledWith(expect.any(Error))
    expect(onSaveSucceeded).not.toHaveBeenCalled()

    const recoveredWrite = queue.enqueue({ ...session, sessionSummary: 'retry' })
    await vi.advanceTimersByTimeAsync(200)
    await expect(recoveredWrite).resolves.toBeUndefined()

    expect(onSaveSucceeded).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
