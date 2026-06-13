'use client'

import { useEffect, useState } from 'react'
import type { DependencyList } from 'react'
import type { WorkspaceScope } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'

interface ResourceState<T> {
  data: T | undefined
  loading: boolean
}

/**
 * Load an async workspace resource (a repository read) into local state, with a
 * simple loading flag. Views call this to pull their document from the injected
 * repository on mount; the loader is re-run when `deps` change (e.g. a selected
 * reference id). Stale resolutions after unmount or a dep change are discarded.
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
  load: () => Promise<T>,
  deps: DependencyList,
  scope: WorkspaceScope = 'all',
): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>({ data: undefined, loading: true })
  const revision = useWorkspaceStore(s => s.revisions[scope])

  useEffect(() => {
    let active = true
    void load()
      .then((result) => {
        if (active)
          setState({ data: result, loading: false })
      })
      .catch((error) => {
        // A rejected read must not wedge `loading` on forever — that would lock
        // the mission gate and leak an unhandled rejection. Degrade to the
        // empty/default document, exactly as the docstring promises.
        if (active) {
          console.warn('[teach] workspace resource read failed; rendering empty state', error)
          setState({ data: undefined, loading: false })
        }
      })
    return () => {
      active = false
    }
    // The loader closes over `deps`; re-running it when those (or the workspace
    // revision for this scope) change is the whole point of this hook, so they
    // are intentionally the effect's dependency list.
    // eslint-disable-next-line react/exhaustive-deps
  }, [...deps, revision])

  return state
}
