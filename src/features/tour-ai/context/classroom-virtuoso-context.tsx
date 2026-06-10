'use client'

import { createContext, use, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'

// Shared ref to the stream Virtuoso instance. ClassroomStream attaches the
// handle when it mounts; the Live View scroll surface reads it for imperative
// `scrollToIndex` fallbacks when the learner jumps to content that is currently
// virtualized off-screen.
const ClassroomVirtuosoContext = createContext<RefObject<VirtuosoHandle | null> | null>(null)

export function ClassroomVirtuosoProvider({ children }: { children: ReactNode }) {
  const ref = useRef<VirtuosoHandle | null>(null)
  return <ClassroomVirtuosoContext value={ref}>{children}</ClassroomVirtuosoContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomVirtuosoRef(): RefObject<VirtuosoHandle | null> | null {
  return use(ClassroomVirtuosoContext)
}
