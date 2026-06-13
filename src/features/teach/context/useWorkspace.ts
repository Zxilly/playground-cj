'use client'

import { use } from 'react'
import type { WorkspaceContextValue } from './workspace-context'
import { WorkspaceContext } from './workspace-context'

/**
 * Access the workspace collaborators (repository, retrieval store, knowledge
 * source, editor bridge, clock) from any surface inside the shell. Throws when
 * used outside a {@link WorkspaceProvider} so a missing provider fails loudly in
 * development rather than silently degrading.
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = use(WorkspaceContext)
  if (!ctx)
    throw new Error('useWorkspace must be used inside a WorkspaceProvider')
  return ctx
}
