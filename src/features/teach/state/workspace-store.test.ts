import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PersistedPlaygroundWorkspace,
  PlaygroundWorkspaceStorage,
} from './playground-workspace-storage'
import type { WorkspaceStore } from './workspace-store'
import type { StoreApi, UseBoundStore } from 'zustand'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  PLAYGROUND_WORKSPACE_LIMITS,
  PLAYGROUND_WORKSPACE_V2_DATABASE_NAME,
  PlaygroundWorkspaceRevisionConflictError,
} from './playground-workspace-storage'
import { createWorkspaceStore } from './workspace-store'

describe('aI Classroom workspace store', () => {
  let store: UseBoundStore<StoreApi<WorkspaceStore>>
  let release: (() => Promise<void>) | null
  let databaseName: string

  beforeEach(async () => {
    databaseName
      = `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}-test-${crypto.randomUUID()}`
    store = createWorkspaceStore({
      createPlaygroundStorage: () =>
        createIndexedDBPlaygroundWorkspaceStorage({
          databaseName,
          scope: 'workspace',
        }),
    })
    release = await store.getState().acquirePlaygroundPersistence()
  })

  afterEach(async () => {
    await release?.()
    release = null
  })

  it('contains only canonical classroom views', () => {
    expect(store.getState().view).toBe('live')
    for (const view of ['live', 'review', 'progress', 'playground'] as const) {
      store.getState().setView(view)
      expect(store.getState().view).toBe(view)
    }
  })

  it('opens Review View for one Concept', () => {
    store.getState().openReviewConcept('cj.var.immutable')
    expect(store.getState()).toMatchObject({
      view: 'review',
      reviewConceptId: 'cj.var.immutable',
      reviewContentVersion: null,
    })
    store.getState().setReviewContentVersion('cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    store.getState().openReviewConcept('cj.var.immutable')
    expect(store.getState().reviewContentVersion).toBe('cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    store.getState().openReviewConcept('cj.program.main')
    expect(store.getState().reviewContentVersion).toBeNull()
  })

  it('uses stable UUID tab identities and selects a neighbour on close', async () => {
    const first = store.getState().openPlaygroundTab({
      title: 'First',
      code: 'first()',
    })!
    const second = store.getState().openPlaygroundTab({
      title: 'Second',
      code: 'second()',
    })!
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(second).not.toBe(first)

    store.getState().setPlaygroundTabCode(first, 'updated()')
    expect(store.getState().playgroundTabs.find(tab => tab.id === first)?.initialCode)
      .toBe('updated()')
    store.getState().closePlaygroundTab(second)
    expect(store.getState().currentPlaygroundTabId).toBe(first)
    await store.getState().waitForPlaygroundPersistence()
  })

  it('persists only editable data and never runner output', async () => {
    const id = store.getState().openPlaygroundTab({ code: 'main() {}' })!
    const operationId = store.getState().beginPlaygroundTabRun(id, 1)
    expect(operationId).not.toBeNull()
    store.getState().finishPlaygroundTabRun(id, operationId!, {
      ok: true,
      phase: 'run',
      stdout: 'done',
      stdoutTruncated: false,
      stderr: 'compiler-private-output',
      stderrTruncated: false,
      compilerOutput: 'compiler-private-output',
      compilerOutputTruncated: false,
      exitCode: 0,
    })
    await store.getState().waitForPlaygroundPersistence()

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
    const id = store.getState().currentPlaygroundTabId!
    const previousCode = store.getState().playgroundTabs[0]!.initialCode

    expect(store.getState().setPlaygroundTabCode(
      id,
      'x'.repeat(PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab + 1),
    )).toBe(false)

    expect(store.getState()).toMatchObject({
      playgroundSessionDirty: false,
      playgroundPersistenceError: 'code_too_large',
    })
    expect(store.getState().playgroundTabs[0]!.initialCode).toBe(previousCode)
  })

  it('enforces the tab-count budget without creating an unpersistable tab', () => {
    while (
      store.getState().playgroundTabs.length
      < PLAYGROUND_WORKSPACE_LIMITS.maxTabs
    ) {
      expect(store.getState().openPlaygroundTab()).not.toBeNull()
    }
    const ids = store.getState().playgroundTabs.map(tab => tab.id)

    expect(store.getState().openPlaygroundTab()).toBeNull()
    expect(store.getState().playgroundTabs.map(tab => tab.id)).toEqual(ids)
    expect(store.getState().playgroundPersistenceError).toBe('too_many_tabs')
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
    store = createWorkspaceStore({
      createPlaygroundStorage: () => failingStorage,
    })
    release = await store.getState().acquirePlaygroundPersistence()
    rejectWrites = true
    const id = store.getState().currentPlaygroundTabId!

    store.getState().setPlaygroundTabCode(id, 'after()')
    await store.getState().waitForPlaygroundPersistence()
    expect(store.getState()).toMatchObject({
      playgroundSessionDirty: true,
      playgroundPersistenceError: 'storage_unavailable',
    })

    rejectWrites = false
    store.getState().retryPlaygroundPersistence()
    await store.getState().waitForPlaygroundPersistence()
    expect(store.getState()).toMatchObject({
      playgroundSessionDirty: false,
      playgroundPersistenceError: null,
    })
  })

  it('consumes a temporary Chat prefill exactly once', () => {
    store.getState().setPendingPrefill('Start the next step')
    expect(store.getState().consumePrefill()).toBe('Start the next step')
    expect(store.getState().consumePrefill()).toBeNull()
  })

  it('resets navigation without deleting Playground drafts', () => {
    const id = store.getState().openPlaygroundTab({ code: 'keep()' })!
    store.getState().beginPlaygroundTabRun(id, 1)
    store.getState().openReviewConcept('cj.program.main')
    store.getState().setPendingPrefill('pending')
    store.getState().reset()
    expect(store.getState()).toMatchObject({
      view: 'live',
      reviewConceptId: null,
      reviewContentVersion: null,
      pendingPrefill: null,
      currentPlaygroundTabId: id,
    })
    expect(store.getState().playgroundTabs.find(tab => tab.id === id))
      .toMatchObject({
        running: false,
        runOperationId: null,
        runOwnerEpoch: null,
      })
  })

  it('uses opaque owners so forced close and stale releases cannot close a new runtime', async () => {
    const staleRelease = await store.getState().acquirePlaygroundPersistence()
    const firstRelease = release!

    await store.getState().closePlaygroundPersistence()
    expect(store.getState().playgroundPersistenceStatus).toBe('closed')

    const currentRelease
      = await store.getState().acquirePlaygroundPersistence()
    expect(store.getState().playgroundPersistenceStatus).toBe('ready')

    await firstRelease()
    release = null
    await staleRelease()
    expect(store.getState().playgroundPersistenceStatus).toBe('ready')

    await currentRelease()
    expect(store.getState().playgroundPersistenceStatus).toBe('closed')
  })

  it('does not read or rewrite an untrusted v1 localStorage snapshot', async () => {
    const legacy = JSON.stringify({
      playgroundTabs: [{
        id: 'playground-1',
        title: 'Legacy',
        initialCode: 'untrusted()',
      }],
    })
    localStorage.setItem('teach:playground-session:v1', legacy)
    await release?.()
    release = null

    const isolated = createWorkspaceStore({
      createPlaygroundStorage: () =>
        createIndexedDBPlaygroundWorkspaceStorage({
          databaseName: `${databaseName}-legacy-isolation`,
          scope: 'workspace',
        }),
    })
    const isolatedRelease
      = await isolated.getState().acquirePlaygroundPersistence()

    expect(isolated.getState().playgroundTabs).toHaveLength(1)
    expect(
      isolated.getState().playgroundTabs[0]!.initialCode,
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
    store = createWorkspaceStore({
      createPlaygroundStorage: () => storage,
    })
    release = await store.getState().acquirePlaygroundPersistence()
    holdNextSave = true
    const id = store.getState().currentPlaygroundTabId!
    store.getState().setPlaygroundTabCode(id, 'owned until settled')
    await vi.waitFor(() => expect(finishSave).toBeTypeOf('function'))
    store.getState().setPlaygroundTabCode(id, 'queued before release')

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
    const isolated = createWorkspaceStore({
      createPlaygroundStorage: () => {
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
      = await isolated.getState().acquirePlaygroundPersistence()
    const tabId = isolated.getState().currentPlaygroundTabId!
    rejectWrites = true
    expect(isolated.getState().setPlaygroundTabCode(
      tabId,
      'recover after remount',
    )).toBe(true)

    await firstRelease()

    expect(close).not.toHaveBeenCalled()
    expect(storageInstances).toBe(1)
    expect(isolated.getState()).toMatchObject({
      playgroundPersistenceStatus: 'ready',
      playgroundSessionDirty: true,
      playgroundPersistenceError: 'storage_unavailable',
    })

    const secondRelease
      = await isolated.getState().acquirePlaygroundPersistence()
    expect(storageInstances).toBe(1)
    expect(isolated.getState().playgroundTabs.find(tab => tab.id === tabId))
      .toMatchObject({ initialCode: 'recover after remount' })

    rejectWrites = false
    isolated.getState().retryPlaygroundPersistence()
    await isolated.getState().waitForPlaygroundPersistence()
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
    const isolated = createWorkspaceStore({
      createPlaygroundStorage: () => {
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
      = await isolated.getState().acquirePlaygroundPersistence()
    const tabId = isolated.getState().currentPlaygroundTabId!
    const queuedTabId = isolated.getState().openPlaygroundTab({
      title: 'Queued while closing',
    })!
    await isolated.getState().waitForPlaygroundPersistence()
    holdNextSave = true
    expect(isolated.getState().setPlaygroundTabCode(
      tabId,
      'local close-race draft',
    )).toBe(true)
    await saveStarted
    expect(isolated.getState().setPlaygroundTabCode(
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
      playgroundPersistenceStatus: 'ready',
      playgroundSessionDirty: true,
      playgroundPersistenceError: 'conflict',
      playgroundConflict: {
        tabId,
        localTab: { code: 'local close-race draft' },
        remoteTab: { code: 'remote committed draft' },
      },
    })

    const secondRelease
      = await isolated.getState().acquirePlaygroundPersistence()
    expect(storageInstances).toBe(1)
    expect(isolated.getState().playgroundConflict?.localTab.code)
      .toBe('local close-race draft')
    isolated.getState().resolvePlaygroundConflict('use_remote')
    await isolated.getState().waitForPlaygroundPersistence()
    expect(stored?.tabs.find(tab => tab.id === queuedTabId)?.code)
      .toBe('queued local draft')
    await secondRelease()
    expect(close).toHaveBeenCalledOnce()
  })
})
