'use client'

import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A process-wide never-aborting signal used as the fallback when no provider is
 * mounted (isolated tests). Created once at module load so {@link useAbortScope}
 * stays pure — it never allocates an `AbortController` during render.
 */
const NEVER_ABORTS = new AbortController().signal

const AbortScopeContext = createContext<AbortSignal | null>(null)

/**
 * Provide an {@link AbortSignal} scoped to the lifetime of the teaching
 * workspace. The signal aborts on unmount so any in-flight teacher request
 * (streamed through the scoped chat transport) is cancelled when the workspace
 * tears down, rather than resolving against a dead component tree.
 */
export function AbortScopeProvider({
  children,
  controller: controlledController,
}: {
  children: ReactNode
  controller?: AbortController
}) {
  const [ownedController] = useState(() => new AbortController())
  const controller = controlledController ?? ownedController

  useEffect(() => {
    return () => {
      controller.abort()
    }
  }, [controller])

  return (
    <AbortScopeContext value={controller.signal}>
      {children}
    </AbortScopeContext>
  )
}

/**
 * Read the workspace-scoped {@link AbortSignal}. Falls back to a never-aborting
 * signal when no provider is present so the chat runtime degrades gracefully in
 * isolated tests rather than throwing.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAbortScope(): AbortSignal {
  return use(AbortScopeContext) ?? NEVER_ABORTS
}
