import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { createIndexedDbWorkspaceRepository } from '@/lib/teach/workspace/indexeddb-repository'
import { createIdbRetrievalStore } from './retrieval-store'

function makeItem(id: string, dueAt: number): RetrievalItem {
  return { id, lessonId: '0001', blockId: id, kind: 'quiz', dueAt, intervalDays: 1, ease: 2.5, history: [] }
}

describe('createIdbRetrievalStore', () => {
  let dbName: string
  beforeEach(() => {
    dbName = `test-retrieval-${crypto.randomUUID()}`
  })

  it('list is empty for a fresh database', async () => {
    const repo = createIndexedDbWorkspaceRepository(dbName)
    const store = createIdbRetrievalStore(repo)
    expect(await store.list()).toEqual([])
  })

  it('save persists to IDB so a fresh store on the same db reloads it', async () => {
    const repo = createIndexedDbWorkspaceRepository(dbName)
    const store = createIdbRetrievalStore(repo)
    const items = [makeItem('r1', 10), makeItem('r2', 20)]
    await store.save(items)

    // Simulate a reload: brand-new repo + store pointed at the same db name.
    const repo2 = createIndexedDbWorkspaceRepository(dbName)
    const store2 = createIdbRetrievalStore(repo2)
    const reloaded = await store2.list()
    expect(reloaded.map(i => i.id).sort()).toEqual(['r1', 'r2'])
  })

  it('list reflects items written through the repo before the store loaded', async () => {
    const repo = createIndexedDbWorkspaceRepository(dbName)
    await repo.replaceRetrieval([makeItem('r9', 5)])
    const store = createIdbRetrievalStore(repo)
    expect((await store.list()).map(i => i.id)).toEqual(['r9'])
  })

  it('save is observable through the same repo (exportAll sees the items)', async () => {
    const repo = createIndexedDbWorkspaceRepository(dbName)
    const store = createIdbRetrievalStore(repo)
    await store.save([makeItem('r1', 10)])
    const snap = await repo.exportAll()
    expect(snap.retrieval.map(i => i.id)).toEqual(['r1'])
  })

  it('save fully replaces the prior schedule', async () => {
    const repo = createIndexedDbWorkspaceRepository(dbName)
    const store = createIdbRetrievalStore(repo)
    await store.save([makeItem('r1', 10), makeItem('r2', 20)])
    await store.save([makeItem('r3', 30)])
    expect((await store.list()).map(i => i.id)).toEqual(['r3'])

    const repo2 = createIndexedDbWorkspaceRepository(dbName)
    const store2 = createIdbRetrievalStore(repo2)
    expect((await store2.list()).map(i => i.id)).toEqual(['r3'])
  })

  it('list returns the latest in-memory cache without waiting on the persist round-trip', async () => {
    const repo = createIndexedDbWorkspaceRepository(dbName)
    const store = createIdbRetrievalStore(repo)
    await store.save([makeItem('r1', 10)])
    // Cache reflects the save immediately; a subsequent list never regresses to
    // an earlier (or empty) state even though persistence is fire-and-forget.
    expect((await store.list()).map(i => i.id)).toEqual(['r1'])
  })
})
