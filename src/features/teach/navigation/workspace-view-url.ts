import type { TeacherChatRunMode, WorkspaceView } from '@/features/teach/state/workspace-store'

export const WORKSPACE_VIEW_PARAM = 'view'
export const WORKSPACE_HISTORY_KEY = '__cjTeachWorkspace'

const WORKSPACE_VIEWS = new Set<WorkspaceView>([
  'live',
  'review',
  'progress',
  'playground',
])

export interface WorkspaceHistoryMarker {
  version: 1
  position: number
  view: WorkspaceView
}

export function isWorkspaceView(value: string | null): value is WorkspaceView {
  return value !== null && WORKSPACE_VIEWS.has(value as WorkspaceView)
}

export function readWorkspaceView(location: { href: string }): WorkspaceView {
  const value = new URL(location.href).searchParams.get(WORKSPACE_VIEW_PARAM)
  return isWorkspaceView(value) ? value : 'live'
}

export function workspaceViewHref(location: { href: string }, view: WorkspaceView): string {
  const url = new URL(location.href)
  if (view === 'live')
    url.searchParams.delete(WORKSPACE_VIEW_PARAM)
  else
    url.searchParams.set(WORKSPACE_VIEW_PARAM, view)
  return `${url.pathname}${url.search}${url.hash}`
}

export function chatModeForWorkspaceView(view: WorkspaceView): TeacherChatRunMode {
  return view === 'review' ? 'review' : 'live'
}

export function isWorkspaceViewBlocked(
  view: WorkspaceView,
  runningMode: TeacherChatRunMode | null,
): boolean {
  return runningMode !== null && runningMode !== chatModeForWorkspaceView(view)
}

export function createWorkspaceHistoryMarker(
  view: WorkspaceView,
  position: number,
): WorkspaceHistoryMarker {
  return { version: 1, position, view }
}

export function readWorkspaceHistoryMarker(state: unknown): WorkspaceHistoryMarker | null {
  if (!state || typeof state !== 'object')
    return null
  const marker = (state as Record<string, unknown>)[WORKSPACE_HISTORY_KEY]
  if (!marker || typeof marker !== 'object')
    return null
  const candidate = marker as Partial<WorkspaceHistoryMarker>
  if (
    candidate.version !== 1
    || !Number.isInteger(candidate.position)
    || !isWorkspaceView(candidate.view ?? null)
  ) {
    return null
  }
  return candidate as WorkspaceHistoryMarker
}

export function mergeWorkspaceHistoryState(
  state: unknown,
  marker: WorkspaceHistoryMarker,
): Record<string, unknown> {
  const base = state && typeof state === 'object'
    ? state as Record<string, unknown>
    : {}
  return { ...base, [WORKSPACE_HISTORY_KEY]: marker }
}
