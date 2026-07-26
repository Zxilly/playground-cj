import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'

const viewport = vi.hoisted(() => ({ compact: false }))

/* eslint-disable react/component-hook-factories -- Vitest module factories intentionally provide hook and component test doubles. */
vi.mock('@/hooks/use-mobile', () => ({
  useIsCompactViewport: () => viewport.compact,
}))
vi.mock('./views/PlaygroundEditorHost', () => ({
  PlaygroundEditorHost: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('./WorkspaceViewport', () => ({
  WorkspaceViewport: ({ view }: { view: string }) => (
    <div>
      viewport:
      {view}
    </div>
  ),
}))
/* eslint-enable react/component-hook-factories */

const context = {
  lang: 'en',
} as WorkspaceContextValue

function Wrapper({ children }: { children: ReactNode }) {
  return <WorkspaceContext value={context}>{children}</WorkspaceContext>
}

beforeEach(() => {
  viewport.compact = false
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
})
afterEach(cleanup)

describe('teachWorkspaceShell', () => {
  it('offers only canonical views and routes the central surface', async () => {
    render(<TeachWorkspaceShell chat={<div>chat</div>} />, { wrapper: Wrapper })
    expect(screen.getByText('viewport:live')).toBeTruthy()
    expect(screen.getByRole('navigation').querySelectorAll('button')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /Progress/ }))
    expect(await screen.findByText('viewport:progress')).toBeTruthy()
    expect(screen.getByText('chat')).toBeTruthy()
  })

  it('opens a compact Chat for a new prefill and closes it on viewport entry', () => {
    viewport.compact = true
    const rendered = render(
      <TeachWorkspaceShell chat={<div>chat</div>} />,
      { wrapper: Wrapper },
    )
    const chat = screen.getByTestId('workspace-chat')
    expect(chat.dataset.open).toBe('false')

    act(() => {
      useWorkspaceStore.getState().setPendingPrefill('Please explain this.')
    })
    expect(chat.dataset.open).toBe('true')
    act(() => {
      useWorkspaceStore.getState().consumePrefill()
    })
    fireEvent.click(screen.getByTestId('workspace-chat-toggle'))
    expect(chat.dataset.open).toBe('false')

    viewport.compact = false
    rendered.rerender(<TeachWorkspaceShell chat={<div>chat</div>} />)
    fireEvent.click(screen.getByTestId('workspace-chat-toggle'))
    expect(chat.dataset.open).toBe('true')
    viewport.compact = true
    rendered.rerender(<TeachWorkspaceShell chat={<div>chat</div>} />)
    expect(chat.dataset.open).toBe('false')
  })
})
