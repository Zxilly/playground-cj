import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { RetrievalStore } from '@/lib/teach/teacher/toolkit'

/**
 * A minimal in-memory {@link RetrievalStore}. The spaced-retrieval schedule is
 * seeded/advanced by quiz/recall outcomes during a session and folded into
 * `read_learner_state`; cross-session persistence rides along with the workspace
 * snapshot at the repository level (export/import), so this store does not own
 * its own storage. Replaceable by an IndexedDB-backed store later without
 * touching call sites — the `{ list, save }` contract is stable.
 */
export function createInMemoryRetrievalStore(initial: RetrievalItem[] = []): RetrievalStore {
  let items = initial
  return {
    list: async () => items,
    save: async (next) => {
      items = next
    },
  }
}
