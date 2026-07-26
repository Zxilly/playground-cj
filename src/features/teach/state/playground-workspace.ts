import { z } from 'zod'
import type {
  PersistedPlaygroundTab,
  PersistedPlaygroundWorkspace,
  PlaygroundWorkspaceStorage,
} from './playground-workspace-storage'
import {
  parsePersistedPlaygroundWorkspace,
  PLAYGROUND_WORKSPACE_LIMITS,
  PlaygroundWorkspaceRevisionConflictError,
} from './playground-workspace-storage'

const DEFAULT_PLAYGROUND_CODE = `package playground

main(): Int64 {
    println("你好，仓颉！")
    return 0
}`

export interface PlaygroundDraftTab {
  id: string
  title: string
  code: string
  titleVersion: string
  contentVersion: string
}

export type PlaygroundWorkspaceError
  = | 'too_many_tabs'
    | 'title_too_large'
    | 'code_too_large'
    | 'workspace_too_large'
    | 'pending_changes_limit'
    | 'corrupt_workspace'
    | 'storage_unavailable'
    | 'conflict'

export interface PlaygroundWorkspaceConflict {
  tabId: string
  kind: 'content' | 'title' | 'deleted' | 'close' | 'capacity'
  localTab: PlaygroundDraftTab
  remoteTab: PlaygroundDraftTab | null
}

export interface PlaygroundWorkspaceSnapshot {
  status: 'closed' | 'opening' | 'ready' | 'error'
  revision: number
  tabs: PlaygroundDraftTab[]
  selectedTabId: string | null
  dirty: boolean
  error: PlaygroundWorkspaceError | null
  conflict: PlaygroundWorkspaceConflict | null
}

type Mutation
  = {
    type: 'add'
    tab: PersistedPlaygroundTab
  }
  | {
    type: 'set_code'
    tabId: string
    baseTab: PersistedPlaygroundTab
    expectedContentVersion: string
    contentVersion: string
    code: string
  }
  | {
    type: 'rename'
    tabId: string
    baseTab: PersistedPlaygroundTab
    expectedTitleVersion: string
    titleVersion: string
    title: string
  }
  | {
    type: 'close'
    tabId: string
    baseTab: PersistedPlaygroundTab
    expectedTitleVersion: string
    expectedContentVersion: string
  }

class PlaygroundMutationConflictError extends Error {
  readonly tabId: string
  readonly kind: PlaygroundWorkspaceConflict['kind']

  constructor(
    tabId: string,
    kind: PlaygroundWorkspaceConflict['kind'],
  ) {
    super(`Playground ${kind} conflict for tab ${tabId}`)
    this.name = 'PlaygroundMutationConflictError'
    this.tabId = tabId
    this.kind = kind
  }
}

export interface CreatePlaygroundWorkspaceOptions {
  storage: PlaygroundWorkspaceStorage
  createId?: () => string
}

export interface PlaygroundWorkspace {
  snapshot: () => PlaygroundWorkspaceSnapshot
  subscribe: (listener: () => void) => () => void
  open: () => Promise<void>
  refresh: () => Promise<void>
  openTab: (input?: { title?: string, code?: string }) => string | null
  selectTab: (tabId: string) => boolean
  closeTab: (tabId: string) => boolean
  renameTab: (tabId: string, title: string) => boolean
  setTabCode: (
    tabId: string,
    code: string,
    expectedContentVersion?: string,
  ) => boolean
  retry: () => void
  resolveConflict: (resolution: 'use_remote' | 'keep_copy') => string | null
  whenIdle: () => Promise<void>
  /**
   * Closes the storage runtime only when every accepted mutation is durable.
   * Returns false when a recoverable conflict or storage failure still owns
   * local work; callers must retain this runtime for a later retry/remount.
   */
  close: () => Promise<boolean>
}

function cloneTab(tab: PersistedPlaygroundTab): PlaygroundDraftTab {
  return { ...tab }
}

function emptySnapshot(): PlaygroundWorkspaceSnapshot {
  return {
    status: 'closed',
    revision: 0,
    tabs: [],
    selectedTabId: null,
    dirty: false,
    error: null,
    conflict: null,
  }
}

