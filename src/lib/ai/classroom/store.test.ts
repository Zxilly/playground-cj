import { describe, expect, it } from 'vitest'
import { CLASSROOM_STORAGE_PREFIX, classroomStorageKey, createClassroomStore } from './store'

describe('classroom store', () => {
  it('uses a v3 language-scoped storage key and fresh initial state', () => {
    const store = createClassroomStore({ lang: 'zh' })

    expect(classroomStorageKey('zh')).toBe(`${CLASSROOM_STORAGE_PREFIX}:zh`)
    expect(store.getState().session.version).toBe(3)
    expect(store.getState().session.stream).toEqual([])
    expect(store.getState().session.currentExercise).toBeNull()
    expect(store.getState().session.learner.reviewArtifacts).toEqual([])
  })

  it('dispatches reducer actions and resets back to a fresh language-scoped session', () => {
    const store = createClassroomStore({ lang: 'en' })

    store.getState().dispatch({ type: 'SET_PHASE', phase: 'teach', now: 2000 })
    store.getState().dispatch({
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Print',
        body: 'Use println.',
        summary: 'println reminder',
        evidenceIds: [],
      },
      now: 2001,
    })

    expect(store.getState().session.phase).toBe('teach')
    expect(store.getState().session.learner.reviewArtifacts).toHaveLength(1)

    store.getState().reset()

    expect(store.getState().session.phase).toBe('orient')
    expect(store.getState().session.stream).toEqual([])
    expect(store.getState().session.eventQueue).toEqual([])
    expect(store.getState().session.currentExercise).toBeNull()
    expect(store.getState().session.lastRun).toBeNull()
    expect(store.getState().session.sessionSummary).toContain('en')
  })
})
