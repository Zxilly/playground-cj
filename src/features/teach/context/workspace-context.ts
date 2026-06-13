import { createContext } from 'react'
import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { EditorBridge } from '@/lib/teach/teacher/toolkit'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { RetrievalStoreLike } from '@/features/teach/hooks/use-block-outcome'

/**
 * The runtime collaborators every teaching-workspace surface depends on, injected
 * once at the shell root and read by views, blocks, and the chat runtime:
 *
 *  - `repo`            — the {@link WorkspaceRepository} backing every document
 *    read/write (mission, lessons, glossary, references, records, notes).
 *  - `retrievalStore`  — the spaced-retrieval schedule store, fed by quiz/recall
 *    outcomes and read for "due now" review (same shape `useBlockOutcome` needs).
 *  - `knowledge`       — the pluggable {@link KnowledgeSource} (currently Cangjie
 *    MCP) the teacher grounds factual claims against.
 *  - `editor`          — the shared Monaco bridge used by `code_task` blocks and
 *    teacher demonstrations.
 *  - `now`             — injected clock; surfaces never read `Date.now()` directly.
 *
 * Holding these behind one context keeps the views decoupled from how the shell
 * constructs them (IndexedDB repo in the app, fakes in tests).
 */
export interface WorkspaceContextValue {
  repo: WorkspaceRepository
  retrievalStore: RetrievalStoreLike
  knowledge: KnowledgeSource
  editor: EditorBridge
  now: () => number
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
