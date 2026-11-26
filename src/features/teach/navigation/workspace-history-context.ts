import { createContext, use } from 'react'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'

export type WorkspaceHistoryNavigation = (view: WorkspaceView) => boolean

export const WorkspaceHistoryContext = createContext<WorkspaceHistoryNavigation | null>(null)

const fallbackNavigation: WorkspaceHistoryNavigation = (view) => {
  useWorkspaceStore.getState().setView(view)
  return true
}

export function useWorkspaceHistoryNavigation(): WorkspaceHistoryNavigation {
  return use(WorkspaceHistoryContext) ?? fallbackNavigation
}
