import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'
import { z } from 'zod'

export const PLAYGROUND_WORKSPACE_V2_DATABASE_NAME
  = 'playground-cj-ai-playground-v2'
const WORKSPACE_STORE_NAME = 'playground-workspaces'

export const PLAYGROUND_WORKSPACE_LIMITS = Object.freeze({
  maxTabs: 16,
  maxPendingMutations: 64,
  maxTitleBytes: 256,
  maxCodeBytesPerTab: 256 * 1024,
  maxTotalBytes: 1024 * 1024,
})

const utf8Encoder = new TextEncoder()

export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength
}

const uuidSchema = z.string().uuid()

const persistedPlaygroundTabSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(PLAYGROUND_WORKSPACE_LIMITS.maxTitleBytes),
  code: z.string().max(PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab),
  titleVersion: uuidSchema,
  contentVersion: uuidSchema,
}).strict().superRefine((tab, context) => {
  if (!tab.title.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'Playground tab title must not be blank',
    })
  }
  if (utf8ByteLength(tab.title) > PLAYGROUND_WORKSPACE_LIMITS.maxTitleBytes) {
    context.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'Playground tab title exceeds its UTF-8 byte limit',
    })
  }
  if (utf8ByteLength(tab.code) > PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab) {
    context.addIssue({
      code: 'custom',
      path: ['code'],
      message: 'Playground tab code exceeds its UTF-8 byte limit',
    })
  }
})

export const persistedPlaygroundWorkspaceSchema = z.object({
  schemaVersion: z.literal(2),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  tabs: z.array(persistedPlaygroundTabSchema)
    .max(PLAYGROUND_WORKSPACE_LIMITS.maxTabs),
}).strict().superRefine((workspace, context) => {
  const ids = new Set<string>()
  for (const [index, tab] of workspace.tabs.entries()) {
    if (ids.has(tab.id)) {
      context.addIssue({
        code: 'custom',
        path: ['tabs', index, 'id'],
        message: 'Playground tab ids must be unique',
      })
    }
    ids.add(tab.id)
  }
  if (
    utf8ByteLength(JSON.stringify(workspace))
    > PLAYGROUND_WORKSPACE_LIMITS.maxTotalBytes
  ) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: 'Playground workspace exceeds its UTF-8 byte limit',
    })
  }
})

export type PersistedPlaygroundTab
  = z.infer<typeof persistedPlaygroundTabSchema>
export type PersistedPlaygroundWorkspace
  = z.infer<typeof persistedPlaygroundWorkspaceSchema>

export function parsePersistedPlaygroundWorkspace(
  value: unknown,
): PersistedPlaygroundWorkspace {
  return persistedPlaygroundWorkspaceSchema.parse(value)
}

export class PlaygroundWorkspaceRevisionConflictError extends Error {
  readonly expectedRevision: number
  readonly actualRevision: number

