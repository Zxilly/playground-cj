import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  CLASSROOM_DB_NAME,
  clearClassroomSession,
  createClassroomPersistenceQueue,
  loadClassroomSession,
  saveClassroomSession,
} from './persistence'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import type { ClassroomSession, LessonContentBlock, RunResult } from './types'

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

describe('classroom IndexedDB persistence', () => {
  beforeEach(async () => {
    await deleteDatabase(CLASSROOM_DB_NAME)
  })

  it('saves and loads a versioned classroom snapshot by language', async () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [lessonBlock],
      now: 1001,
    })

    await saveClassroomSession(session)

    const loaded = await loadClassroomSession('zh')
    expect(loaded).toMatchObject({
      version: 1,
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

  it('rejects incompatible snapshots instead of hydrating stale state', async () => {
    const session = createInitialClassroomSession({ lang: 'zh', now: 1000 })

    await saveClassroomSession({ ...session, version: 2 } as unknown as ClassroomSession)

    expect(await loadClassroomSession('zh')).toBeNull()
  })

  it('does not persist transient in-flight author or runner pending state', async () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, { type: 'LESSON_AUTHOR_STARTED', now: 1001 })

    await saveClassroomSession(session)

    expect(await loadClassroomSession('zh')).toMatchObject({
      pendingAction: 'none',
      stream: [],
      eventQueue: [],
    })

    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1002 })
    session = classroomReducer(session, { type: 'RUN_STARTED', now: 1003 })

    await saveClassroomSession(session)

    expect(await loadClassroomSession('zh')).toMatchObject({
      pendingAction: 'user',
      currentQuiz: expect.objectContaining({ status: 'active' }),
    })
  })

  it('preserves queued LessonAuthor work across reloads', async () => {
    let session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    session = classroomReducer(session, { type: 'SET_CURRENT_QUIZ', quiz: quizBlock, now: 1001 })
    session = classroomReducer(session, { type: 'QUIZ_RUN_FINISHED', result: successRun, now: 1002 })

    await saveClassroomSession(session)

    expect(await loadClassroomSession('zh')).toMatchObject({
      pendingAction: 'lesson_author',
      eventQueue: [
        expect.objectContaining({
          type: 'quiz_success',
          conceptId: 'cj.bindings.let',
        }),
      ],
    })
  })

  it('clears a classroom snapshot for a language', async () => {
    const session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
    await saveClassroomSession(session)

    await clearClassroomSession('zh')

    expect(await loadClassroomSession('zh')).toBeNull()
  })

  it('serializes snapshot writes so older saves cannot overwrite newer saves', async () => {
    const first = createInitialClassroomSession({ lang: 'zh', now: 1000 })
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
