import { describe, expect, it } from 'vitest'
import { ClassroomRevisionConflictError, createMemoryClassroomStorage } from './storage'
import { createEmptyClassroom } from './state'

describe('classroom storage', () => {
  it('compares and advances revisions atomically', async () => {
    const storage = createMemoryClassroomStorage()
    const first = { ...createEmptyClassroom(), revision: 1 }
    await storage.save(first, 0)

    const stale = { ...createEmptyClassroom(), revision: 1 }
    await expect(storage.save(stale, 0)).rejects.toEqual(
      new ClassroomRevisionConflictError(0, 1),
    )
    expect(await storage.load()).toEqual(first)
  })

  it('rejects a non-monotonic candidate revision', async () => {
    const storage = createMemoryClassroomStorage()

    await expect(
      storage.save(createEmptyClassroom(), 0),
    )
      .rejects
      .toThrow(/revision.*1/i)
  })
})
