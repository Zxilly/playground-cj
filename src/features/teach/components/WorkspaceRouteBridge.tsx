'use client'

import { useLayoutEffect } from 'react'
import type { WorkspaceStore, WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'

const ROUTE_VIEWS: ReadonlySet<WorkspaceView> = new Set([
  'overview',
  'mission',
  'lessons',
  'lesson',
  'playground',
  'glossary',
  'reference',
  'records',
  'notes',
])

interface WorkspaceRoute {
  view: WorkspaceView
  id?: string
  tab?: string
}

function routeFromSearch(search: string): WorkspaceRoute | null {
  const params = new URLSearchParams(search)
  const view = params.get('view')
  if (!view || !ROUTE_VIEWS.has(view as WorkspaceView))
    return null

  const route: WorkspaceRoute = { view: view as WorkspaceView }
  const id = params.get('id')?.trim()
  const tab = params.get('tab')?.trim()
  if (id)
    route.id = id
  if (tab)
    route.tab = tab
  return route
}

function routeFromState(state: WorkspaceStore): WorkspaceRoute {
  if (state.view === 'lesson') {
    return {
      view: state.view,
      ...(state.currentLessonId ? { id: state.currentLessonId } : {}),
    }
  }
  if (state.view === 'reference') {
    return {
      view: state.view,
      ...(state.currentReferenceId ? { id: state.currentReferenceId } : {}),
    }
  }
  if (state.view === 'playground') {
    return {
      view: state.view,
      ...(state.currentPlaygroundTabId ? { tab: state.currentPlaygroundTabId } : {}),
    }
  }
  return { view: state.view }
}

function routeKey(route: WorkspaceRoute): string {
  return `${route.view}:${route.id ?? ''}:${route.tab ?? ''}`
}

function applyRoute(route: WorkspaceRoute): void {
  const state = useWorkspaceStore.getState()
  if (route.view === 'lesson') {
    if (route.id)
      state.selectLesson(route.id)
    else
      state.setView('lessons')
    return
  }
  if (route.view === 'reference') {
    if (route.id)
      state.openReference(route.id)
    else
      state.setView('reference')
    return
  }
  if (route.view === 'playground') {
    if (!route.tab || !state.selectPlaygroundTab(route.tab))
      state.setView('playground')
    return
  }
  state.setView(route.view)
}

function routeHref(route: WorkspaceRoute): string {
  const url = new URL(window.location.href)
  url.searchParams.set('view', route.view)
  url.searchParams.delete('id')
  url.searchParams.delete('tab')
  if (route.id)
    url.searchParams.set('id', route.id)
  if (route.tab)
    url.searchParams.set('tab', route.tab)
  return `${url.pathname}${url.search}${url.hash}`
}

function replaceRoute(route: WorkspaceRoute): void {
  const href = routeHref(route)
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== href)
    window.history.replaceState(window.history.state, '', href)
}

/**
 * Keeps the URL and the imperative workspace store in lockstep. Native history
 * updates avoid an App Router render round-trip while still supporting refresh,
 * back, and forward navigation.
 */
export function WorkspaceRouteBridge() {
  useLayoutEffect(() => {
    let applyingHistory = true
    const initialRoute = routeFromSearch(window.location.search)
    if (initialRoute)
      applyRoute(initialRoute)
    let currentKey = routeKey(routeFromState(useWorkspaceStore.getState()))
    replaceRoute(routeFromState(useWorkspaceStore.getState()))
    applyingHistory = false

    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      const route = routeFromState(state)
      const nextKey = routeKey(route)
      if (nextKey === currentKey)
        return
      currentKey = nextKey
      if (!applyingHistory)
        window.history.pushState(window.history.state, '', routeHref(route))
    })

    const handlePopState = () => {
      const route = routeFromSearch(window.location.search)
      if (!route) {
        replaceRoute(routeFromState(useWorkspaceStore.getState()))
        return
      }
      applyingHistory = true
      applyRoute(route)
      const normalized = routeFromState(useWorkspaceStore.getState())
      currentKey = routeKey(normalized)
      replaceRoute(normalized)
      applyingHistory = false
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      unsubscribe()
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return null
}
