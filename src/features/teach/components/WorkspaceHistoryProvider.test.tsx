import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import {
  createWorkspaceHistoryMarker,
  mergeWorkspaceHistoryState,
} from '@/features/teach/navigation/workspace-view-url'
import { useWorkspaceHistoryNavigation } from '@/features/teach/navigation/workspace-history-context'
import { WorkspaceHistoryProvider } from './WorkspaceHistoryProvider'

function Harness() {
  const view = useWorkspaceStore(state => state.view)
  const navigate = useWorkspaceHistoryNavigation()
  return (
    <div>
      <output>{view}</output>
      <button type="button" onClick={() => navigate('live')}>Live</button>
      <button type="button" onClick={() => navigate('review')}>Review</button>
      <button type="button" onClick={() => navigate('progress')}>Progress</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <WorkspaceHistoryProvider>
      <Harness />
    </WorkspaceHistoryProvider>,
  )
}

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  window.history.replaceState({ next: 'keep' }, '', '/zh/tour/ai?topic=main')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('workspace history provider', () => {
  it('hydrates a deep link without pushing and preserves existing history state', () => {
    window.history.replaceState({ next: 'keep' }, '', '/zh/tour/ai?topic=main&view=progress#lesson')
    const push = vi.spyOn(window.history, 'pushState')
    renderProvider()

    expect(screen.getByText('progress')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    expect(window.history.state.next).toBe('keep')
    expect(window.location.search).toContain('view=progress')
    expect(window.location.hash).toBe('#lesson')
  })

  it('pushes only explicit view changes and keeps Live canonical', () => {
    const push = vi.spyOn(window.history, 'pushState')
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByText('review')).toBeTruthy()
    expect(window.location.search).toContain('view=review')
    expect(push).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(push).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Live' }))
    expect(window.location.search).toBe('?topic=main')
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('applies popstate without creating another history entry', () => {
    const push = vi.spyOn(window.history, 'pushState')
    renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    const reviewState = window.history.state
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(push).toHaveBeenCalledTimes(2)

    act(() => {
      window.history.replaceState(reviewState, '', '/zh/tour/ai?topic=main&view=review')
      window.dispatchEvent(new PopStateEvent('popstate', { state: reviewState }))
    })
    expect(screen.getByText('review')).toBeTruthy()
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('adopts an unmarked external history entry without losing its state', () => {
    const push = vi.spyOn(window.history, 'pushState')
    renderProvider()

    act(() => {
      window.history.replaceState({ next: 'external' }, '', '/zh/tour/ai?topic=main&view=review#external')
      window.dispatchEvent(new PopStateEvent('popstate', { state: { next: 'external' } }))
    })

    expect(screen.getByText('review')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    expect(window.history.state.next).toBe('external')
    expect(window.location.search).toContain('view=review')
    expect(window.location.hash).toBe('#external')
  })

  it('canonicalizes an unmarked blocked popstate back to the running chat scope', () => {
    renderProvider()
    act(() => useWorkspaceStore.getState().setTeacherChatRunMode('live'))
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {})

    act(() => {
      window.history.replaceState({ next: 'external' }, '', '/zh/tour/ai?topic=main&view=review#external')
      window.dispatchEvent(new PopStateEvent('popstate', { state: { next: 'external' } }))
    })

    expect(screen.getByText('live')).toBeTruthy()
    expect(go).not.toHaveBeenCalled()
    expect(window.history.state.next).toBe('external')
    expect(window.location.search).toBe('?topic=main')
    expect(window.location.hash).toBe('#external')
  })

  it('rolls back a popstate that would cross the running teacher scope', () => {
    renderProvider()
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    const reviewState = window.history.state
    act(() => useWorkspaceStore.getState().setTeacherChatRunMode('review'))

    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {})
    const liveState = mergeWorkspaceHistoryState(
      { next: 'keep' },
      createWorkspaceHistoryMarker('live', 0),
    )
    act(() => {
      window.history.replaceState(liveState, '', '/zh/tour/ai?topic=main')
      window.dispatchEvent(new PopStateEvent('popstate', { state: liveState }))
    })

    expect(screen.getByText('review')).toBeTruthy()
    expect(go).toHaveBeenCalledWith(1)

    act(() => {
      window.history.replaceState(reviewState, '', '/zh/tour/ai?topic=main&view=review')
      window.dispatchEvent(new PopStateEvent('popstate', { state: reviewState }))
    })
    expect(screen.getByText('review')).toBeTruthy()
  })
})
