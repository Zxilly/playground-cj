'use client'

import type { StoreApi, UseBoundStore } from 'zustand'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import type {
  PlaygroundDraftTab,
  PlaygroundWorkspace,
  PlaygroundWorkspaceConflict,
  PlaygroundWorkspaceError,
  PlaygroundWorkspaceSnapshot,
} from './playground-workspace'
import type { PlaygroundWorkspaceStorage } from './playground-workspace-storage'
import { create } from 'zustand'
import { createPlaygroundWorkspace } from './playground-workspace'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  PLAYGROUND_WORKSPACE_LIMITS,
} from './playground-workspace-storage'

export { PLAYGROUND_WORKSPACE_LIMITS as PLAYGROUND_SESSION_LIMITS }

/** One logical scratch buffer; runner state remains process-local. */
export interface PlaygroundTab {
  id: string
  title: string
  initialCode: string
  titleVersion: string
  contentVersion: string
  result: RunResult | null
  running: boolean
  runOperationId: string | null
  runOwnerEpoch: number | null
}

export type WorkspaceView = 'live' | 'review' | 'progress' | 'playground'
export type PlaygroundPersistenceError = PlaygroundWorkspaceError

export interface WorkspaceStore {
  view: WorkspaceView
  reviewConceptId: string | null
  reviewContentVersion: string | null
  pendingPrefill: string | null
  playgroundTabs: PlaygroundTab[]
  currentPlaygroundTabId: string | null
  playgroundPersistenceStatus: PlaygroundWorkspaceSnapshot['status']
  playgroundSessionRevision: number
  playgroundSessionDirty: boolean
  playgroundPersistenceError: PlaygroundPersistenceError | null
  playgroundConflict: PlaygroundWorkspaceConflict | null
  setView: (view: WorkspaceView) => void
  openReviewConcept: (conceptId: string) => void
  setReviewContentVersion: (contentVersion: string) => void
  openPlaygroundTab: (
    input?: { title?: string, code?: string },
  ) => string | null
  selectPlaygroundTab: (tabId: string) => boolean
  closePlaygroundTab: (tabId: string) => boolean
  renamePlaygroundTab: (tabId: string, title: string) => boolean
  beginPlaygroundTabRun: (tabId: string, ownerEpoch: number) => string | null
  finishPlaygroundTabRun: (
    tabId: string,
    operationId: string,
    result?: RunResult,
  ) => void
  releasePlaygroundRunOwner: (ownerEpoch: number) => void
  setPlaygroundTabCode: (
    tabId: string,
    code: string,
    expectedContentVersion?: string,
  ) => boolean
  retryPlaygroundPersistence: () => void
  resolvePlaygroundConflict: (
    resolution: 'use_remote' | 'keep_copy',
  ) => string | null
  acquirePlaygroundPersistence: () => Promise<() => Promise<void>>
  closePlaygroundPersistence: () => Promise<void>
  waitForPlaygroundPersistence: () => Promise<void>
  setPendingPrefill: (prompt: string) => void
  consumePrefill: () => string | null
  reset: () => void
}

export interface CreateWorkspaceStoreOptions {
  createPlaygroundStorage?: () => PlaygroundWorkspaceStorage
  createId?: () => string
}

interface PlaygroundRuntime {
  workspace: PlaygroundWorkspace
  unsubscribe: () => void
}

let nextPlaygroundRunOperation = 1

function mergePlaygroundTabs(
  drafts: PlaygroundDraftTab[],
  previousTabs: PlaygroundTab[],
): PlaygroundTab[] {
  const previousById = new Map(previousTabs.map(tab => [tab.id, tab]))
  return drafts.map((draft) => {
    const previous = previousById.get(draft.id)
    const sameSource
      = previous?.contentVersion === draft.contentVersion
    return {
      id: draft.id,
      title: draft.title,
      initialCode: draft.code,
      titleVersion: draft.titleVersion,
      contentVersion: draft.contentVersion,
      result: sameSource ? previous?.result ?? null : null,
      running: sameSource ? previous?.running ?? false : false,
      runOperationId: sameSource ? previous?.runOperationId ?? null : null,
      runOwnerEpoch: sameSource ? previous?.runOwnerEpoch ?? null : null,
    }
  })
}

