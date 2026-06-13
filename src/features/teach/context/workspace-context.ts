import { createContext } from 'react'
import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { TeacherRunner } from '@/lib/teach/teacher/toolkit'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import type { RetrievalStoreLike } from '@/features/teach/hooks/use-block-outcome'
import type { ActiveEditorRegistry } from '@/features/teach/state/active-editor-store'

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
 *  - `runner`          — the remote Cangjie runner `code_task` blocks compile and
 *    run against. Optional so document-only views and isolated tests can omit it;
 *    when absent, interactive `code_task` blocks fall back to their own default.
 *  - `activeEditor`    — the registry each `code_task` editor registers itself
 *    with when the learner works in it, so the teacher's `read_editor_code` /
 *    `set_editor_code` tools read/write whichever code_task is currently active.
 *  - `now`             — injected clock; surfaces never read `Date.now()` directly.
 *
 * Holding these behind one context keeps the views decoupled from how the shell
 * constructs them (IndexedDB repo in the app, fakes in tests).
 */
export interface WorkspaceContextValue {
  repo: WorkspaceRepository
  retrievalStore: RetrievalStoreLike
  knowledge: KnowledgeSource
  runner?: TeacherRunner
  activeEditor: ActiveEditorRegistry
  now: () => number
}

/** Re-exported for convenience so surfaces can type a runner result. */
export type { RunResult }

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
