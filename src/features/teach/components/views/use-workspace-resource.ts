'use client'

import { useEffect, useState } from 'react'
import type { DependencyList } from 'react'
import type { WorkspaceScope } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'

interface ResourceState<T> {
  data: T | undefined
  loading: boolean
}

interface ResourceCacheEntry {
  data?: unknown
  hasData: boolean
  epoch: number
  revision?: number
  inFlight?: Promise<unknown>
}

/**
 * Repository instances are the lifetime boundary for cached reads. A WeakMap
 * keeps revisiting a workspace view synchronous without retaining repositories
 * after their provider is discarded.
 */
const resourceCache = new WeakMap<object, Map<string, ResourceCacheEntry>>()

function readCachedState<T>(owner: object, key: string): ResourceState<T> {
  const entry = resourceCache.get(owner)?.get(key)
  return entry?.hasData
    ? { data: entry.data as T, loading: false }
    : { data: undefined, loading: true }
}

function getCacheEntry(owner: object, key: string): ResourceCacheEntry {
  let ownerCache = resourceCache.get(owner)
  if (!ownerCache) {
    ownerCache = new Map()
    resourceCache.set(owner, ownerCache)
  }
  let entry = ownerCache.get(key)
  if (!entry) {
    entry = { hasData: false, epoch: 0 }
    ownerCache.set(key, entry)
  }
  return entry
}

function loadResource<T>(
  owner: object,
  key: string,
  revision: number,
  load: () => Promise<T>,
): Promise<T> {
  const entry = getCacheEntry(owner, key)
  if (entry.inFlight && entry.revision === revision)
    return entry.inFlight as Promise<T>

  const epoch = entry.epoch + 1
  entry.epoch = epoch
  entry.revision = revision
  let request: Promise<T>
  try {
    request = Promise.resolve(load())
  }
  catch (error) {
    request = Promise.reject(error)
  }
  entry.inFlight = request
  void request.then(
    (data) => {
      if (entry.epoch !== epoch)
        return
      entry.data = data
      entry.hasData = true
    },
    () => {},
  ).finally(() => {
    if (entry.epoch === epoch)
      entry.inFlight = undefined
  })
  return request
}

/**
 * Load an async workspace resource (a repository read) into local state. The
 * latest successful value is cached by repository instance + resource key, so
 * returning to an already visited workspace tab can paint its content
 * immediately instead of flashing a one-frame skeleton while the same IndexedDB
 * read resolves again. Every mount still revalidates in the background.
 *
 * The read also re-runs when the workspace revision for `scope` bumps — that is
 * how a document written by a teacher tool (mission, lesson, learning record)
 * refreshes the views and the mission-first gate without a manual reload. Pass
 * the document kind this read concerns (`'lessons'`, `'glossary'`, …) so an
 * unrelated write (e.g. a notes edit) does not needlessly re-run it; `scope`
 * defaults to `'all'`, which re-runs on every workspace write.
 *
 * Errors are intentionally not surfaced here — the repository reads are supposed
 * to degrade to their empty/default document, so a failed read renders the same
 * empty state as a genuinely empty workspace rather than crashing the view or
 * wedging the loading flag on forever (see the `.catch` below).
 */
export function useWorkspaceResource<T>(
  cacheOwner: object,
  cacheKey: string,
  load: () => Promise<T>,
  deps: DependencyList,
  scope: WorkspaceScope = 'all',
): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>(() => readCachedState<T>(cacheOwner, cacheKey))
  const revision = useWorkspaceStore(s => s.revisions[scope])

  useEffect(() => {
    let active = true
    void loadResource(cacheOwner, cacheKey, revision, load)
      .then((result) => {
        const entry = getCacheEntry(cacheOwner, cacheKey)
        if (active && entry.revision === revision && entry.data === result)
          setState({ data: result, loading: false })
      })
      .catch((error) => {
        // A rejected read must not wedge `loading` on forever — that would lock
        // the mission gate and leak an unhandled rejection. Degrade to the
        // empty/default document, exactly as the docstring promises.
        const entry = getCacheEntry(cacheOwner, cacheKey)
        if (active && entry.revision === revision) {
          console.warn('[teach] workspace resource read failed; rendering empty state', error)
          setState(current => current.loading ? { data: undefined, loading: false } : current)
        }
      })
    return () => {
      active = false
    }
    // The loader closes over `deps`; re-running it when those (or the workspace
    // revision for this scope) change is the whole point of this hook, so they
    // are intentionally the effect's dependency list.
    // eslint-disable-next-line react/exhaustive-deps
  }, [...deps, revision, cacheOwner, cacheKey])

  return state
}
