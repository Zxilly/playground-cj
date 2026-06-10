import { beforeEach, describe, expect, it } from 'vitest'
import { useExerciseDraftStore } from './exercise-draft-store'

describe('useExerciseDraftStore', () => {
  beforeEach(() => {
    useExerciseDraftStore.setState({ drafts: {} })
  })

  it('stores a new draft', () => {
    useExerciseDraftStore.getState().setDraft('e1', 'main() { 1 }')
    expect(useExerciseDraftStore.getState().drafts.e1).toMatchObject({ code: 'main() { 1 }' })
  })

  it('updates updatedAt whenever the code actually changes', async () => {
    useExerciseDraftStore.getState().setDraft('e1', 'one')
    const ts1 = useExerciseDraftStore.getState().drafts.e1.updatedAt
    await new Promise(resolve => setTimeout(resolve, 5))
    useExerciseDraftStore.getState().setDraft('e1', 'two')
    const ts2 = useExerciseDraftStore.getState().drafts.e1.updatedAt
    expect(ts2).toBeGreaterThan(ts1)
  })

  it('is a no-op when code is unchanged', () => {
    useExerciseDraftStore.getState().setDraft('e1', 'same')
    const before = useExerciseDraftStore.getState().drafts
    useExerciseDraftStore.getState().setDraft('e1', 'same')
    expect(useExerciseDraftStore.getState().drafts).toBe(before)
  })

  it('reads and clears drafts by exercise id', () => {
    useExerciseDraftStore.getState().setDraft('e1', 'hello')
    expect(useExerciseDraftStore.getState().getDraft('e1')?.code).toBe('hello')
    expect(useExerciseDraftStore.getState().getDraft('missing')).toBeUndefined()

    useExerciseDraftStore.getState().clearDraft('e1')
    expect(useExerciseDraftStore.getState().drafts).not.toHaveProperty('e1')
  })

  it('tracks drafts independently per exercise id', () => {
    useExerciseDraftStore.getState().setDraft('e1', 'a')
    useExerciseDraftStore.getState().setDraft('e2', 'b')
    expect(useExerciseDraftStore.getState().drafts.e1.code).toBe('a')
    expect(useExerciseDraftStore.getState().drafts.e2.code).toBe('b')
  })

  it('clears all drafts when the classroom is reset', () => {
    useExerciseDraftStore.getState().setDraft('e1', 'a')
    useExerciseDraftStore.getState().setDraft('e2', 'b')

    useExerciseDraftStore.getState().clearAll()

    expect(useExerciseDraftStore.getState().drafts).toEqual({})
  })
})
