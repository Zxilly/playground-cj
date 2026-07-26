import { createContext } from 'react'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type { ContentPackCatalog } from '@/lib/teach/classroom/content-catalog'
import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { CangjieRunner, RunResult } from '@/lib/teach/feedback/run-cangjie'
import type { ActiveEditorRegistry } from '@/features/teach/state/active-editor-store'

/** Runtime capabilities shared by the AI Classroom surfaces. */
export interface WorkspaceContextValue {
  lang: 'zh' | 'en'
  classroom: AIClassroom
  catalog: ContentPackCatalog
  knowledge: KnowledgeSource
  runner: CangjieRunner
  activeEditor: ActiveEditorRegistry
  now: () => number
}

export type { RunResult }

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
