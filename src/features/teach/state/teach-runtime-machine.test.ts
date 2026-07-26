import { createActor, waitFor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceCollaborators } from './workspace-collaborators'
import { createTeachRuntimeMachine } from './teach-runtime-machine'

describe('teach runtime machine', () => {
  it('owns open, storage-failure disposal, and retry', async () => {
    let reportStorageError: ((error: unknown) => void) | undefined
    const collaborators = {
      dispose: vi.fn(async () => undefined),
    } as unknown as WorkspaceCollaborators
    const replacement = {
      dispose: vi.fn(async () => undefined),
    } as unknown as WorkspaceCollaborators
    const open = vi.fn()
      .mockImplementationOnce(async (
        _locale,
        options: { onStorageError: (error: unknown) => void },
      ) => {
        reportStorageError = options.onStorageError
        return collaborators
      })
      .mockResolvedValueOnce(replacement)
    const resetWorkspace = vi.fn()
    const actor = createActor(createTeachRuntimeMachine({
      locale: 'en',
      open,
      resetWorkspace,
      reportDisposeError: vi.fn(),
    })).start()

    expect(actor.getSnapshot()).toMatchObject({
      value: 'loading',
      context: { collaborators: null, message: null },
    })
    await waitFor(actor, snapshot => snapshot.matches('ready'))
    expect(actor.getSnapshot()).toMatchObject({
      value: 'ready',
      context: { collaborators },
    })

    reportStorageError?.(new Error('IndexedDB failed'))
    await waitFor(actor, snapshot => snapshot.matches('error'))
    expect(actor.getSnapshot()).toMatchObject({
      value: 'error',
      context: { collaborators: null, message: 'IndexedDB failed' },
    })
    expect(collaborators.dispose).toHaveBeenCalledOnce()

    actor.send({ type: 'retry' })
    await waitFor(actor, snapshot => snapshot.matches('ready'))
    expect(actor.getSnapshot()).toMatchObject({
      value: 'ready',
      context: { collaborators: replacement, message: null },
    })
    expect(resetWorkspace).toHaveBeenCalledTimes(2)
    actor.stop()
  })
})
