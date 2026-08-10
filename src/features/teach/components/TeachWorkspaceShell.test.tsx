import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByRole('region', { name: 'Classroom workspace' })).toBeTruthy()
    expect(screen.queryAllByRole('main')).toHaveLength(0)
    expect(screen.getByText('viewport:live')).toBeTruthy()
    expect(screen.getByRole('navigation').querySelectorAll('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: /Live/ }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: /Progress/ }))
    expect(await screen.findByText('viewport:progress')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Progress/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /Live/ }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByText('chat')).toBeTruthy()
  })

  it('keeps navigation in the running Chat scope until the learner stops or waits', async () => {
    render(<TeachWorkspaceShell chat={<div>chat</div>} />, { wrapper: Wrapper })
    act(() => useWorkspaceStore.getState().setTeacherChatRunMode('live'))

    const review = screen.getByRole('button', { name: /Review/ })
    expect(review.getAttribute('aria-disabled')).toBe('true')
    expect(review.getAttribute('aria-describedby')).toBe('teacher-chat-navigation-status')
    expect(screen.getByRole('status').textContent).toContain('response is in progress')
    fireEvent.click(review)
    expect(screen.getByText('viewport:live')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Progress/ }))
    expect(await screen.findByText('viewport:progress')).toBeTruthy()

    act(() => useWorkspaceStore.getState().setTeacherChatRunMode(null))
    fireEvent.click(review)
    expect(await screen.findByText('viewport:review')).toBeTruthy()
  })

  it('opens a compact Chat for a new prefill and resets it across viewports', () => {
    viewport.compact = true
    const rendered = render(
      <TeachWorkspaceShell chat={<div>chat</div>} />,
      { wrapper: Wrapper },
    )
    expect(screen.queryByTestId('workspace-chat')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Open teacher chat' })
    expect(toggle.className).toContain('top-1.5')
    expect(toggle.className).not.toContain('bottom-')

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

  it('reopens compact Chat when the same prefill is requested again', () => {
    viewport.compact = true
    render(
      <TeachWorkspaceShell chat={<div>chat</div>} />,
      { wrapper: Wrapper },
    )

    act(() => {
      useWorkspaceStore.getState().setPendingPrefill('Please start the lesson.')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close teacher chat' }))
    expect(screen.queryByTestId('workspace-chat')).toBeNull()

    act(() => {
      useWorkspaceStore.getState().setPendingPrefill('Please start the lesson.')
    })
    expect(screen.getByTestId('workspace-chat').dataset.open).toBe('true')
  })

  it('does not replay a retained prefill as a new open action after remount', () => {
    viewport.compact = true
    act(() => {
      useWorkspaceStore.getState().setPendingPrefill('Keep this draft without reopening.')
    })

    render(<TeachWorkspaceShell chat={<div>chat</div>} />, { wrapper: Wrapper })

    expect(screen.queryByTestId('workspace-chat')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open teacher chat' })).toBeTruthy()
  })

  it('closes compact Chat with Escape and returns focus to its trigger', async () => {
    viewport.compact = true
    render(<TeachWorkspaceShell chat={<textarea aria-label="Input message" />} />, {
      wrapper: Wrapper,
    })
    const trigger = screen.getByRole('button', { name: 'Open teacher chat' })
    fireEvent.click(trigger)

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Input message' }), {
      key: 'Escape',
    })

    expect(screen.queryByTestId('workspace-chat')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('resizes the desktop chat with the keyboard', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1440,
    })
    render(<TeachWorkspaceShell chat={<div>chat</div>} />, { wrapper: Wrapper })
    const separator = screen.getByRole('separator', { name: 'Resize chat panel' })

    expect(separator.getAttribute('aria-valuenow')).toBe('400')
    fireEvent.keyDown(separator, { key: 'ArrowLeft' })
    expect(separator.getAttribute('aria-valuenow')).toBe('424')
    fireEvent.keyDown(separator, { key: 'Home' })
    expect(separator.getAttribute('aria-valuenow')).toBe('320')
  })

  it('preserves a usable center workspace at the 1280px desktop breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    })
    render(<TeachWorkspaceShell chat={<div>chat</div>} />, { wrapper: Wrapper })
    const separator = screen.getByRole('separator', { name: 'Resize chat panel' })

    fireEvent.keyDown(separator, { key: 'End' })
    expect(separator.getAttribute('aria-valuemax')).toBe('472')
    expect(separator.getAttribute('aria-valuenow')).toBe('472')
  })
})
