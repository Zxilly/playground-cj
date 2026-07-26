import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceCollaborators } from './workspace-collaborators'
import { teachRuntimeMachine } from './teach-runtime-machine'

describe('teach runtime machine', () => {
  it('owns loading, ready, storage failure, and retry transitions', () => {
    const collaborators = {
      dispose: vi.fn(async () => undefined),
    } as unknown as WorkspaceCollaborators
    const actor = createActor(teachRuntimeMachine).start()

    expect(actor.getSnapshot()).toMatchObject({
      value: 'loading',
      context: { generation: 0, collaborators: null, message: null },
    })

    actor.send({ type: 'open.succeeded', collaborators })
    expect(actor.getSnapshot()).toMatchObject({
      value: 'ready',
      context: { collaborators },
    })

    actor.send({ type: 'storage.failed', message: 'IndexedDB failed' })
    expect(actor.getSnapshot()).toMatchObject({
      value: 'error',
      context: { collaborators: null, message: 'IndexedDB failed' },
    })

    actor.send({ type: 'retry' })
    expect(actor.getSnapshot()).toMatchObject({
      value: 'loading',
      context: { generation: 1, collaborators: null, message: null },
    })
    actor.stop()
  })
})
