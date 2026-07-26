import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  parsePersistedPlaygroundWorkspace,
  PLAYGROUND_WORKSPACE_LIMITS,
  PLAYGROUND_WORKSPACE_V2_DATABASE_NAME,
  PlaygroundWorkspaceRevisionConflictError,
} from './playground-workspace-storage'

function validTab() {
  return {
    id: crypto.randomUUID(),
    title: 'Scratch',
    code: 'main() {}',
    titleVersion: crypto.randomUUID(),
    contentVersion: crypto.randomUUID(),
  }
}

function validWorkspace(revision = 1) {
  return {
    schemaVersion: 2 as const,
    revision,
    tabs: [validTab()],
  }
}

describe('playground v2 storage boundary', () => {
  it('accepts only the strict v2 schema and bounded UTF-8 payloads', () => {
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      legacyOutput: 'must not be accepted',
    })).toThrow()
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      schemaVersion: 1,
    })).toThrow()
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      tabs: [{ ...validTab(), running: false }],
    })).toThrow()
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      tabs: [{ ...validTab(), title: '   ' }],
    })).toThrow(/must not be blank/i)
    const duplicate = validTab()
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      tabs: [duplicate, { ...duplicate }],
    })).toThrow(/unique/i)
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      tabs: [{
        ...validTab(),
        title: '界'.repeat(
          Math.floor(PLAYGROUND_WORKSPACE_LIMITS.maxTitleBytes / 3) + 1,
        ),
      }],
    })).toThrow(/UTF-8 byte limit/i)
    expect(() => parsePersistedPlaygroundWorkspace({
      ...validWorkspace(),
      tabs: Array.from({ length: 4 }, () => ({
        ...validTab(),
        code: 'x'.repeat(
          PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab,
        ),
      })),
    })).toThrow(/workspace exceeds/i)
  })

  it('compares and advances revisions atomically', async () => {
    const databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    const first = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName,
      scope: 'workspace',
    })
    const second = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName,
      scope: 'workspace',
    })
    const revisionOne = validWorkspace()

    await first.save(revisionOne, 0)
    await expect(second.save({
      ...revisionOne,
      tabs: [validTab()],
    }, 0)).rejects.toEqual(
      new PlaygroundWorkspaceRevisionConflictError(0, 1),
    )
    await expect(
      second.save({ ...revisionOne, revision: 3 }, 1),
    ).rejects.toThrow(/candidate revision must be 2/i)
    expect(await second.load()).toEqual(revisionOne)

    await Promise.all([first.close(), second.close()])
  })

  it('keeps CAS storage usable when advisory notifications are unavailable', async () => {
    class UnavailableBroadcastChannel {
      constructor() {
        throw new DOMException('BroadcastChannel denied', 'SecurityError')
      }
    }
    vi.stubGlobal('BroadcastChannel', UnavailableBroadcastChannel)
    const storage = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName:
        `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`,
      scope: 'workspace',
    })
    const snapshot = validWorkspace()
    try {
      expect(storage.subscribe(() => {})).toBeTypeOf('function')
      await expect(storage.save(snapshot, 0)).resolves.toBeUndefined()
      await expect(storage.load()).resolves.toEqual(snapshot)
    }
    finally {
      await storage.close()
      vi.unstubAllGlobals()
    }
  })
})
