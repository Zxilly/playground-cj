'use client'

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type { ClassroomSnapshot } from '@/lib/teach/classroom/state'

/** Subscribe to the already-opened aggregate without mirroring domain state in React. */
export function useClassroomSnapshot(classroom: AIClassroom): ClassroomSnapshot {
  const cachedRef = useRef<ClassroomSnapshot | null>(null)
  const read = useCallback(() => {
    const next = classroom.snapshot()
    if (cachedRef.current?.revision === next.revision)
      return cachedRef.current
    cachedRef.current = next
    return next
  }, [classroom])
  return useSyncExternalStore(
    classroom.subscribe,
    read,
    read,
  )
}
