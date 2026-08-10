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

  it('tracks the running Chat scope without persisting it across reset', () => {
    store.getState().setTeacherChatRunMode('review')
    expect(store.getState().teacherChatRunMode).toBe('review')
    store.getState().reset()
    expect(store.getState().teacherChatRunMode).toBeNull()
  })

  it('opens Review View for one Concept', () => {
    store.getState().openReviewConcept('cj.var.immutable')
    expect(store.getState()).toMatchObject({
      view: 'review',
      reviewConceptId: 'cj.var.immutable',
    })
  })

  it('consumes Chat prefill once and resets navigation', () => {
    store.getState().setPendingPrefill('Start the next step', {
      type: 'first_lesson',
      learningTrackId: 'track:first',
    })
    expect(store.getState().pendingPrefillIntent).toEqual({
      type: 'first_lesson',
      learningTrackId: 'track:first',
    })
    expect(store.getState().consumePrefill()).toBe('Start the next step')
    expect(store.getState().consumePrefill()).toBeNull()
    expect(store.getState().pendingPrefillIntent).toBeNull()

    store.getState().openReviewConcept('cj.program.main')
    store.getState().setPendingPrefill('pending')
    store.getState().reset()
    expect(store.getState()).toMatchObject({
      view: 'live',
      reviewConceptId: null,
      pendingPrefill: null,
      pendingPrefillIntent: null,
      cancelledDraft: null,
    })
  })

  it('keeps only one recoverable composer draft and clears it across Chat scopes', () => {
    store.getState().setPendingPrefill('Prepared lesson prompt')
    expect(store.getState()).toMatchObject({
      pendingPrefill: 'Prepared lesson prompt',
      cancelledDraft: null,
    })

    store.getState().setCancelledDraft('Cancelled user prompt')
    expect(store.getState()).toMatchObject({
      pendingPrefill: null,
      cancelledDraft: 'Cancelled user prompt',
    })

    store.getState().openReviewConcept('cj.program.main')
    expect(store.getState()).toMatchObject({
      pendingPrefill: null,
      cancelledDraft: null,
    })
  })

  it('identifies repeated prefill requests even when their text is unchanged', () => {
    store.getState().setPendingPrefill('Prepared lesson prompt')
    expect(store.getState().prefillRevision).toBe(1)

    store.getState().setPendingPrefill('Prepared lesson prompt')
    expect(store.getState().prefillRevision).toBe(2)
  })
})