function applyMutation(
  base: PersistedPlaygroundWorkspace,
  mutation: Mutation,
  strict: boolean,
): PersistedPlaygroundWorkspace {
  const tabs = base.tabs.map(tab => ({ ...tab }))
  if (mutation.type === 'add') {
    if (tabs.some(tab => tab.id === mutation.tab.id)) {
      throw new PlaygroundMutationConflictError(
        mutation.tab.id,
        'content',
      )
    }
    tabs.push({ ...mutation.tab })
  }
  else {
    let index = tabs.findIndex(tab => tab.id === mutation.tabId)
    if (index < 0) {
      if (mutation.type === 'close') {
        if (strict) {
          return parsePersistedPlaygroundWorkspace({
            schemaVersion: 2,
            revision: base.revision + 1,
            tabs,
          })
        }
      }
      else if (!strict) {
        tabs.push({ ...mutation.baseTab })
        index = tabs.length - 1
      }
      else {
        throw new PlaygroundMutationConflictError(mutation.tabId, 'deleted')
      }
    }
    if (index < 0) {
      return parsePersistedPlaygroundWorkspace({
        schemaVersion: 2,
        revision: base.revision + 1,
        tabs,
      })
    }
    const tab = tabs[index]!
    if (mutation.type === 'set_code') {
      if (strict && tab.contentVersion !== mutation.expectedContentVersion) {
        throw new PlaygroundMutationConflictError(mutation.tabId, 'content')
      }
      tabs[index] = {
        ...tab,
        code: mutation.code,
        contentVersion: mutation.contentVersion,
      }
    }
    else if (mutation.type === 'rename') {
      if (strict && tab.titleVersion !== mutation.expectedTitleVersion)
        throw new PlaygroundMutationConflictError(mutation.tabId, 'title')
      tabs[index] = {
        ...tab,
        title: mutation.title,
        titleVersion: mutation.titleVersion,
      }
    }
    else {
      if (
        strict
        && (
          tab.titleVersion !== mutation.expectedTitleVersion
          || tab.contentVersion !== mutation.expectedContentVersion
        )
      ) {
        throw new PlaygroundMutationConflictError(mutation.tabId, 'close')
      }
      tabs.splice(index, 1)
    }
  }
  return parsePersistedPlaygroundWorkspace({
    schemaVersion: 2,
    revision: base.revision + 1,
    tabs,
  })
}

function mutationTabId(mutation: Mutation): string {
  return mutation.type === 'add' ? mutation.tab.id : mutation.tabId
}

function mutationLocalTab(mutation: Mutation): PlaygroundDraftTab {
  if (mutation.type === 'add')
    return cloneTab(mutation.tab)
  if (mutation.type === 'set_code') {
    return {
      ...mutation.baseTab,
      code: mutation.code,
      contentVersion: mutation.contentVersion,
    }
  }
  if (mutation.type === 'rename') {
    return {
      ...mutation.baseTab,
      title: mutation.title,
      titleVersion: mutation.titleVersion,
    }
  }
  return cloneTab(mutation.baseTab)
}

function classifyValidationError(error: z.ZodError): PlaygroundWorkspaceError {
  const issue = error.issues[0]
  const message = issue?.message ?? ''
  if (issue?.path.includes('title') || message.includes('title'))
    return 'title_too_large'
  if (issue?.path.includes('code') || message.includes('code'))
    return 'code_too_large'
  if (
    issue?.path.length === 1
    && issue.path[0] === 'tabs'
    && issue.code === 'too_big'
  ) {
    return 'too_many_tabs'
  }
  return 'workspace_too_large'
}

