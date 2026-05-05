import { beforeEach, describe, expect, it } from 'vitest'
import { CLASSROOM_STORAGE_PREFIX, classroomStorageKey, createClassroomStore } from './store'

describe('classroom store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses a new classroom storage key and ignores legacy AI mode keys', () => {
    window.localStorage.setItem('tour-ai:lesson-feed:v1:zh', JSON.stringify({ blocks: [{ old: true }] }))
    window.localStorage.setItem('tour-ai:thread:v1:zh', JSON.stringify([{ role: 'assistant' }]))
    window.localStorage.setItem('tour-ai:learner:v1', JSON.stringify({ state: { learner: { activeQuiz: {} } } }))

    const store = createClassroomStore({ lang: 'zh', now: 1000 })

    expect(classroomStorageKey('zh')).toBe(`${CLASSROOM_STORAGE_PREFIX}:zh`)
    expect(store.getState().session.stream).toEqual([])
    expect(store.getState().session.currentQuiz).toBeNull()
    expect(store.getState().session.eventQueue).toEqual([])
    expect(store.getState().session.sessionSummary).toContain('zh')
  })
})
