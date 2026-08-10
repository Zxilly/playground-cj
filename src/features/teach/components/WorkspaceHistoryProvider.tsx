'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react'
import type { PropsWithChildren } from 'react'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import {
  createWorkspaceHistoryMarker,
  isWorkspaceViewBlocked,
  mergeWorkspaceHistoryState,
  readWorkspaceHistoryMarker,
  readWorkspaceView,
  workspaceViewHref,
} from '@/features/teach/navigation/workspace-view-url'
import type { WorkspaceHistoryMarker } from '@/features/teach/navigation/workspace-view-url'
import {
  WorkspaceHistoryContext,
} from '@/features/teach/navigation/workspace-history-context'
import type { WorkspaceHistoryNavigation } from '@/features/teach/navigation/workspace-history-context'

function currentHref(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function markersMatch(
  left: WorkspaceHistoryMarker | null,
  right: WorkspaceHistoryMarker,
): boolean {
  return left?.version === right.version
    && left.position === right.position
    && left.view === right.view
}

export function WorkspaceHistoryProvider({ children }: PropsWithChildren) {
  const cursorRef = useRef<WorkspaceHistoryMarker | null>(null)
  const revertingRef = useRef(false)

  useLayoutEffect(() => {
    const initialView = readWorkspaceView(window.location)
    const existingMarker = readWorkspaceHistoryMarker(window.history.state)
    const marker = existingMarker
      ? { ...existingMarker, view: initialView }
      : createWorkspaceHistoryMarker(initialView, 0)
    const canonicalHref = workspaceViewHref(window.location, initialView)

    cursorRef.current = marker
    if (!markersMatch(existingMarker, marker) || currentHref() !== canonicalHref) {
      window.history.replaceState(
        mergeWorkspaceHistoryState(window.history.state, marker),
        '',
        canonicalHref,
      )
    }
    if (useWorkspaceStore.getState().view !== initialView)
      useWorkspaceStore.getState().setView(initialView)

    const onPopState = (event: PopStateEvent) => {
      const requestedView = readWorkspaceView(window.location)
      const state = useWorkspaceStore.getState()
      const targetMarker = readWorkspaceHistoryMarker(event.state)

      if (revertingRef.current) {
        revertingRef.current = false
        cursorRef.current = targetMarker ?? cursorRef.current
        return
      }

      if (isWorkspaceViewBlocked(requestedView, state.teacherChatRunMode)) {
        const currentMarker = cursorRef.current
        if (currentMarker && targetMarker && currentMarker.position !== targetMarker.position) {
          revertingRef.current = true
          window.history.go(currentMarker.position - targetMarker.position)
          return
        }

        const fallbackMarker = currentMarker
          ?? createWorkspaceHistoryMarker(state.view, 0)
        cursorRef.current = fallbackMarker
        window.history.replaceState(
          mergeWorkspaceHistoryState(window.history.state, fallbackMarker),
          '',
          workspaceViewHref(window.location, state.view),
        )
        return
      }

      const markerForTarget = targetMarker
        ?? createWorkspaceHistoryMarker(requestedView, cursorRef.current?.position ?? 0)
      cursorRef.current = markerForTarget
      const canonicalTarget = workspaceViewHref(window.location, requestedView)
      if (!markersMatch(targetMarker, markerForTarget) || currentHref() !== canonicalTarget) {
        window.history.replaceState(
          mergeWorkspaceHistoryState(window.history.state, markerForTarget),
          '',
          canonicalTarget,
        )
      }
      if (state.view !== requestedView)
        state.setView(requestedView)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback<WorkspaceHistoryNavigation>((requestedView) => {
    const state = useWorkspaceStore.getState()
    if (isWorkspaceViewBlocked(requestedView, state.teacherChatRunMode))
      return false
    if (requestedView === state.view)
      return true

    const marker = createWorkspaceHistoryMarker(
      requestedView,
      (cursorRef.current?.position ?? 0) + 1,
    )
    window.history.pushState(
      mergeWorkspaceHistoryState(window.history.state, marker),
      '',
      workspaceViewHref(window.location, requestedView),
    )
    cursorRef.current = marker
    state.setView(requestedView)
    return true
  }, [])

  return (
    <WorkspaceHistoryContext value={navigate}>
      {children}
    </WorkspaceHistoryContext>
  )
}
