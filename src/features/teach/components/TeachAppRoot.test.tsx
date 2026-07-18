import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import TeachAppRoot from './TeachAppRoot'

const { createWorkspaceCollaborators } = vi.hoisted(() => ({
  createWorkspaceCollaborators: vi.fn((lang: string) => ({
    repo: { identity: lang },
  })),
}))

vi.mock('@/features/teach/state/workspace-collaborators', () => ({
  createWorkspaceCollaborators,
}))

vi.mock('./TeachApp', () => ({
  // eslint-disable-next-line react/component-hook-factories
  TeachAppContent: ({
    lang,
    collaborators,
  }: {
    lang: string
    collaborators: WorkspaceCollaborators & { repo: { identity: string } }
  }) => (
    <div
      data-testid="identity"
      data-lang={lang}
      data-repo={collaborators.repo.identity}
    />
  ),
}))

beforeEach(() => {
  createWorkspaceCollaborators.mockClear()
  useWorkspaceStore.getState().reset()
})

afterEach(cleanup)

describe('teachAppRoot workspace identity', () => {
  it('rebuilds collaborators and resets transient state when the locale identity changes', () => {
    const view = render(<TeachAppRoot lang="zh" />)
    expect(screen.getByTestId('identity').getAttribute('data-repo')).toBe('zh')
    useWorkspaceStore.getState().setView('glossary')

    view.rerender(<TeachAppRoot lang="en" />)

    expect(createWorkspaceCollaborators).toHaveBeenNthCalledWith(1, 'zh')
    expect(createWorkspaceCollaborators).toHaveBeenNthCalledWith(2, 'en')
    expect(screen.getByTestId('identity').getAttribute('data-repo')).toBe('en')
    expect(useWorkspaceStore.getState().view).toBe('lessons')
  })
})
