'use client'

import { createContext, useContext } from 'react'
import type { ReactNode, RefObject } from 'react'

const ViewportRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export function ViewportRefProvider({
  value,
  children,
}: {
  value: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return <ViewportRefContext.Provider value={value}>{children}</ViewportRefContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useViewportRef(): RefObject<HTMLDivElement | null> {
  const ctx = useContext(ViewportRefContext)
  if (!ctx)
    throw new Error('useViewportRef must be used inside ViewportRefProvider')
  return ctx
}
