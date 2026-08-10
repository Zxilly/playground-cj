import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeachWorkspace } from './TeachWorkspace'

function MockTeacherChatRuntime({
  children,
}: {
  children?: (chat: ReactNode) => ReactNode
}) {
  const [message, setMessage] = useState('')
  const [scope, setScope] = useState('live')
  const chat = (
    <input
      aria-label="Mock teacher message"
      value={message}
      onChange={event => setMessage(event.currentTarget.value)}
    />
  )
  return (
    <>
      <button type="button" onClick={() => setScope(current => current === 'live' ? 'review' : 'live')}>
        Toggle chat scope
      </button>
      <div key={scope}>{children ? children(chat) : chat}</div>
    </>
  )
}

function MockPlaygroundEditorHost({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState('')
  return (
    <div>
      <input
        aria-label="Mock persistent editor"
        value={draft}
        onChange={event => setDraft(event.currentTarget.value)}
      />
      {children}
    </div>
  )
}

function MockTeachWorkspaceShell({ chat }: { chat: ReactNode }) {
  const [compact, setCompact] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setCompact(current => !current)}>
        Toggle responsive host
      </button>
      {!compact && chat}
      {compact && (
        <div>
          <button type="button">Open compact chat</button>
          {chat}
        </div>
      )}
    </div>
  )
}

/* eslint-disable react/component-hook-factories -- Vitest module factories intentionally provide hook and component test doubles. */
vi.mock('@/features/teach/context/abort-scope', () => ({
  AbortScopeProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/modules/llm-config/components/LLMConfigDialog', () => ({
  LLMConfigDialog: () => null,
}))
vi.mock('@/stores/llmConfig', () => ({
  useLLMConfigStore: (selector: (state: unknown) => unknown) => selector({
    setSettingsDialogOpen: vi.fn(),
  }),
}))
vi.mock('@/lib/monaco/model-lifecycle', () => ({
  retainModelScope: () => vi.fn(),
}))
vi.mock('./TeachTopBar', () => ({
  TeachTopBar: () => null,
}))
vi.mock('./views/PlaygroundEditorHost', () => ({
  PlaygroundEditorHost: MockPlaygroundEditorHost,
}))
vi.mock('./TeachWorkspaceShell', () => ({
  TeachWorkspaceShell: MockTeachWorkspaceShell,
}))
vi.mock('./TeacherChatRuntime', () => ({
  TeacherChatRuntime: MockTeacherChatRuntime,
}))
/* eslint-enable react/component-hook-factories */

afterEach(cleanup)

describe('teachWorkspace responsive chat lifetime', () => {
  it('keeps the teacher runtime above desktop/mobile host replacement', () => {
    render(<TeachWorkspace lang="en" />)
    const composer = screen.getByRole('textbox', { name: 'Mock teacher message' })
    fireEvent.change(composer, { target: { value: 'Keep this completed reply' } })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle responsive host' }))

    expect((screen.getByRole('textbox', {
      name: 'Mock teacher message',
    }) as HTMLInputElement).value).toBe('Keep this completed reply')
  })

  it('keeps the Playground editor host above chat-scope replacement', () => {
    render(<TeachWorkspace lang="en" />)
    const editor = screen.getByRole('textbox', { name: 'Mock persistent editor' })
    fireEvent.change(editor, { target: { value: 'main() { println("stay") }' } })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle chat scope' }))

    expect(screen.getByRole('textbox', { name: 'Mock persistent editor' })).toBe(editor)
    expect((editor as HTMLInputElement).value).toBe('main() { println("stay") }')
  })
})
