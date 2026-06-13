import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { RetrievalStore } from '@/lib/teach/teacher/toolkit'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'

/**
 * A minimal in-memory {@link RetrievalStore}. Useful for tests and as a default
 * before a repository is available; it owns no storage and is lost on reload.
 * The live workspace uses {@link createIdbRetrievalStore} instead so the
 * SM-2 schedule survives refreshes. The `{ list, save }` contract is stable, so
 * either implementation drops into the same call sites.
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

/**
 * An IndexedDB-backed {@link RetrievalStore} layered over a
 * {@link WorkspaceRepository}. The spaced-retrieval schedule is owned by the
 * repository's `retrieval` store (so it survives refreshes and is included in
 * `exportAll` / `importAll`), while this adapter keeps a synchronous in-memory
 * cache so `list()` is cheap and `save()` is observed immediately by the next
 * `read_learner_state` read.
 *
 * Persistence is funnelled back through the same repository instance, so every
 * write rides the repository's serial write queue (no interleaving with other
 * workspace mutations) and `exportAll` on that repo always sees the latest
 * schedule. `save()` updates the cache synchronously — so a concurrent `list()`
 * never regresses to an earlier or empty state mid-write — and the returned
 * promise resolves once the `replaceRetrieval` persist commits, so callers that
 * need durability (e.g. before a reload) can await it.
 */
export function createIdbRetrievalStore(repo: WorkspaceRepository): RetrievalStore {
  // The cache starts as the repository's already-persisted schedule. Until that
  // initial load resolves, `list()` awaits it; afterwards `cache` holds the
  // authoritative items and `ready` short-circuits.
  let cache: RetrievalItem[] = []
  let ready = false
  const initialLoad = repo.listRetrieval().then((items) => {
    // A `save()` that landed before the initial load resolved already advanced
    // the cache and persisted; don't clobber it with the stale pre-save read.
    if (!ready) {
      cache = items
      ready = true
    }
  })

  return {
    list: async () => {
      if (!ready)
        await initialLoad
      return cache
    },
    save: async (next) => {
      // Advance the cache synchronously so reads observe the write immediately,
      // then persist through the repo's serial write queue. `replaceRetrieval`
      // already enqueues atomically, so awaiting it both reports the commit and
      // preserves save ordering.
      cache = next
      ready = true
      await repo.replaceRetrieval(next)
    },
  }
}
