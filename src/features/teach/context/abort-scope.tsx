'use client'

import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

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
 * Read the workspace-scoped {@link AbortSignal}. A missing provider is a
 * lifecycle wiring error: silently substituting a never-aborting signal would
 * leak runner or teacher work after its owning workspace unmounts.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAbortScope(): AbortSignal {
  const signal = use(AbortScopeContext)
  if (!signal)
    throw new Error('useAbortScope must be used inside an AbortScopeProvider')
  return signal
}
