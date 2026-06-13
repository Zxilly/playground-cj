'use client'

import { useEffect, useState } from 'react'
import type { DependencyList } from 'react'

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
 * Errors are intentionally not surfaced here — the repository reads degrade to
 * their empty/default document, so a failed read renders the same empty state as
 * a genuinely empty workspace rather than crashing the view.
 */
export function useWorkspaceResource<T>(load: () => Promise<T>, deps: DependencyList): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>({ data: undefined, loading: true })

  useEffect(() => {
    let active = true
    void load().then((result) => {
      if (active)
        setState({ data: result, loading: false })
    })
    return () => {
      active = false
    }
    // The loader closes over `deps`; re-running it when those change is the whole
    // point of this hook, so `deps` is intentionally the effect's dependency list.
    // eslint-disable-next-line react/exhaustive-deps
  }, deps)

  return state
}
