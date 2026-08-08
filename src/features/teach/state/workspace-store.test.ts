import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceStore } from './workspace-store'

describe('aI Classroom workspace navigation', () => {
  const store = createWorkspaceStore()

  beforeEach(() => {
    store.setState(store.getInitialState(), true)
  })

  it('contains only canonical classroom views', () => {
    expect(store.getState().view).toBe('live')
    for (const view of ['live', 'review', 'progress', 'playground'] as const) {
      store.getState().setView(view)
      expect(store.getState().view).toBe(view)
    }
  })

  it('opens Review View for one Concept', () => {
    store.getState().openReviewConcept('cj.var.immutable')
    expect(store.getState()).toMatchObject({
      view: 'review',
      reviewConceptId: 'cj.var.immutable',
    })
  })

  it('consumes Chat prefill once and resets navigation', () => {
    store.getState().setPendingPrefill('Start the next step')
    expect(store.getState().consumePrefill()).toBe('Start the next step')
    expect(store.getState().consumePrefill()).toBeNull()

    store.getState().openReviewConcept('cj.program.main')
    store.getState().setPendingPrefill('pending')
    store.getState().reset()
    expect(store.getState()).toMatchObject({
      view: 'live',
      reviewConceptId: null,
      pendingPrefill: null,
    })
  })
})
