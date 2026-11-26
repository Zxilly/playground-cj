import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
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

  it('preserves previous Course scopes on upgrade and supports listing, replacing, and explicit deletion', async () => {
    const databaseName = `${AI_CLASSROOM_V8_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const legacy = createIndexedDBClassroomStorage({
      databaseName,
      scope: 'classroom',
    })
    const oldCourse = createIndexedDBClassroomStorage({
      databaseName,
      scope: 'classroom:course:sha256:old',
    })
    const unrelated = createIndexedDBClassroomStorage({
      databaseName,
      scope: 'classroom-preview',
    })
    const revisionOne = { ...createEmptyClassroom(), revision: 1 }
    await Promise.all([
      legacy.save(revisionOne, 0),
      oldCourse.save(revisionOne, 0),
      unrelated.save(revisionOne, 0),
    ])

    const current = createIndexedDBClassroomStorage({
      databaseName,
      scope: 'classroom:course:sha256:current',
    })
    // Opening a new Course scope must never silently wipe older scopes.
    await expect(current.load()).resolves.toBeNull()
    await expect(legacy.load()).resolves.toEqual(revisionOne)
    await expect(oldCourse.load()).resolves.toEqual(revisionOne)
    await expect(unrelated.load()).resolves.toEqual(revisionOne)

    const listed = await current.listScopes?.('classroom')
    expect(listed?.map(item => item.scope).sort()).toEqual([
      'classroom',
      'classroom:course:sha256:old',
    ])

    // Explicit replace bumps revision monotonically and notifies listeners.
    const notified = vi.fn()
    current.subscribe?.(notified)
    const replaced = await current.replace?.(createEmptyClassroom())
    expect(replaced?.revision).toBe(1)
    expect(notified).toHaveBeenCalledWith(1)

    // Explicit deleteScope removes only the requested scope.
    await current.deleteScope?.('classroom:course:sha256:old')
    await expect(oldCourse.load()).resolves.toBeNull()
    await expect(legacy.load()).resolves.toEqual(revisionOne)

    await Promise.all([
      legacy.close?.(),
      oldCourse.close?.(),
      unrelated.close?.(),
      current.close?.(),
    ])
  })
})