export function createWorkspaceStore(
  options: CreateWorkspaceStoreOptions = {},
): UseBoundStore<StoreApi<WorkspaceStore>> {
  const createStorage = options.createPlaygroundStorage
    ?? (() => createIndexedDBPlaygroundWorkspaceStorage({
      scope: 'workspace',
    }))
  let runtime: PlaygroundRuntime | null = null
  let startup: Promise<void> | null = null
  let closePromise: Promise<void> | null = null
  const persistenceOwners = new Set<symbol>()

  const store = create<WorkspaceStore>()((set, get) => ({
    view: 'live',
    reviewConceptId: null,
    reviewContentVersion: null,
    pendingPrefill: null,
    playgroundTabs: [],
    currentPlaygroundTabId: null,
    playgroundPersistenceStatus: 'closed',
    playgroundSessionRevision: 0,
    playgroundSessionDirty: false,
    playgroundPersistenceError: null,
    playgroundConflict: null,
    setView: view => set({ view }),
    openReviewConcept: conceptId => set(state => ({
      view: 'review',
      reviewConceptId: conceptId,
      reviewContentVersion: state.reviewConceptId === conceptId
        ? state.reviewContentVersion
        : null,
    })),
    setReviewContentVersion: contentVersion => set({
      reviewContentVersion: contentVersion,
    }),
    openPlaygroundTab: (input = {}) => {
      if (!runtime || get().playgroundPersistenceStatus !== 'ready')
        return null
      const id = runtime.workspace.openTab(input)
      if (!id)
        return null
      set({ view: 'playground' })
      return id
    },
    selectPlaygroundTab: tabId => runtime?.workspace.selectTab(tabId) ?? false,
    closePlaygroundTab: tabId => runtime?.workspace.closeTab(tabId) ?? false,
    renamePlaygroundTab: (tabId, title) =>
      runtime?.workspace.renameTab(tabId, title) ?? false,
    beginPlaygroundTabRun: (tabId, ownerEpoch) => {
      if (!Number.isSafeInteger(ownerEpoch) || ownerEpoch < 1)
        return null
      let operationId: string | null = null
      set(state => ({
        playgroundTabs: state.playgroundTabs.map((tab) => {
          if (tab.id !== tabId || tab.running)
            return tab
          operationId = `playground-run-${nextPlaygroundRunOperation++}`
          return {
            ...tab,
            running: true,
            runOperationId: operationId,
            runOwnerEpoch: ownerEpoch,
          }
        }),
      }))
      return operationId
    },
    finishPlaygroundTabRun: (tabId, operationId, result) => set(state => ({
      playgroundTabs: state.playgroundTabs.map(tab =>
        tab.id === tabId && tab.runOperationId === operationId
          ? {
              ...tab,
              result: result ?? tab.result,
              running: false,
              runOperationId: null,
              runOwnerEpoch: null,
            }
          : tab),
    })),
    releasePlaygroundRunOwner: ownerEpoch => set(state => ({
      playgroundTabs: state.playgroundTabs.map(tab =>
        tab.runOwnerEpoch === ownerEpoch
          ? {
              ...tab,
              running: false,
              runOperationId: null,
              runOwnerEpoch: null,
            }
          : tab),
    })),
    setPlaygroundTabCode: (tabId, code, expectedContentVersion) =>
      runtime?.workspace.setTabCode(
        tabId,
        code,
        expectedContentVersion,
      ) ?? false,
    retryPlaygroundPersistence: () => {
      if (
        get().playgroundPersistenceStatus === 'error'
        && persistenceOwners.size > 0
      ) {
        void replaceFailedRuntime()
      }
      else if (
        runtime
        && get().playgroundPersistenceError === 'storage_unavailable'
      ) {
        runtime.workspace.retry()
      }
    },
    resolvePlaygroundConflict: resolution =>
      runtime?.workspace.resolveConflict(resolution) ?? null,
    acquirePlaygroundPersistence: async () => {
      const owner = Symbol('Playground persistence owner')
      persistenceOwners.add(owner)
      try {
        await ensureRuntime()
      }
      catch (error) {
        persistenceOwners.delete(owner)
        throw error
      }
      if (!persistenceOwners.has(owner)) {
        if (persistenceOwners.size === 0)
          await closeRuntime()
        return async () => {}
      }
      let released = false
      return async () => {
        if (released)
          return
        released = true
        persistenceOwners.delete(owner)
        if (persistenceOwners.size === 0)
          await closeRuntime()
      }
    },
    closePlaygroundPersistence: async () => {
      persistenceOwners.clear()
      await closeRuntime()
    },
    waitForPlaygroundPersistence: async () => {
      await startup
      await runtime?.workspace.whenIdle()
    },
    setPendingPrefill: prompt => set({ pendingPrefill: prompt }),
    consumePrefill: () => {
      const prompt = get().pendingPrefill
      if (prompt !== null)
        set({ pendingPrefill: null })
      return prompt
    },
    reset: () => set(state => ({
      view: 'live',
      reviewConceptId: null,
      reviewContentVersion: null,
      pendingPrefill: null,
      playgroundTabs: state.playgroundTabs.map(tab => ({
        ...tab,
        running: false,
        runOperationId: null,
        runOwnerEpoch: null,
      })),
    })),
  }))

  function publishWorkspaceSnapshot(snapshot: PlaygroundWorkspaceSnapshot) {
    store.setState(state => ({
      playgroundTabs: mergePlaygroundTabs(snapshot.tabs, state.playgroundTabs),
      currentPlaygroundTabId: snapshot.selectedTabId,
      playgroundPersistenceStatus: snapshot.status,
      playgroundSessionRevision: snapshot.revision,
      playgroundSessionDirty: snapshot.dirty,
      playgroundPersistenceError: snapshot.error,
      playgroundConflict: snapshot.conflict,
    }))
  }

  function createRuntime(): PlaygroundRuntime {
    const workspace = createPlaygroundWorkspace({
      storage: createStorage(),
      createId: options.createId,
    })
    const unsubscribe = workspace.subscribe(() => {
      publishWorkspaceSnapshot(workspace.snapshot())
    })
    publishWorkspaceSnapshot(workspace.snapshot())
    return { workspace, unsubscribe }
  }

  async function ensureRuntime(): Promise<void> {
    if (closePromise)
      await closePromise
    runtime ??= createRuntime()
    if (!startup) {
      const target = runtime
      startup = target.workspace.open()
        .catch(() => undefined)
        .finally(() => {
          if (runtime === target)
            startup = null
        })
    }
    await startup
  }

  async function closeRuntime(): Promise<void> {
    if (closePromise)
      return closePromise
    const target = runtime
    if (!target)
      return
    const pendingStartup = startup
    closePromise = (async () => {
      await pendingStartup
      const closedCleanly = await target.workspace.close()
      if (!closedCleanly) {
        publishWorkspaceSnapshot(target.workspace.snapshot())
        return
      }
      target.unsubscribe()
      if (runtime === target) {
        runtime = null
        startup = null
      }
    })().finally(() => {
      closePromise = null
      if (runtime === null) {
        store.setState({
          playgroundPersistenceStatus: 'closed',
          playgroundSessionDirty: false,
          playgroundPersistenceError: null,
          playgroundConflict: null,
        })
      }
    })
    return closePromise
  }

  async function replaceFailedRuntime(): Promise<void> {
    await closeRuntime()
    if (persistenceOwners.size > 0)
      await ensureRuntime()
  }

  return store
}

export const useWorkspaceStore = createWorkspaceStore()
