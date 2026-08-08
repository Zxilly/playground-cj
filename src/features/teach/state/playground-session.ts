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
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import { create } from 'zustand'
import { createPlaygroundWorkspace } from './playground-workspace'
import {
  createIndexedDBPlaygroundWorkspaceStorage,
  PLAYGROUND_WORKSPACE_LIMITS,
} from './playground-workspace-storage'

export { PLAYGROUND_WORKSPACE_LIMITS as PLAYGROUND_SESSION_LIMITS }

/** One learner-visible scratch buffer. Persistence and run ownership stay hidden. */
export interface PlaygroundTab {
  id: string
  title: string
  initialCode: string
  titleVersion: string
  contentVersion: string
  result: RunResult | null
  running: boolean
}

export interface PlaygroundSession {
  tabs: PlaygroundTab[]
  activeTabId: string | null
  persistenceStatus: PlaygroundWorkspaceSnapshot['status']
  dirty: boolean
  persistenceError: PlaygroundWorkspaceError | null
  conflict: PlaygroundWorkspaceConflict | null
  openTab: (input?: { title?: string, code?: string }) => string | null
  selectTab: (tabId: string) => boolean
  closeTab: (tabId: string) => boolean
  renameTab: (tabId: string, title: string) => boolean
  updateCode: (
    tabId: string,
    code: string,
    expectedContentVersion?: string,
  ) => boolean
  runTab: (
    tabId: string,
    code: string,
    workspaceSignal: AbortSignal,
    run: (code: string, signal: AbortSignal) => Promise<RunResult>,
  ) => Promise<boolean>
  retryPersistence: () => void
  resolveConflict: (resolution: 'use_remote' | 'keep_copy') => string | null
  acquire: () => Promise<() => Promise<void>>
  close: () => Promise<void>
  whenPersistenceIdle: () => Promise<void>
  resetTransient: () => void
}

export interface CreatePlaygroundSessionOptions {
  createStorage?: () => PlaygroundWorkspaceStorage
  createId?: () => string
}

interface PlaygroundRuntime {
  workspace: PlaygroundWorkspace
  unsubscribe: () => void
}

interface ActiveRun {
  controller: AbortController
  contentVersion: string
  operationId: number
}

let nextRunOperationId = 1

function unavailableResult(error: unknown): RunResult {
  return {
    ok: false,
    phase: null,
    stdout: '',
    stdoutTruncated: false,
    stderr: '',
    stderrTruncated: false,
    compilerOutput: '',
    compilerOutputTruncated: false,
    exitCode: null,
    failureKind: 'runner_unavailable',
    failureMessage: error instanceof Error ? error.message : String(error),
  }
}

function mergeTabs(
  drafts: PlaygroundDraftTab[],
  previousTabs: PlaygroundTab[],
): PlaygroundTab[] {
  const previousById = new Map(previousTabs.map(tab => [tab.id, tab]))
  return drafts.map((draft) => {
    const previous = previousById.get(draft.id)
    const sameSource = previous?.contentVersion === draft.contentVersion
    return {
      id: draft.id,
      title: draft.title,
      initialCode: draft.code,
      titleVersion: draft.titleVersion,
      contentVersion: draft.contentVersion,
      result: sameSource ? previous?.result ?? null : null,
      running: sameSource ? previous?.running ?? false : false,
    }
  })
}

/**
 * Deep Playground session: owns persistence, CAS conflicts, run cancellation,
 * source-version observation, and runtime lifetime behind learner intents.
 */
