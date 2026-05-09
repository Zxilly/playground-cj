import { beforeEach, describe, expect, it } from 'vitest'
import { CLASSROOM_STORAGE_PREFIX, classroomStorageKey, createClassroomStore } from './store'

describe('classroom store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses a language-scoped classroom storage key and fresh initial state', () => {
    const store = createClassroomStore({ lang: 'zh' })

    expect(classroomStorageKey('zh')).toBe(`${CLASSROOM_STORAGE_PREFIX}:zh`)
    expect(store.getState().session.stream).toEqual([])
    expect(store.getState().session.currentQuiz).toBeNull()
    expect(store.getState().session.eventQueue).toEqual([])
    expect(store.getState().session.sessionSummary).toContain('zh')
  })

  it('dispatches classroom actions and resets back to a fresh language-scoped session', () => {
    const store = createClassroomStore({ lang: 'en' })

    store.getState().dispatch({ type: 'SET_PHASE', phase: 'teach', now: 2000 })
    store.getState().dispatch({ type: 'SET_LEARNING_NOTES', notes: 'Remember variables', now: 2001 })

    expect(store.getState().session.phase).toBe('teach')
    expect(store.getState().session.learner.learningNotes).toBe('Remember variables')

    store.getState().reset()

    expect(store.getState().session.phase).toBe('orient')
    expect(store.getState().session.learner.learningNotes).toBe('')
    expect(store.getState().session.stream).toEqual([])
    expect(store.getState().session.eventQueue).toEqual([])
    expect(store.getState().session.currentQuiz).toBeNull()
    expect(store.getState().session.lastRun).toBeNull()
    expect(store.getState().session.sessionSummary).toContain('en')
  })
})