export function createPlaygroundWorkspace(
  options: CreatePlaygroundWorkspaceOptions,
): PlaygroundWorkspace {
  const createId = options.createId ?? (() => crypto.randomUUID())
  let state = emptySnapshot()
  let durable: PersistedPlaygroundWorkspace | null = null
  let selectedTabId: string | null = null
  let unsubscribeStorage: (() => void) | null = null
  let requestedRevision = 0
  let refreshRequested = false
  let opening: Promise<void> | null = null
  let worker: Promise<void> | null = null
  let closeOperation: Promise<boolean> | null = null
  let activeMutation: Mutation | null = null
  let blockedMutation: Mutation | null = null
  const deferredMutations: Mutation[] = []
  let closing = false
  let closed = false
  const mutations: Mutation[] = []
  const listeners = new Set<() => void>()

  function emit(): void {
    for (const listener of listeners)
      listener()
  }

  function projectedWorkspace(): PersistedPlaygroundWorkspace | null {
    if (!durable)
      return null
    let projected = durable
    for (const mutation of mutations)
      projected = applyMutation(projected, mutation, false)
    return projected
  }

  function publish(): void {
    const projected = projectedWorkspace()
    const tabs = projected?.tabs.map(cloneTab) ?? []
    if (!selectedTabId || !tabs.some(tab => tab.id === selectedTabId))
      selectedTabId = tabs[0]?.id ?? null
    state = {
      ...state,
      revision: durable?.revision ?? 0,
      tabs,
      selectedTabId,
      dirty: (
        mutations.length > 0
        || blockedMutation !== null
        || deferredMutations.length > 0
      ),
    }
    emit()
  }

  function requireReady(): PersistedPlaygroundWorkspace {
    if (state.status !== 'ready' || !durable || closing || closed)
      throw new Error('Playground workspace is not ready')
    return projectedWorkspace()!
  }

  function setValidationError(error: unknown): boolean {
    if (!(error instanceof z.ZodError))
      return false
    state = {
      ...state,
      error: state.conflict ? 'conflict' : classifyValidationError(error),
    }
    emit()
    return true
  }

  function updateConflictDraft(mutation: Mutation): boolean {
    const conflict = state.conflict
    if (
      !conflict
      || mutationTabId(mutation) !== conflict.tabId
      || mutation.type === 'add'
      || mutation.type === 'close'
    ) {
      return false
    }
    const localTab: PlaygroundDraftTab = mutation.type === 'set_code'
      ? {
          ...conflict.localTab,
          code: mutation.code,
          contentVersion: mutation.contentVersion,
        }
      : {
          ...conflict.localTab,
          title: mutation.title,
          titleVersion: mutation.titleVersion,
        }
    try {
      parsePersistedPlaygroundWorkspace({
        schemaVersion: 2,
        revision: durable?.revision ?? 0,
        tabs: [localTab],
      })
    }
    catch (error) {
      if (setValidationError(error))
        return false
      throw error
    }
    state = {
      ...state,
      tabs: state.tabs.map(tab => tab.id === conflict.tabId
        ? { ...localTab }
        : tab),
      dirty: true,
      error: 'conflict',
      conflict: {
        ...conflict,
        localTab,
      },
    }
    emit()
    return true
  }

  function addMutation(mutation: Mutation): boolean {
    requireReady()
    const existingConflict = state.conflict
    if (
      existingConflict
      && mutationTabId(mutation) === existingConflict.tabId
    ) {
      return updateConflictDraft(mutation)
    }
    const nextMutations = [...mutations]
    let replaced = false
    if (mutation.type === 'set_code' || mutation.type === 'rename') {
      for (let index = nextMutations.length - 1; index >= 0; index -= 1) {
        const pending = nextMutations[index]
        if (
          !pending
          || pending === activeMutation
        ) {
          continue
        }
        if (
          mutation.type === 'set_code'
          && pending.type === 'set_code'
          && pending.tabId === mutation.tabId
        ) {
          nextMutations[index] = {
            ...mutation,
            baseTab: pending.baseTab,
            expectedContentVersion: pending.expectedContentVersion,
          }
        }
        else if (
          mutation.type === 'rename'
          && pending.type === 'rename'
          && pending.tabId === mutation.tabId
        ) {
          nextMutations[index] = {
            ...mutation,
            baseTab: pending.baseTab,
            expectedTitleVersion: pending.expectedTitleVersion,
          }
        }
        else {
          continue
        }
        replaced = true
        break
      }
    }
    if (!replaced) {
      if (
        nextMutations.length
        + deferredMutations.length
        + (blockedMutation ? 1 : 0)
        >= PLAYGROUND_WORKSPACE_LIMITS.maxPendingMutations
      ) {
        state = {
          ...state,
          error: existingConflict ? 'conflict' : 'pending_changes_limit',
        }
        emit()
        return false
      }
      nextMutations.push(mutation)
    }
    try {
      let candidate = durable!
      for (const pending of nextMutations)
        candidate = applyMutation(candidate, pending, false)
    }
    catch (error) {
      if (setValidationError(error))
        return false
      throw error
    }
    mutations.splice(0, mutations.length, ...nextMutations)
    state = existingConflict
      ? { ...state, error: 'conflict' }
      : { ...state, error: null, conflict: null }
    publish()
    if (!existingConflict) {
      kick()
    }
    return true
  }

  function installConflict(error: PlaygroundMutationConflictError): void {
    const mutation = mutations[0]
    const localTab = state.tabs.find(tab => tab.id === error.tabId)
    if (!localTab) {
      mutations.splice(
        0,
        mutations.length,
        ...mutations.filter(mutation => mutationTabId(mutation) !== error.tabId),
      )
      publish()
      return
    }
    if (mutation && mutationTabId(mutation) === error.tabId) {
      const [, ...trailing] = mutations.splice(0)
      blockedMutation = mutation
      deferredMutations.push(...trailing)
    }
    const remoteTab = durable?.tabs.find(tab => tab.id === error.tabId)
    state = {
      ...state,
      error: 'conflict',
      conflict: {
        tabId: error.tabId,
        kind: error.kind,
        localTab: cloneTab(localTab),
        remoteTab: remoteTab ? cloneTab(remoteTab) : null,
      },
    }
    emit()
  }

  function installCapacityConflict(
    mutation: Mutation,
    preferVisibleDraft = true,
  ): void {
    const mutationIndex = mutations.indexOf(mutation)
    if (mutationIndex >= 0) {
      const [, ...trailing] = mutations.splice(mutationIndex)
      deferredMutations.unshift(...trailing)
    }
    blockedMutation = mutation
    let laterLocalMutation: Mutation | undefined
    for (let index = deferredMutations.length - 1; index >= 0; index -= 1) {
      const candidate = deferredMutations[index]
      if (
        candidate
        && mutationTabId(candidate) === mutationTabId(mutation)
      ) {
        laterLocalMutation = candidate
        break
      }
    }
    const localTab = (
      preferVisibleDraft
        ? state.tabs.find(tab => tab.id === mutationTabId(mutation))
        : null
    ) ?? mutationLocalTab(laterLocalMutation ?? mutation)
    const remoteTab = durable?.tabs.find(
      tab => tab.id === mutationTabId(mutation),
    )
    state = {
      ...state,
      status: 'ready',
      revision: durable?.revision ?? state.revision,
      dirty: true,
      error: 'conflict',
      conflict: {
        tabId: mutationTabId(mutation),
        kind: 'capacity',
        localTab,
        remoteTab: remoteTab ? cloneTab(remoteTab) : null,
      },
    }
    emit()
  }

  async function synchronizeFromStorage(publishLoaded = true): Promise<void> {
    const loaded = await options.storage.load()
    if (!loaded) {
      refreshRequested = false
      return
    }
    durable = loaded
    // Broadcast messages are only a wake-up hint. Never spin forever if a
    // stale or forged message advertises a revision that is not in IndexedDB.
    requestedRevision = loaded.revision
    refreshRequested = false
    if (publishLoaded)
      publish()
  }

  async function runWorker(): Promise<void> {
    try {
      for (;;) {
        if (closed || state.status !== 'ready')
          return
        if (state.conflict || state.error === 'storage_unavailable')
          return
        const mutation = mutations[0]
        activeMutation = mutation ?? null
        if (!mutation) {
          const deferred = deferredMutations.shift()
          if (deferred) {
            try {
              applyMutation(durable!, deferred, false)
            }
            catch (error) {
              if (error instanceof z.ZodError) {
                installCapacityConflict(deferred, false)
                return
              }
              throw error
            }
            mutations.push(deferred)
            publish()
            continue
          }
          if (
            !durable
            || (
              !refreshRequested
              && requestedRevision <= durable.revision
            )
          ) {
            return
          }
          try {
            await synchronizeFromStorage()
          }
          catch (error) {
            state = {
              ...state,
              status: error instanceof z.ZodError ? 'error' : state.status,
              error: error instanceof z.ZodError
                ? 'corrupt_workspace'
                : 'storage_unavailable',
            }
            emit()
            return
          }
          continue
        }

        let candidate: PersistedPlaygroundWorkspace
        try {
          candidate = applyMutation(durable!, mutation, true)
        }
        catch (error) {
          if (error instanceof PlaygroundMutationConflictError) {
            installConflict(error)
            return
          }
          if (setValidationError(error)) {
            installCapacityConflict(mutation)
            return
          }
          throw error
        }

        try {
          await options.storage.save(candidate, durable!.revision)
        }
        catch (error) {
          if (error instanceof PlaygroundWorkspaceRevisionConflictError) {
            try {
              await synchronizeFromStorage(false)
            }
            catch (loadError) {
              state = {
                ...state,
                status: loadError instanceof z.ZodError
                  ? 'error'
                  : state.status,
                error: loadError instanceof z.ZodError
                  ? 'corrupt_workspace'
                  : 'storage_unavailable',
              }
              emit()
              return
            }
            continue
          }
          state = { ...state, error: 'storage_unavailable' }
          emit()
          return
        }

        durable = candidate
        requestedRevision = Math.max(requestedRevision, candidate.revision)
        mutations.shift()
        try {
          publish()
        }
        catch (error) {
          if (!(error instanceof z.ZodError))
            throw error
          let projected = durable
          let blocked: Mutation | null = null
          for (const pending of mutations) {
            try {
              projected = applyMutation(projected, pending, false)
            }
            catch (projectionError) {
              if (!(projectionError instanceof z.ZodError))
                throw projectionError
              blocked = pending
              break
            }
          }
          if (!blocked)
            throw error
          installCapacityConflict(blocked)
          return
        }
      }
    }
    finally {
      activeMutation = null
    }
  }

  function kick(): void {
    if (worker || closed || state.status !== 'ready')
      return
    worker = runWorker().finally(() => {
      worker = null
      if (
        !closed
        && state.status === 'ready'
        && !state.conflict
        && state.error !== 'storage_unavailable'
        && (
          mutations.length > 0
          || deferredMutations.length > 0
          || refreshRequested
          || requestedRevision > (durable?.revision ?? 0)
        )
      ) {
        kick()
      }
    })
  }

  async function initialize(): Promise<void> {
    state = { ...state, status: 'opening', error: null, conflict: null }
    emit()
    try {
      let loaded = await options.storage.load()
      if (!loaded) {
        const initialId = createId()
        const initial: PersistedPlaygroundWorkspace
          = parsePersistedPlaygroundWorkspace({
            schemaVersion: 2,
            revision: 1,
            tabs: [{
              id: initialId,
              title: 'Playground 1',
              code: DEFAULT_PLAYGROUND_CODE,
              titleVersion: createId(),
              contentVersion: createId(),
            }],
          })
        try {
          await options.storage.save(initial, 0)
          loaded = initial
        }
        catch (error) {
          if (!(error instanceof PlaygroundWorkspaceRevisionConflictError))
            throw error
          loaded = await options.storage.load()
          if (!loaded) {
            throw new Error(
              'Playground genesis conflicted but no committed workspace exists',
            )
          }
        }
      }
      durable = loaded
      requestedRevision = loaded.revision
      selectedTabId = loaded.tabs[0]?.id ?? null
      state = { ...state, status: 'ready', error: null, conflict: null }
      unsubscribeStorage = options.storage.subscribe((revision) => {
        if (revision <= (durable?.revision ?? 0))
          return
        requestedRevision = Math.max(requestedRevision, revision)
        kick()
      })
      publish()
      kick()
    }
    catch (error) {
      state = {
        ...state,
        status: 'error',
        error: error instanceof z.ZodError
          ? 'corrupt_workspace'
          : 'storage_unavailable',
      }
      emit()
      throw error
    }
  }

  return {
    snapshot: () => ({
      ...state,
      tabs: state.tabs.map(tab => ({ ...tab })),
      conflict: state.conflict
        ? {
            ...state.conflict,
            localTab: { ...state.conflict.localTab },
            remoteTab: state.conflict.remoteTab
              ? { ...state.conflict.remoteTab }
              : null,
          }
        : null,
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    open: () => {
      if (closing || closed)
        return Promise.reject(new Error('Playground workspace is closed'))
      opening ??= initialize()
      return opening
    },
    refresh: async () => {
      if (state.status !== 'ready')
        throw new Error('Playground workspace is not ready')
      refreshRequested = true
      kick()
      await (worker ?? Promise.resolve())
    },
    openTab: (input = {}) => {
      const workspace = requireReady()
      const id = createId()
      const ordinal = workspace.tabs.length + 1
      const added = addMutation({
        type: 'add',
        tab: {
          id,
          title: input.title?.trim() || `Playground ${ordinal}`,
          code: input.code ?? '',
          titleVersion: createId(),
          contentVersion: createId(),
        },
      })
      if (!added)
        return null
      selectedTabId = id
      publish()
      return id
    },
    selectTab: (tabId) => {
      const workspace = requireReady()
      if (!workspace.tabs.some(tab => tab.id === tabId))
        return false
      selectedTabId = tabId
      publish()
      return true
    },
    closeTab: (tabId) => {
      const workspace = requireReady()
      const index = workspace.tabs.findIndex(candidate => candidate.id === tabId)
      const tab = workspace.tabs[index]
      if (!tab)
        return false
      if (selectedTabId === tabId) {
        selectedTabId = (
          workspace.tabs[index + 1]
          ?? workspace.tabs[index - 1]
        )?.id ?? null
      }
      return addMutation({
        type: 'close',
        tabId,
        baseTab: { ...tab },
        expectedTitleVersion: tab.titleVersion,
        expectedContentVersion: tab.contentVersion,
      })
    },
    renameTab: (tabId, title) => {
      const normalized = title.trim()
      if (!normalized)
        return false
      const workspace = requireReady()
      const tab = state.conflict?.tabId === tabId
        ? state.conflict.localTab
        : workspace.tabs.find(candidate => candidate.id === tabId)
      if (!tab)
        return false
      if (tab.title === normalized)
        return true
      return addMutation({
        type: 'rename',
        tabId,
        baseTab: { ...tab },
        expectedTitleVersion: tab.titleVersion,
        titleVersion: createId(),
        title: normalized,
      })
    },
    setTabCode: (tabId, code, expectedContentVersion) => {
      const workspace = requireReady()
      const tab = state.conflict?.tabId === tabId
        ? state.conflict.localTab
        : workspace.tabs.find(candidate => candidate.id === tabId)
      if (!tab)
        return false
      if (tab.code === code)
        return true
      return addMutation({
        type: 'set_code',
        tabId,
        baseTab: { ...tab },
        expectedContentVersion:
          expectedContentVersion ?? tab.contentVersion,
        contentVersion: createId(),
        code,
      })
    },
    retry: () => {
      if (closing || closed)
        return
      if (state.status === 'error') {
        void initialize().catch(() => undefined)
        return
      }
      if (state.error === 'storage_unavailable') {
        state = { ...state, error: null }
        emit()
        kick()
      }
    },
    resolveConflict: (resolution) => {
      const conflict = state.conflict
      if (!conflict)
        return null
      const retainedMutations = mutations.filter(
        mutation => mutationTabId(mutation) !== conflict.tabId,
      )
      const retainedDeferredMutations = deferredMutations.filter(
        mutation => mutationTabId(mutation) !== conflict.tabId,
      )
      if (resolution === 'keep_copy') {
        const recoveredId = createId()
        const recoveredMutation: Mutation = {
          type: 'add',
          tab: {
            id: recoveredId,
            title: conflict.localTab.title,
            code: conflict.localTab.code,
            titleVersion: createId(),
            contentVersion: createId(),
          },
        }
        const nextMutations = [...retainedMutations, recoveredMutation]
        if (
          nextMutations.length
          > PLAYGROUND_WORKSPACE_LIMITS.maxPendingMutations
        ) {
          emit()
          return null
        }
        try {
          let candidate = durable!
          for (const pending of nextMutations)
            candidate = applyMutation(candidate, pending, false)
        }
        catch (error) {
          if (setValidationError(error))
            return null
          throw error
        }
        mutations.splice(0, mutations.length, ...nextMutations)
        deferredMutations.splice(
          0,
          deferredMutations.length,
          ...retainedDeferredMutations,
        )
        blockedMutation = null
        state = { ...state, error: null, conflict: null }
        selectedTabId = recoveredId
        publish()
        kick()
        return recoveredId
      }
      mutations.splice(0, mutations.length, ...retainedMutations)
      deferredMutations.splice(
        0,
        deferredMutations.length,
        ...retainedDeferredMutations,
      )
      blockedMutation = null
      state = { ...state, error: null, conflict: null }
      publish()
      kick()
      return null
    },
    whenIdle: async () => {
      for (;;) {
        const current = worker
        if (!current)
          return
        await current
      }
    },
    close: () => {
      if (closeOperation)
        return closeOperation
      if (closed)
        return Promise.resolve(true)
      closing = true
      closeOperation = (async () => {
        try {
          // Stop accepting mutations while the current worker attempts to
          // drain. A conflict or storage failure is not a successful close:
          // the process-local recovery state must survive a later remount.
          for (;;) {
            const current = worker
            if (!current)
              break
            await current
          }
          if (
            mutations.length > 0
            || blockedMutation !== null
            || deferredMutations.length > 0
            || state.conflict !== null
          ) {
            return false
          }
          unsubscribeStorage?.()
          unsubscribeStorage = null
          closed = true
          await options.storage.close()
          state = {
            ...state,
            status: 'closed',
            dirty: false,
            error: null,
            conflict: null,
          }
          emit()
          listeners.clear()
          return true
        }
        finally {
          if (!closed) {
            closing = false
            closeOperation = null
          }
        }
      })()
      return closeOperation
    },
  }
}