  constructor(expectedRevision: number, actualRevision: number) {
    super(
      `Playground workspace revision conflict: expected ${expectedRevision}, actual ${actualRevision}`,
    )
    this.name = 'PlaygroundWorkspaceRevisionConflictError'
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}

export interface PlaygroundWorkspaceStorage {
  load: () => Promise<PersistedPlaygroundWorkspace | null>
  save: (
    snapshot: PersistedPlaygroundWorkspace,
    expectedRevision: number,
  ) => Promise<void>
  subscribe: (listener: (revision: number) => void) => () => void
  close: () => Promise<void>
}

interface PlaygroundWorkspaceDatabase extends DBSchema {
  [WORKSPACE_STORE_NAME]: {
    key: string
    value: PersistedPlaygroundWorkspace
  }
}

interface PlaygroundRevisionNotification {
  type: 'revision_committed'
  revision: number
}

function isRevisionNotification(
  value: unknown,
): value is PlaygroundRevisionNotification {
  if (value == null || typeof value !== 'object')
    return false
  const candidate = value as Partial<PlaygroundRevisionNotification>
  return candidate.type === 'revision_committed'
    && Number.isSafeInteger(candidate.revision)
    && candidate.revision! >= 1
}

export interface IndexedDBPlaygroundWorkspaceStorageOptions {
  scope: string
  databaseName?: string
}

/**
 * Revisioned v2 storage. It intentionally never reads the former localStorage
 * key: unversioned v1 payloads are outside this trust boundary.
 */
export function createIndexedDBPlaygroundWorkspaceStorage(
  options: IndexedDBPlaygroundWorkspaceStorageOptions,
): PlaygroundWorkspaceStorage {
  const scope = options.scope.trim()
  const databaseName
    = options.databaseName ?? PLAYGROUND_WORKSPACE_V2_DATABASE_NAME
  if (!scope)
    throw new Error('IndexedDB Playground storage requires a non-empty scope')
  if (!databaseName.trim())
    throw new Error('IndexedDB Playground storage requires a database name')

  let databasePromise:
    Promise<IDBPDatabase<PlaygroundWorkspaceDatabase>> | null = null
  let channel: BroadcastChannel | null = null
  let acceptingOperations = true
  let closePromise: Promise<void> | null = null
  const listeners = new Set<(revision: number) => void>()
  const pendingOperations = new Set<Promise<void>>()

  function database(): Promise<IDBPDatabase<PlaygroundWorkspaceDatabase>> {
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB is unavailable in this environment'))
    databasePromise ??= openDB<PlaygroundWorkspaceDatabase>(databaseName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(WORKSPACE_STORE_NAME))
          db.createObjectStore(WORKSPACE_STORE_NAME)
      },
    })
    return databasePromise
  }

  function own<T>(start: () => Promise<T>): Promise<T> {
    if (!acceptingOperations)
      return Promise.reject(new Error('IndexedDB Playground storage is closed'))
    let operation: Promise<T>
    try {
      operation = start()
    }
    catch (error) {
      return Promise.reject(error)
    }
    const settlement = operation.then(
      () => undefined,
      () => undefined,
    )
    pendingOperations.add(settlement)
    void settlement.then(() => pendingOperations.delete(settlement))
    return operation
  }

  function ensureChannel(): BroadcastChannel | null {
    if (!acceptingOperations || typeof BroadcastChannel === 'undefined')
      return null
    if (channel)
      return channel
    try {
      channel = new BroadcastChannel(
        `${PLAYGROUND_WORKSPACE_V2_DATABASE_NAME}:${databaseName}:${scope}`,
      )
    }
    catch {
      // Notifications are advisory; IndexedDB CAS remains authoritative.
      return null
    }
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isRevisionNotification(event.data))
        return
      for (const listener of listeners)
        listener(event.data.revision)
    }
    return channel
  }

  return {
    load: () => own(async () => {
      const db = await database()
      const stored = await db.get(WORKSPACE_STORE_NAME, scope)
      return stored == null
        ? null
        : parsePersistedPlaygroundWorkspace(stored)
    }),
    save: (snapshot, expectedRevision) => own(async () => {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new Error(
          'Expected Playground revision must be a non-negative safe integer',
        )
      }
      const candidate = parsePersistedPlaygroundWorkspace(snapshot)
      if (candidate.revision !== expectedRevision + 1) {
        throw new Error(
          `Playground candidate revision must be ${expectedRevision + 1}, received ${candidate.revision}`,
        )
      }

      const db = await database()
      const transaction = db.transaction(WORKSPACE_STORE_NAME, 'readwrite')
      try {
        const rawStored = await transaction.store.get(scope)
        const stored = rawStored == null
          ? null
          : parsePersistedPlaygroundWorkspace(rawStored)
        const actualRevision = stored?.revision ?? 0
        if (actualRevision !== expectedRevision) {
          transaction.abort()
          await transaction.done.catch(() => undefined)
          throw new PlaygroundWorkspaceRevisionConflictError(
            expectedRevision,
            actualRevision,
          )
        }
        await transaction.store.put(candidate, scope)
        await transaction.done
      }
      catch (error) {
        try {
          transaction.abort()
        }
        catch {
          // A completed or already-aborted transaction needs no second abort.
        }
        await transaction.done.catch(() => undefined)
        throw error
      }

      try {
        ensureChannel()?.postMessage({
          type: 'revision_committed',
          revision: candidate.revision,
        } satisfies PlaygroundRevisionNotification)
      }
      catch {
        // A notification failure cannot invalidate an already committed CAS.
      }
    }),
    subscribe: (listener) => {
      if (!acceptingOperations)
        throw new Error('IndexedDB Playground storage is closed')
      listeners.add(listener)
      ensureChannel()
      return () => listeners.delete(listener)
    },
    close: () => {
      closePromise ??= (async () => {
        acceptingOperations = false
        listeners.clear()
        try {
          channel?.close()
        }
        catch {
          // The database still has to close if an advisory channel misbehaves.
        }
        channel = null
        while (pendingOperations.size > 0)
          await Promise.all([...pendingOperations])
        if (databasePromise)
          (await databasePromise).close()
      })()
      return closePromise
    },
  }
}
