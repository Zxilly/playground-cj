import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  AI_CLASSROOM_V8_DATABASE_NAME,
  ClassroomRevisionConflictError,
  createIndexedDBClassroomStorage,
} from './storage'
import { createEmptyClassroom } from './state'

describe('indexedDB classroom storage', () => {
  it('uses the clean v8 database and prevents stale writers from overwriting', async () => {
    expect(AI_CLASSROOM_V8_DATABASE_NAME).toContain('v8')
    const databaseName = `${AI_CLASSROOM_V8_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createIndexedDBClassroomStorage({ databaseName, scope: 'zh' })
    const second = createIndexedDBClassroomStorage({ databaseName, scope: 'zh' })
    const revisionOne = { ...createEmptyClassroom(), revision: 1 }

    await first.save(revisionOne, 0)
    await expect(second.save(revisionOne, 0)).rejects.toEqual(
      new ClassroomRevisionConflictError(0, 1),
    )
    expect(await second.load()).toEqual(revisionOne)

    await Promise.all([first.close?.(), second.close?.()])
  })

  it('notifies a different adapter after a committed write', async () => {
    const databaseName = `${AI_CLASSROOM_V8_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createIndexedDBClassroomStorage({ databaseName, scope: 'en' })
    const second = createIndexedDBClassroomStorage({ databaseName, scope: 'en' })
    const notified = new Promise<void>((resolve) => {
      second.subscribe?.(() => resolve())
    })

    await first.save({ ...createEmptyClassroom(), revision: 1 }, 0)
    await expect(Promise.race([
      notified,
      new Promise((_, reject) => setTimeout(() => reject(new Error('notification timeout')), 1_000)),
    ])).resolves.toBeUndefined()

    await Promise.all([first.close?.(), second.close?.()])
  })
})
