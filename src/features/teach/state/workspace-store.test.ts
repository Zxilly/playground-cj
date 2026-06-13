import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceStore } from './workspace-store'

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  })

  it('defaults the view to lessons with no selection', () => {
    const state = useWorkspaceStore.getState()
    expect(state.view).toBe('lessons')
    expect(state.currentLessonId).toBeNull()
    expect(state.currentReferenceId).toBeNull()
  })

  it('selectLesson switches to the lesson view and records the id', () => {
    useWorkspaceStore.getState().selectLesson('0003')
    const state = useWorkspaceStore.getState()
    expect(state.view).toBe('lesson')
    expect(state.currentLessonId).toBe('0003')
  })

  it('setView switches the active view without touching the selection', () => {
    useWorkspaceStore.getState().selectLesson('0003')
    useWorkspaceStore.getState().setView('glossary')
    const state = useWorkspaceStore.getState()
    expect(state.view).toBe('glossary')
    expect(state.currentLessonId).toBe('0003')
  })

  it('setView accepts every workspace view', () => {
    for (const view of ['mission', 'lessons', 'lesson', 'glossary', 'reference', 'records', 'notes'] as const) {
      useWorkspaceStore.getState().setView(view)
      expect(useWorkspaceStore.getState().view).toBe(view)
    }
  })

  it('openReference switches to the reference view and records the id', () => {
    useWorkspaceStore.getState().openReference('r1')
    const state = useWorkspaceStore.getState()
    expect(state.view).toBe('reference')
    expect(state.currentReferenceId).toBe('r1')
  })
})
