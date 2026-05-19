import { beforeEach, describe, expect, it } from 'vitest'
import { useQuizDraftStore } from './quiz-draft-store'

describe('useQuizDraftStore', () => {
  beforeEach(() => {
    useQuizDraftStore.setState({ drafts: {} })
  })

  it('stores a new draft', () => {
    useQuizDraftStore.getState().setDraft('q1', 'main() { 1 }')
    expect(useQuizDraftStore.getState().drafts.q1).toMatchObject({ code: 'main() { 1 }' })
  })

  it('updates updatedAt whenever the code actually changes', async () => {
    useQuizDraftStore.getState().setDraft('q1', 'one')
    const ts1 = useQuizDraftStore.getState().drafts.q1.updatedAt
    await new Promise(r => setTimeout(r, 5))
    useQuizDraftStore.getState().setDraft('q1', 'two')
    const ts2 = useQuizDraftStore.getState().drafts.q1.updatedAt
    expect(ts2).toBeGreaterThan(ts1)
  })

  it('is a no-op (preserves state identity) when code is unchanged', () => {
    useQuizDraftStore.getState().setDraft('q1', 'same')
    const before = useQuizDraftStore.getState().drafts
    useQuizDraftStore.getState().setDraft('q1', 'same')
    const after = useQuizDraftStore.getState().drafts
    expect(after).toBe(before)
  })

  it('getDraft returns the stored value', () => {
    useQuizDraftStore.getState().setDraft('q1', 'hello')
    expect(useQuizDraftStore.getState().getDraft('q1')?.code).toBe('hello')
    expect(useQuizDraftStore.getState().getDraft('missing')).toBeUndefined()
  })

  it('clearDraft removes the entry; clearing a missing entry is a no-op', () => {
    useQuizDraftStore.getState().setDraft('q1', 'x')
    useQuizDraftStore.getState().clearDraft('q1')
    expect(useQuizDraftStore.getState().drafts).not.toHaveProperty('q1')

    const before = useQuizDraftStore.getState().drafts
    useQuizDraftStore.getState().clearDraft('not-there')
    expect(useQuizDraftStore.getState().drafts).toBe(before)
  })

  it('tracks drafts independently per quiz id', () => {
    useQuizDraftStore.getState().setDraft('q1', 'a')
    useQuizDraftStore.getState().setDraft('q2', 'b')
    expect(useQuizDraftStore.getState().drafts.q1.code).toBe('a')
    expect(useQuizDraftStore.getState().drafts.q2.code).toBe('b')
  })
})
