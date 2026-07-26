'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { ActiveEditorHandle, ActiveEditorRegistry } from '@/features/teach/state/active-editor-store'

/**
 * Keep an editor registered while mounted and reactivate it when the learner
 * interacts with its container. The returned callback is suitable for both
 * `onFocusCapture` and `onClick`, so nested Monaco DOM nodes are covered too.
 */
export function useActiveEditorRegistration(
  registry: ActiveEditorRegistry | undefined,
  editorHandleRef: RefObject<ActiveEditorHandle | null>,
  activateOnMount = true,
) {
  const unregisterRef = useRef<(() => void) | null>(null)
  const handle = useMemo<ActiveEditorHandle>(() => ({
    getCode: () => editorHandleRef.current?.getCode() ?? '',
  }), [editorHandleRef])

  const activateEditor = useCallback(() => {
    if (!registry)
      return

    unregisterRef.current?.()
    unregisterRef.current = registry.register(handle)
  }, [handle, registry])

  useEffect(() => {
    if (activateOnMount)
      activateEditor()
    return () => {
      unregisterRef.current?.()
      unregisterRef.current = null
    }
  }, [activateEditor, activateOnMount])

  return activateEditor
}
