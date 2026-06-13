import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { RetrievalStore, TeacherRunner } from '@/lib/teach/teacher/toolkit'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import { createIndexedDbWorkspaceRepository } from '@/lib/teach/workspace/indexeddb-repository'
import { createCangjieMcpKnowledgeSource } from '@/lib/teach/knowledge/cangjie-mcp-source'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'
import { createIdbRetrievalStore } from './retrieval-store'

/**
 * The full set of runtime collaborators a live teaching workspace needs. Mirrors
 * the {@link WorkspaceContextValue} shape (sans the optional clock default) so the
 * app can hand the bundle straight to the {@link WorkspaceProvider}.
 */
export interface WorkspaceCollaborators {
  repo: WorkspaceRepository
  retrievalStore: RetrievalStore
  knowledge: KnowledgeSource
  runner: TeacherRunner
  now: () => number
}

/**
 * Build the live collaborators for a teaching workspace, keyed by UI language so
 * the `zh` and `en` workspaces persist to separate IndexedDB databases (their
 * lessons / glossary are authored in that language).
 *
 *  - `repo`           — IndexedDB-backed {@link WorkspaceRepository}.
 *  - `retrievalStore` — IndexedDB-backed spaced-retrieval schedule (shares the
 *    same repo instance, so it persists across reloads and is captured by
 *    `exportAll`).
 *  - `knowledge`      — Cangjie MCP knowledge source.
 *  - `runner`         — remote Cangjie runner wrapper.
 *  - `now`            — wall clock.
 */
export function createWorkspaceCollaborators(lang: string): WorkspaceCollaborators {
  const dbName = `teach-workspace-${lang === 'en' ? 'en' : 'zh'}`
  // The retrieval store shares this repo instance so its writes ride the repo's
  // serial write queue and `exportAll` observes the same persisted schedule.
  const repo = createIndexedDbWorkspaceRepository(dbName)
  return {
    repo,
    retrievalStore: createIdbRetrievalStore(repo),
    knowledge: createCangjieMcpKnowledgeSource(),
    runner: { run: runCangjieCode },
    now: () => Date.now(),
  }
}
