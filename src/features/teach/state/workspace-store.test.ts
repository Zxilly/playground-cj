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
    for (const view of ['mission', 'lessons', 'lesson', 'playground', 'glossary', 'reference', 'records', 'notes'] as const) {
      useWorkspaceStore.getState().setView(view)
      expect(useWorkspaceStore.getState().view).toBe(view)
    }
  })

  it('opens and selects multiple Playground tabs while routing the central view', () => {
    const firstId = useWorkspaceStore.getState().openPlaygroundTab({ title: 'First', code: 'first()' })
    const secondId = useWorkspaceStore.getState().openPlaygroundTab({ title: 'Second', code: 'second()' })
    expect(firstId).not.toBe(secondId)
    expect(useWorkspaceStore.getState().playgroundTabs).toHaveLength(3)
    expect(useWorkspaceStore.getState().view).toBe('playground')
    expect(useWorkspaceStore.getState().currentPlaygroundTabId).toBe(secondId)

    expect(useWorkspaceStore.getState().selectPlaygroundTab(firstId)).toBe(true)
    expect(useWorkspaceStore.getState().currentPlaygroundTabId).toBe(firstId)
  })

  it('closes Playground tabs and selects a neighbouring tab', () => {
    const id = useWorkspaceStore.getState().openPlaygroundTab({ title: 'Temporary', code: '' })
    useWorkspaceStore.getState().closePlaygroundTab(id)
    expect(useWorkspaceStore.getState().playgroundTabs.some(tab => tab.id === id)).toBe(false)
    expect(useWorkspaceStore.getState().currentPlaygroundTabId).toBe('playground-1')
  })

  it('persists the live code buffer for a Playground tab', () => {
    useWorkspaceStore.getState().setPlaygroundTabCode('playground-1', 'main() { println("saved") }')
    expect(useWorkspaceStore.getState().playgroundTabs[0]?.initialCode)
      .toBe('main() { println("saved") }')
  })

  it('openReference switches to the reference view and records the id', () => {
    useWorkspaceStore.getState().openReference('r1')
    const state = useWorkspaceStore.getState()
    expect(state.view).toBe('reference')
    expect(state.currentReferenceId).toBe('r1')
  })

  it('starts with no pending chat prefill', () => {
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
  })

  it('setPendingPrefill queues a prompt for the chat composer', () => {
    useWorkspaceStore.getState().setPendingPrefill('帮我定下学习目标')
    expect(useWorkspaceStore.getState().pendingPrefill).toBe('帮我定下学习目标')
  })

  it('the latest setPendingPrefill wins when none was consumed yet', () => {
    useWorkspaceStore.getState().setPendingPrefill('first')
    useWorkspaceStore.getState().setPendingPrefill('second')
    expect(useWorkspaceStore.getState().pendingPrefill).toBe('second')
  })

  it('consumePrefill returns the queued prompt and clears it', () => {
    useWorkspaceStore.getState().setPendingPrefill('问老师这个问题')
    expect(useWorkspaceStore.getState().consumePrefill()).toBe('问老师这个问题')
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
  })

  it('consumePrefill returns null when nothing is queued', () => {
    expect(useWorkspaceStore.getState().consumePrefill()).toBeNull()
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
  })

  it('reset restores the default view and clears the selection and prefill', () => {
    const store = useWorkspaceStore.getState()
    store.selectLesson('0007')
    store.openReference('r9')
    store.setPendingPrefill('pending')
    useWorkspaceStore.getState().reset()
    const state = useWorkspaceStore.getState()
    expect(state.view).toBe('lessons')
    expect(state.currentLessonId).toBeNull()
    expect(state.currentReferenceId).toBeNull()
    expect(state.pendingPrefill).toBeNull()
  })

  it('reset leaves revision counters untouched (the shell remounts on import)', () => {
    useWorkspaceStore.getState().bumpRevision('lessons')
    useWorkspaceStore.getState().reset()
    expect(useWorkspaceStore.getState().revisions.lessons).toBe(1)
  })

  it('starts every scope revision at zero', () => {
    const { revisions } = useWorkspaceStore.getState()
    for (const value of Object.values(revisions))
      expect(value).toBe(0)
  })

  it('a scoped bump touches only that scope and the all counter', () => {
    useWorkspaceStore.getState().bumpRevision('glossary')
    const { revisions } = useWorkspaceStore.getState()
    expect(revisions.glossary).toBe(1)
    expect(revisions.all).toBe(1)
    // Unrelated scopes are untouched, so their subscribers do not re-run.
    expect(revisions.lessons).toBe(0)
    expect(revisions.mission).toBe(0)
    expect(revisions.references).toBe(0)
  })

  it('defaults to an all-scope bump (refresh everything) when no scope is given', () => {
    // A caller that does not know which document changed must conservatively
    // re-run every scope's subscribers, not just the span-everything reads.
    useWorkspaceStore.getState().bumpRevision()
    const { revisions } = useWorkspaceStore.getState()
    for (const value of Object.values(revisions))
      expect(value).toBe(1)
  })

  it('an all-scope bump re-runs every scope subscriber', () => {
    useWorkspaceStore.getState().bumpRevision('all')
    const { revisions } = useWorkspaceStore.getState()
    for (const value of Object.values(revisions))
      expect(value).toBe(1)
  })

  it('accumulates scope bumps independently', () => {
    const store = useWorkspaceStore.getState()
    store.bumpRevision('lessons')
    store.bumpRevision('lessons')
    store.bumpRevision('mission')
    const { revisions } = useWorkspaceStore.getState()
    expect(revisions.lessons).toBe(2)
    expect(revisions.mission).toBe(1)
    expect(revisions.all).toBe(3)
    expect(revisions.glossary).toBe(0)
  })
})
