import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PersistedPlaygroundWorkspace,
  PlaygroundWorkspaceStorage,
} from './playground-workspace-storage'
import type { PlaygroundSession } from './playground-session'
import type { StoreApi, UseBoundStore } from 'zustand'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  PLAYGROUND_WORKSPACE_LIMITS,
  PLAYGROUND_WORKSPACE_V2_DATABASE_NAME,
  PlaygroundWorkspaceRevisionConflictError,
} from './playground-workspace-storage'
import { createPlaygroundSession } from './playground-session'

describe('playground session', () => {
  let store: UseBoundStore<StoreApi<PlaygroundSession>>
  let release: (() => Promise<void>) | null
  let databaseName: string

  beforeEach(async () => {
    databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    store = createPlaygroundSession({
      createStorage: () =>
        createIndexedDBPlaygroundWorkspaceStorage({
          databaseName,
          scope: 'workspace',
        }),
    })
    release = await store.getState().acquire()
  })

  afterEach(async () => {
    await release?.()
    release = null
  })

  it('uses stable UUID tab identities and selects a neighbour on close', async () => {
    const first = store.getState().openTab({
      title: 'First',
      code: 'first()',
    })!
    const second = store.getState().openTab({
      title: 'Second',
      code: 'second()',
    })!
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(second).not.toBe(first)

    store.getState().updateCode(first, 'updated()')
    expect(store.getState().tabs.find(tab => tab.id === first)?.initialCode)
      .toBe('updated()')
    store.getState().closeTab(second)
    expect(store.getState().activeTabId).toBe(first)
    await store.getState().whenPersistenceIdle()
  })

  it('persists only editable data and never runner output', async () => {
    const id = store.getState().openTab({ code: 'main() {}' })!
    await store.getState().runTab(
      id,
      'main() {}',
      new AbortController().signal,
      async () => ({
        ok: true,
        phase: 'run',
        stdout: 'done',
        stdoutTruncated: false,
        stderr: 'compiler-private-output',
        stderrTruncated: false,
        compilerOutput: 'compiler-private-output',
        compilerOutputTruncated: false,
        exitCode: 0,
      }),
    )
    await store.getState().whenPersistenceIdle()

    const inspector = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName,
      scope: 'workspace',
    })
    const saved = await inspector.load()
    const serialized = JSON.stringify(saved)
    expect(saved?.tabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id, code: 'main() {}' }),
    ]))
    expect(serialized).not.toContain('done')
    expect(serialized).not.toContain('compiler-private-output')
    expect(saved?.tabs.find(tab => tab.id === id)).not.toHaveProperty('result')
    expect(saved?.tabs.find(tab => tab.id === id)).not.toHaveProperty('running')
    await inspector.close()
  })

  it('rejects over-budget mutations before they can enter the durable queue', () => {
    const id = store.getState().activeTabId!
    const previousCode = store.getState().tabs[0]!.initialCode

    expect(store.getState().updateCode(
      id,
      'x'.repeat(PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab + 1),
    )).toBe(false)

    expect(store.getState()).toMatchObject({
      dirty: false,
      persistenceError: 'code_too_large',
    })
    expect(store.getState().tabs[0]!.initialCode).toBe(previousCode)
  })

  it('enforces the tab-count budget without creating an unpersistable tab', () => {
    while (
      store.getState().tabs.length
      < PLAYGROUND_WORKSPACE_LIMITS.maxTabs
    ) {
      expect(store.getState().openTab()).not.toBeNull()
    }
    const ids = store.getState().tabs.map(tab => tab.id)

    expect(store.getState().openTab()).toBeNull()
    expect(store.getState().tabs.map(tab => tab.id)).toEqual(ids)
    expect(store.getState().persistenceError).toBe('too_many_tabs')
  })

  it('keeps a failed IndexedDB write dirty and supports an explicit retry', async () => {
    await release?.()
    release = null
    let rejectWrites = false
    const base = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName: `${databaseName}-retry`,
      scope: 'workspace',
    })
    const failingStorage: PlaygroundWorkspaceStorage = {
      ...base,
      save: (snapshot, expectedRevision) => rejectWrites
        ? Promise.reject(new DOMException('Storage disabled', 'UnknownError'))
        : base.save(snapshot, expectedRevision),
    }
    store = createPlaygroundSession({
      createStorage: () => failingStorage,
    })
    release = await store.getState().acquire()
    rejectWrites = true
    const id = store.getState().activeTabId!

    store.getState().updateCode(id, 'after()')
    await store.getState().whenPersistenceIdle()
    expect(store.getState()).toMatchObject({
      dirty: true,
      persistenceError: 'storage_unavailable',
    })

    rejectWrites = false
    store.getState().retryPersistence()
    await store.getState().whenPersistenceIdle()
    expect(store.getState()).toMatchObject({
      dirty: false,
      persistenceError: null,
    })
  })

  it('replaces a runtime whose initial storage open failed', async () => {
    await release?.()
    release = null
    const readyStorage = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName: `${databaseName}-recovered`,
      scope: 'workspace',
    })
    const failedStorage: PlaygroundWorkspaceStorage = {
      load: () => Promise.reject(new DOMException('Storage denied', 'UnknownError')),
      save: () => Promise.reject(new DOMException('Storage denied', 'UnknownError')),
      subscribe: () => () => {},
      close: () => Promise.resolve(),
    }
    const createStorage = vi.fn()
      .mockReturnValueOnce(failedStorage)
      .mockReturnValue(readyStorage)
    store = createPlaygroundSession({ createStorage })
    release = await store.getState().acquire()

    expect(store.getState().persistenceStatus).toBe('error')
    store.getState().retryPersistence()
    await vi.waitFor(() => {
      expect(createStorage).toHaveBeenCalledTimes(2)
      expect(store.getState().persistenceStatus).toBe('ready')
    })
  })

  it('resets transient runs without deleting drafts', async () => {
    const id = store.getState().openTab({ code: 'keep()' })!
    let signal!: AbortSignal
    void store.getState().runTab(
      id,
      'keep()',
      new AbortController().signal,
      (_, operationSignal) => {
        signal = operationSignal
        return new Promise(() => {})
      },
    )
    expect(store.getState().tabs.find(tab => tab.id === id)?.running).toBe(true)

    store.getState().resetTransient()

    expect(signal.aborted).toBe(true)
    expect(store.getState().activeTabId).toBe(id)
    expect(store.getState().tabs.find(tab => tab.id === id))
      .toMatchObject({ running: false, initialCode: 'keep()' })
  })

  it('uses opaque owners so forced close and stale releases cannot close a new runtime', async () => {
    const staleRelease = await store.getState().acquire()
    const firstRelease = release!

    await store.getState().close()
    expect(store.getState().persistenceStatus).toBe('closed')

    const currentRelease
      = await store.getState().acquire()
    expect(store.getState().persistenceStatus).toBe('ready')

    await firstRelease()
    release = null
    await staleRelease()
    expect(store.getState().persistenceStatus).toBe('ready')

    await currentRelease()
    expect(store.getState().persistenceStatus).toBe('closed')
  })

  it('does not read or rewrite an untrusted v1 localStorage snapshot', async () => {
    const legacy = JSON.stringify({
      tabs: [{
        id: 'playground-1',
        title: 'Legacy',
        initialCode: 'untrusted()',
      }],
    })
    localStorage.setItem('teach:playground-session:v1', legacy)
    await release?.()
    release = null

    const isolated = createPlaygroundSession({
      createStorage: () =>
        createIndexedDBPlaygroundWorkspaceStorage({
          databaseName: `${databaseName}-legacy-isolation`,
          scope: 'workspace',
        }),
    })
    const isolatedRelease
      = await isolated.getState().acquire()

    expect(isolated.getState().tabs).toHaveLength(1)
    expect(
      isolated.getState().tabs[0]!.initialCode,
    ).not.toContain('untrusted')
    expect(localStorage.getItem('teach:playground-session:v1')).toBe(legacy)
    await isolatedRelease()
  })

  it('keeps the storage owner alive until an in-flight CAS write settles', async () => {
    await release?.()
    release = null
    let finishSave!: () => void
    let holdNextSave = false
    const base = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName: `${databaseName}-lifecycle`,
      scope: 'workspace',
    })
    const close = vi.fn(base.close)
    const storage: PlaygroundWorkspaceStorage = {
      ...base,
      save: async (snapshot, expectedRevision) => {
        if (holdNextSave) {
          holdNextSave = false
          await new Promise<void>((resolve) => {
            finishSave = resolve
          })
        }
        await base.save(snapshot, expectedRevision)
      },
      close,
    }
    store = createPlaygroundSession({
      createStorage: () => storage,
    })
    release = await store.getState().acquire()
    holdNextSave = true
    const id = store.getState().activeTabId!
    store.getState().updateCode(id, 'owned until settled')
    await vi.waitFor(() => expect(finishSave).toBeTypeOf('function'))
    store.getState().updateCode(id, 'queued before release')

    const closing = release()
    release = null
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
    finishSave()
    await closing
    expect(close).toHaveBeenCalledOnce()

    const inspector = createIndexedDBPlaygroundWorkspaceStorage({
      databaseName: `${databaseName}-lifecycle`,
      scope: 'workspace',
    })
    expect((await inspector.load())?.tabs[0]?.code)
      .toBe('queued before release')
    await inspector.close()
  })

  it('retains an unsaved runtime across final release and remount after storage fails during close', async () => {
    let stored: Parameters<PlaygroundWorkspaceStorage['save']>[0] | null = null
    let rejectWrites = false
    let storageInstances = 0
    const close = vi.fn(async () => {})
    const isolated = createPlaygroundSession({
      createStorage: () => {
        storageInstances += 1
        return {
          load: async () => stored == null ? null : structuredClone(stored),
          save: async (snapshot, expectedRevision) => {
            if (rejectWrites)
              throw new DOMException('Storage disabled', 'UnknownError')
            expect(stored?.revision ?? 0).toBe(expectedRevision)
            stored = structuredClone(snapshot)
          },
          subscribe: () => () => {},
          close,
        }
      },
    })
    const firstRelease
      = await isolated.getState().acquire()
    const tabId = isolated.getState().activeTabId!
    rejectWrites = true
    expect(isolated.getState().updateCode(
      tabId,
      'recover after remount',
    )).toBe(true)

    await firstRelease()

    expect(close).not.toHaveBeenCalled()
    expect(storageInstances).toBe(1)
    expect(isolated.getState()).toMatchObject({
      persistenceStatus: 'ready',
      dirty: true,
      persistenceError: 'storage_unavailable',
    })

    const secondRelease
      = await isolated.getState().acquire()
    expect(storageInstances).toBe(1)
    expect(isolated.getState().tabs.find(tab => tab.id === tabId))
      .toMatchObject({ initialCode: 'recover after remount' })

    rejectWrites = false
    isolated.getState().retryPersistence()
    await isolated.getState().whenPersistenceIdle()
    await secondRelease()
    const committed = stored as PersistedPlaygroundWorkspace | null
    expect(committed?.tabs.find(tab => tab.id === tabId)?.code)
      .toBe('recover after remount')
    expect(close).toHaveBeenCalledOnce()
  })

  it('retains a conflicted runtime when the final release races a remote commit', async () => {
    let stored: Parameters<PlaygroundWorkspaceStorage['save']>[0] | null = null
    let holdNextSave = false
    let announceSaveStarted!: () => void
    const saveStarted = new Promise<void>((resolve) => {
      announceSaveStarted = resolve
    })
    let finishSave!: () => void
    let storageInstances = 0
    const close = vi.fn(async () => {})
    const isolated = createPlaygroundSession({
      createStorage: () => {
        storageInstances += 1
        return {
          load: async () => stored == null ? null : structuredClone(stored),
          save: async (snapshot, expectedRevision) => {
            if (holdNextSave) {
              holdNextSave = false
              await new Promise<void>((resolve) => {
                finishSave = resolve
                announceSaveStarted()
              })
            }
            const actualRevision = stored?.revision ?? 0
            if (actualRevision !== expectedRevision) {
              throw new PlaygroundWorkspaceRevisionConflictError(
                expectedRevision,
                actualRevision,
              )
            }
            stored = structuredClone(snapshot)
          },
          subscribe: () => () => {},
          close,
        }
      },
    })
    const firstRelease
      = await isolated.getState().acquire()
    const tabId = isolated.getState().activeTabId!
    const queuedTabId = isolated.getState().openTab({
      title: 'Queued while closing',
    })!
    await isolated.getState().whenPersistenceIdle()
    holdNextSave = true
    expect(isolated.getState().updateCode(
      tabId,
      'local close-race draft',
    )).toBe(true)
    await saveStarted
    expect(isolated.getState().updateCode(
      queuedTabId,
      'queued local draft',
    )).toBe(true)
    stored = {
      ...stored!,
      revision: stored!.revision + 1,
      tabs: stored!.tabs.map(tab => tab.id === tabId
        ? {
            ...tab,
            code: 'remote committed draft',
            contentVersion: crypto.randomUUID(),
          }
        : tab),
    }

    const closing = firstRelease()
    finishSave()
    await closing

    expect(close).not.toHaveBeenCalled()
    expect(storageInstances).toBe(1)
    expect(isolated.getState()).toMatchObject({
      persistenceStatus: 'ready',
      dirty: true,
      persistenceError: 'conflict',
      conflict: {
        tabId,
        localTab: { code: 'local close-race draft' },
        remoteTab: { code: 'remote committed draft' },
      },
    })

    const secondRelease
      = await isolated.getState().acquire()
    expect(storageInstances).toBe(1)
    expect(isolated.getState().conflict?.localTab.code)
      .toBe('local close-race draft')
    isolated.getState().resolveConflict('use_remote')
    await isolated.getState().whenPersistenceIdle()
    expect(stored?.tabs.find(tab => tab.id === queuedTabId)?.code)
      .toBe('queued local draft')
    await secondRelease()
    expect(close).toHaveBeenCalledOnce()
  })
})
