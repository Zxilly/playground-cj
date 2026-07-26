import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import TeachAppRoot from './TeachAppRoot'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@/features/teach/state/workspace-collaborators', () => ({
  createWorkspaceCollaborators: mocks.create,
}))
vi.mock('./TeachApp', () => ({
  // The mock must be declared in this hoisted factory so Vitest can replace
  // the module before TeachAppRoot is imported.
  // eslint-disable-next-line react/component-hook-factories
  TeachAppContent: ({ lang }: { lang: string }) => <div>{`ready:${lang}`}</div>,
}))

afterEach(() => {
  cleanup()
  mocks.create.mockReset()
})

describe('teach app root', () => {
  it('opens the runtime before rendering and disposes it on unmount', async () => {
    const dispose = vi.fn(async () => undefined)
    mocks.create.mockResolvedValue({ dispose } as unknown as WorkspaceCollaborators)
    const { unmount } = render(<TeachAppRoot lang="en" />)
    expect(screen.getByTestId('teach-app-loading')).toBeTruthy()
    expect(await screen.findByText('ready:en')).toBeTruthy()
    expect(mocks.create).toHaveBeenCalledWith(
      'en',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    unmount()
    await waitFor(() => expect(dispose).toHaveBeenCalledOnce())
  })

  it('fails closed when curriculum loading fails', async () => {
    mocks.create.mockRejectedValue(new Error('invalid content pack'))
    render(<TeachAppRoot lang="zh" />)
    expect((await screen.findByRole('alert')).textContent).toContain('invalid content pack')
  })

  it('never exposes a disposed old-locale runtime while the new locale loads', async () => {
    const disposeEnglish = vi.fn(async () => undefined)
    const disposeChinese = vi.fn(async () => undefined)
    let resolveChinese!: (value: WorkspaceCollaborators) => void
    mocks.create
      .mockResolvedValueOnce({
        dispose: disposeEnglish,
      } as unknown as WorkspaceCollaborators)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveChinese = resolve
      }))

    const { rerender } = render(<TeachAppRoot lang="en" />)
    expect(await screen.findByText('ready:en')).toBeTruthy()

    rerender(<TeachAppRoot lang="zh" />)

    expect(screen.getByTestId('teach-app-loading')).toBeTruthy()
    expect(screen.queryByText('ready:zh')).toBeNull()
    await waitFor(() => expect(disposeEnglish).toHaveBeenCalledOnce())

    resolveChinese({
      dispose: disposeChinese,
    } as unknown as WorkspaceCollaborators)
    expect(await screen.findByText('ready:zh')).toBeTruthy()
  })
})
