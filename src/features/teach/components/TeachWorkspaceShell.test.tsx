import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
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
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } })
  i18n.activate('en')
  return (
    <I18nProvider i18n={i18n}>
      <WorkspaceContext value={context}>{children}</WorkspaceContext>
    </I18nProvider>
  )
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

  it('opens a compact Chat for a new prefill and resets it across viewports', () => {
    viewport.compact = true
    const rendered = render(
      <TeachWorkspaceShell chat={<div>chat</div>} />,
      { wrapper: Wrapper },
    )
    expect(screen.queryByTestId('workspace-chat')).toBeNull()

    act(() => {
      useWorkspaceStore.getState().setPendingPrefill('Please explain this.')
    })
    expect(screen.getByTestId('workspace-chat').dataset.open).toBe('true')
    act(() => {
      useWorkspaceStore.getState().consumePrefill()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close teacher chat' }))
    expect(screen.queryByTestId('workspace-chat')).toBeNull()

    viewport.compact = false
    rendered.rerender(<TeachWorkspaceShell chat={<div>chat</div>} />)
    expect(screen.getByTestId('workspace-chat')).toBeTruthy()
    viewport.compact = true
    rendered.rerender(<TeachWorkspaceShell chat={<div>chat</div>} />)
    expect(screen.queryByTestId('workspace-chat')).toBeNull()
  })
})
