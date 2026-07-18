import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { WorkspaceRouteBridge } from './WorkspaceRouteBridge'

beforeEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  window.history.replaceState(null, '', '/zh/tour/ai')
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/zh/tour/ai')
})

describe('workspaceRouteBridge', () => {
  it('reflects workspace and Playground tab navigation in the URL', () => {
    render(<WorkspaceRouteBridge />)

    act(() => {
      useWorkspaceStore.getState().setView('glossary')
    })
    expect(window.location.search).toBe('?view=glossary')

    let tabId = ''
    act(() => {
      tabId = useWorkspaceStore.getState().openPlaygroundTab({
        title: 'Scratch',
        code: 'main() {}',
      })
    })
    expect(window.location.search).toBe(`?view=playground&tab=${tabId}`)
  })

  it('restores a URL route on mount and browser history navigation', () => {
    window.history.replaceState(null, '', '/zh/tour/ai?view=playground&tab=playground-1')
    render(<WorkspaceRouteBridge />)
    expect(useWorkspaceStore.getState().view).toBe('playground')
    expect(useWorkspaceStore.getState().currentPlaygroundTabId).toBe('playground-1')

    act(() => {
      window.history.pushState(null, '', '/zh/tour/ai?view=notes')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(useWorkspaceStore.getState().view).toBe('notes')
  })

  it('preserves unrelated query parameters while changing the workspace route', () => {
    window.history.replaceState(null, '', '/zh/tour/ai?topic=cj.program.main')
    render(<WorkspaceRouteBridge />)

    act(() => {
      useWorkspaceStore.getState().selectLesson('0007')
    })
    expect(window.location.search).toBe('?topic=cj.program.main&view=lesson&id=0007')
  })
})