export function createPlaygroundSession(
  options: CreatePlaygroundSessionOptions = {},
): UseBoundStore<StoreApi<PlaygroundSession>> {
  const createStorage = options.createStorage
    ?? (() => createIndexedDBPlaygroundWorkspaceStorage({ scope: 'workspace' }))
  let runtime: PlaygroundRuntime | null = null
  let startup: Promise<void> | null = null
  let closePromise: Promise<void> | null = null
  const owners = new Set<symbol>()
  const activeRuns = new Map<string, ActiveRun>()

  const session = create<PlaygroundSession>()((set, get) => ({
    tabs: [],
    activeTabId: null,
    persistenceStatus: 'closed',
    dirty: false,
    persistenceError: null,
    conflict: null,
    openTab: (input = {}) => runtime?.workspace.openTab(input) ?? null,
    selectTab: tabId => runtime?.workspace.selectTab(tabId) ?? false,
    closeTab: tabId => runtime?.workspace.closeTab(tabId) ?? false,
    renameTab: (tabId, title) => runtime?.workspace.renameTab(tabId, title) ?? false,
    updateCode: (tabId, code, expectedContentVersion) =>
      runtime?.workspace.setTabCode(tabId, code, expectedContentVersion) ?? false,
    runTab: async (tabId, code, workspaceSignal, run) => {
      const tab = get().tabs.find(candidate => candidate.id === tabId)
      if (!tab || tab.running || activeRuns.has(tabId))
        return false

      const operation: ActiveRun = {
        controller: new AbortController(),
        contentVersion: tab.contentVersion,
        operationId: nextRunOperationId++,
      }
      activeRuns.set(tabId, operation)
      set(state => ({
        tabs: state.tabs.map(candidate => candidate.id === tabId
          ? { ...candidate, running: true }
          : candidate),
      }))

      const signal = AbortSignal.any([
        workspaceSignal,
        operation.controller.signal,
      ])
      let result: RunResult | undefined
      try {
        result = await awaitWithSignal(run(code, signal), signal)
      }
      catch (error) {
        if (!signal.aborted)
          result = unavailableResult(error)
      }
      finally {
        const current = activeRuns.get(tabId)
        if (current?.operationId === operation.operationId) {
          activeRuns.delete(tabId)
          set(state => ({
            tabs: state.tabs.map(candidate =>
              candidate.id === tabId
              && candidate.contentVersion === operation.contentVersion
                ? {
                    ...candidate,
                    result: result ?? candidate.result,
                    running: false,
                  }
                : candidate),
          }))
        }
      }
      return true
    },
    retryPersistence: () => {
      if (get().persistenceStatus === 'error' && owners.size > 0) {
        void replaceFailedRuntime().catch(() => undefined)
      }
      else if (runtime && get().persistenceError === 'storage_unavailable') {
        runtime.workspace.retry()
      }
    },
    resolveConflict: resolution =>
      runtime?.workspace.resolveConflict(resolution) ?? null,
    acquire: async () => {
      const owner = Symbol('Playground session owner')
      owners.add(owner)
      try {
        await ensureRuntime()
      }
      catch (error) {
        owners.delete(owner)
        throw error
      }
      if (!owners.has(owner)) {
        if (owners.size === 0)
          await closeRuntime()
        return async () => {}
      }
      let released = false
      return async () => {
        if (released)
          return
        released = true
        owners.delete(owner)
        if (owners.size === 0)
          await closeRuntime()
      }
    },
    close: async () => {
      owners.clear()
      await closeRuntime()
    },
    whenPersistenceIdle: async () => {
      await startup
      await runtime?.workspace.whenIdle()
    },
    resetTransient: () => cancelAllRuns(),
  }))

  function cancelRun(tabId: string): void {
    const run = activeRuns.get(tabId)
    if (!run)
      return
    activeRuns.delete(tabId)
    run.controller.abort(new DOMException('Playground source changed', 'AbortError'))
    session.setState(state => ({
      tabs: state.tabs.map(tab => tab.id === tabId
        ? { ...tab, running: false }
        : tab),
    }))
  }

  function cancelAllRuns(): void {
    for (const tabId of [...activeRuns.keys()])
      cancelRun(tabId)
  }

  function publish(snapshot: PlaygroundWorkspaceSnapshot): void {
    for (const [tabId, run] of activeRuns) {
      const draft = snapshot.tabs.find(tab => tab.id === tabId)
      if (!draft || draft.contentVersion !== run.contentVersion)
        cancelRun(tabId)
    }
    session.setState(state => ({
      tabs: mergeTabs(snapshot.tabs, state.tabs),
      activeTabId: snapshot.selectedTabId,
      persistenceStatus: snapshot.status,
      dirty: snapshot.dirty,
      persistenceError: snapshot.error,
      conflict: snapshot.conflict,
    }))
  }

  function createRuntime(): PlaygroundRuntime {
    const workspace = createPlaygroundWorkspace({
      storage: createStorage(),
      createId: options.createId,
    })
    const unsubscribe = workspace.subscribe(() => publish(workspace.snapshot()))
    publish(workspace.snapshot())
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
    cancelAllRuns()
    const pendingStartup = startup
    closePromise = (async () => {
      await pendingStartup
      const closedCleanly = await target.workspace.close()
      if (!closedCleanly) {
        publish(target.workspace.snapshot())
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
        session.setState({
          persistenceStatus: 'closed',
          dirty: false,
          persistenceError: null,
          conflict: null,
        })
      }
    })
    return closePromise
  }

  async function replaceFailedRuntime(): Promise<void> {
    await closeRuntime()
    if (owners.size > 0)
      await ensureRuntime()
  }

  return session
}

export const usePlaygroundSession = createPlaygroundSession()
