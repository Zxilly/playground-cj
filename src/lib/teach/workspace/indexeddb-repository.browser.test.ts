import type { IDBPDatabase } from 'idb'
import type { WorkspaceRepository } from './repository'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createIndexedDbWorkspaceRepository } from './indexeddb-repository'

function freshRepo(): WorkspaceRepository {
  return createIndexedDbWorkspaceRepository(`test-${crypto.randomUUID()}`)
}

describe('indexeddb repository', () => {
  let repo: WorkspaceRepository
  beforeEach(() => {
    repo = freshRepo()
  })

  it('mission round-trips', async () => {
    expect(await repo.getMission()).toBeNull()
    await repo.setMission({ topic: 't', why: 'w', successLooksLike: ['s'], constraints: [], outOfScope: [], updatedAt: 1 })
    expect((await repo.getMission())?.topic).toBe('t')
  })

  it('appendLearningRecord assigns zero-padded incremental id', async () => {
    const a = await repo.appendLearningRecord({ title: 'a', body: 'b' })
    const b = await repo.appendLearningRecord({ title: 'c', body: 'd' })
    expect(a.id).toBe('0001')
    expect(b.id).toBe('0002')
    expect(a.status).toBe('active')
    const all = await repo.listLearningRecords()
    expect(all.map(r => r.id)).toEqual(['0001', '0002'])
  })

  it('supersedeLearningRecord marks the record superseded', async () => {
    const a = await repo.appendLearningRecord({ title: 'a', body: 'b' })
    await repo.supersedeLearningRecord(a.id, '0002')
    const all = await repo.listLearningRecords()
    expect(all[0].status).toBe('superseded')
    expect(all[0].supersededBy).toBe('0002')
  })

  it('appendLesson assigns id + default state', async () => {
    const l = await repo.appendLesson({ title: 't', missionLink: 'm', skillFocus: 's', zpdRationale: 'z', blocks: [{ type: 'prose', markdown: 'x' }], citations: [] })
    expect(l.id).toBe('0001')
    expect(l.state.status).toBe('unstarted')
    expect(l.state.blockProgress).toEqual({})
    expect(await repo.getLesson('0001')).not.toBeNull()
    expect(await repo.getLesson('9999')).toBeNull()
  })

  it('updateLessonState persists the new state', async () => {
    const l = await repo.appendLesson({ title: 't', missionLink: 'm', skillFocus: 's', zpdRationale: 'z', blocks: [{ type: 'prose', markdown: 'x' }], citations: [] })
    await repo.updateLessonState(l.id, { status: 'completed', blockProgress: {}, completedAt: 42 })
    const reloaded = await repo.getLesson(l.id)
    expect(reloaded?.state.status).toBe('completed')
    expect(reloaded?.state.completedAt).toBe(42)
  })

  it('glossary upsert replaces by term', async () => {
    await repo.upsertGlossaryTerm({ term: 'let', definition: 'immutable binding', avoid: [], addedAt: 1 })
    await repo.upsertGlossaryTerm({ term: 'let', definition: 'updated def', avoid: ['const'], addedAt: 2 })
    const glossary = await repo.getGlossary()
    expect(glossary.terms).toHaveLength(1)
    expect(glossary.terms[0].definition).toBe('updated def')
  })

  it('notes round-trip with default empty', async () => {
    expect((await repo.getNotes()).body).toBe('')
    await repo.setNotes({ body: 'prefers examples' })
    expect((await repo.getNotes()).body).toBe('prefers examples')
  })

  it('references upsert + list + get', async () => {
    await repo.upsertReference({ id: 'ref-1', title: 'Syntax card', blocks: [{ type: 'prose', markdown: 'x' }], updatedAt: 1 })
    expect((await repo.listReferences())).toHaveLength(1)
    expect((await repo.getReference('ref-1'))?.title).toBe('Syntax card')
    await repo.upsertReference({ id: 'ref-1', title: 'Updated card', blocks: [{ type: 'prose', markdown: 'y' }], updatedAt: 2 })
    expect((await repo.listReferences())).toHaveLength(1)
    expect((await repo.getReference('ref-1'))?.title).toBe('Updated card')
  })

  it('serializes concurrent learning-record appends without id collisions', async () => {
    const results = await Promise.all([
      repo.appendLearningRecord({ title: 'a', body: 'b' }),
      repo.appendLearningRecord({ title: 'c', body: 'd' }),
      repo.appendLearningRecord({ title: 'e', body: 'f' }),
    ])
    const ids = results.map(r => r.id).sort()
    expect(ids).toEqual(['0001', '0002', '0003'])
  })

  it('export then import reproduces state', async () => {
    await repo.setMission({ topic: 't', why: 'w', successLooksLike: ['s'], constraints: [], outOfScope: [], updatedAt: 1 })
    await repo.appendLearningRecord({ title: 'a', body: 'b' })
    await repo.upsertGlossaryTerm({ term: 'let', definition: 'd', avoid: [], addedAt: 1 })
    await repo.appendLesson({ title: 't', missionLink: 'm', skillFocus: 's', zpdRationale: 'z', blocks: [{ type: 'prose', markdown: 'x' }], citations: [] })
    await repo.setNotes({ body: 'note' })

    const snap = await repo.exportAll()
    expect(snap.version).toBe(1)
    expect(snap.mission?.topic).toBe('t')
    expect(snap.learningRecords).toHaveLength(1)
    expect(snap.lessons).toHaveLength(1)

    const repo2 = freshRepo()
    await repo2.importAll(snap)
    expect((await repo2.getMission())?.topic).toBe('t')
    expect(await repo2.listLearningRecords()).toHaveLength(1)
    expect((await repo2.getGlossary()).terms).toHaveLength(1)
    expect(await repo2.listLessons()).toHaveLength(1)
    expect((await repo2.getNotes()).body).toBe('note')
  })

  it('importAll clears existing data before applying snapshot', async () => {
    await repo.appendLearningRecord({ title: 'pre-existing', body: 'b' })
    const emptySnap = await freshRepo().exportAll()
    await repo.importAll(emptySnap)
    expect(await repo.listLearningRecords()).toHaveLength(0)
    expect(await repo.getMission()).toBeNull()
  })

  it('importAll rejects an invalid snapshot', async () => {
    await expect(repo.importAll({ version: 1, foo: 'bar' } as never)).rejects.toThrow()
  })

  it('appends after a gapped-id import without colliding (max-id, not count)', async () => {
    // A hand-edited export can leave id gaps (here 0001, 0003 — 0002 removed).
    // count()+1 would hand out 0003 and overwrite the imported record; the next
    // id must be max(id)+1 = 0004.
    const snap = await freshRepo().exportAll()
    snap.learningRecords.push(
      { id: '0001', title: 'a', body: 'b', status: 'active', createdAt: 1 },
      { id: '0003', title: 'c', body: 'd', status: 'active', createdAt: 2 },
    )
    await repo.importAll(snap)
    const next = await repo.appendLearningRecord({ title: 'e', body: 'f' })
    expect(next.id).toBe('0004')
    expect(await repo.listLearningRecords()).toHaveLength(3)
  })

  it('export reflects retrieval items round-trip', async () => {
    const snap = await repo.exportAll()
    snap.retrieval.push({ id: 'r1', lessonId: '0001', blockId: 'b1', kind: 'quiz', dueAt: 0, intervalDays: 1, ease: 2.5, history: [] })
    const repo2 = freshRepo()
    await repo2.importAll(snap)
    const reloaded = await repo2.exportAll()
    expect(reloaded.retrieval).toHaveLength(1)
    expect(reloaded.retrieval[0].id).toBe('r1')
  })

  it('reopens the database after a failed first open (does not cache a rejected promise)', async () => {
    const dbName = `test-${crypto.randomUUID()}`
    let attempt = 0
    const open: typeof openDB = ((...args: Parameters<typeof openDB>) => {
      attempt += 1
      if (attempt === 1)
        return Promise.reject(new Error('boom')) as ReturnType<typeof openDB>
      return openDB(...args) as ReturnType<typeof openDB>
    }) as typeof openDB
    const flaky = createIndexedDbWorkspaceRepository(dbName, open)

    // First call surfaces the open failure.
    await expect(flaky.getMission()).rejects.toThrow('boom')
    // A retry must re-attempt the open instead of reusing the rejected promise.
    await flaky.setMission({ topic: 't', why: 'w', successLooksLike: ['s'], constraints: [], outOfScope: [], updatedAt: 1 })
    expect((await flaky.getMission())?.topic).toBe('t')
    expect(attempt).toBe(2)
  })

  it('glossary upsert dedupes case-insensitively, last write wins', async () => {
    await repo.upsertGlossaryTerm({ term: 'Option', definition: 'first', avoid: [], addedAt: 1 })
    await repo.upsertGlossaryTerm({ term: 'option', definition: 'second', avoid: [], addedAt: 2 })
    const glossary = await repo.getGlossary()
    expect(glossary.terms).toHaveLength(1)
    expect(glossary.terms[0].definition).toBe('second')
    expect(glossary.terms[0].term).toBe('option')
  })

  it('exportAll is best-effort: a single corrupt record never blocks the export', async () => {
    const dbName = `test-${crypto.randomUUID()}`
    const repoX = createIndexedDbWorkspaceRepository(dbName)
    // Seed one good lesson through the repo.
    await repoX.appendLesson({ title: 't', missionLink: 'm', skillFocus: 's', zpdRationale: 'z', blocks: [{ type: 'prose', markdown: 'x' }], citations: [] })

    // Inject a record that does not satisfy the lesson schema directly into the
    // store, bypassing the repo's validation.
    const db = await openDB(dbName, 1) as IDBPDatabase
    await db.put('lessons', { id: '9999', garbage: true })
    db.close()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let snap
    try {
      snap = await repoX.exportAll()
    }
    finally {
      warn.mockRestore()
    }
    expect(snap.lessons).toHaveLength(1)
    expect(snap.lessons[0].id).toBe('0001')
    expect(snap.lessons.some(l => l.id === '9999')).toBe(false)
  })

  it('recordBlockOutcome merges block outcomes without losing prior blocks', async () => {
    const l = await repo.appendLesson({ title: 't', missionLink: 'm', skillFocus: 's', zpdRationale: 'z', blocks: [{ type: 'prose', markdown: 'x' }], citations: [] })
    await repo.recordBlockOutcome(l.id, 'b0', { attempts: 1, correct: true })
    const after = await repo.recordBlockOutcome(l.id, 'b1', { attempts: 2, correct: false })
    expect(after).not.toBeNull()
    expect(Object.keys(after!.state.blockProgress).sort()).toEqual(['b0', 'b1'])
    expect(after!.state.blockProgress.b0.correct).toBe(true)
    expect(after!.state.blockProgress.b1.attempts).toBe(2)
    expect(after!.state.status).toBe('in_progress')

    const reloaded = await repo.getLesson(l.id)
    expect(Object.keys(reloaded!.state.blockProgress).sort()).toEqual(['b0', 'b1'])
  })

  it('recordBlockOutcome returns null for a missing lesson', async () => {
    expect(await repo.recordBlockOutcome('9999', 'b0', { attempts: 1 })).toBeNull()
  })

  it('recordBlockOutcome keeps a completed lesson completed', async () => {
    const l = await repo.appendLesson({ title: 't', missionLink: 'm', skillFocus: 's', zpdRationale: 'z', blocks: [{ type: 'prose', markdown: 'x' }], citations: [] })
    await repo.updateLessonState(l.id, { status: 'completed', blockProgress: {}, completedAt: 5 })
    const after = await repo.recordBlockOutcome(l.id, 'b0', { attempts: 1, correct: true })
    expect(after!.state.status).toBe('completed')
  })

  it('replaceRetrieval + listRetrieval round-trip', async () => {
    expect(await repo.listRetrieval()).toEqual([])
    const items = [
      { id: 'r1', lessonId: '0001', blockId: 'b1', kind: 'quiz' as const, dueAt: 10, intervalDays: 1, ease: 2.5, history: [] },
      { id: 'r2', lessonId: '0001', blockId: 'b2', kind: 'recall' as const, dueAt: 20, intervalDays: 3, ease: 2.6, history: [{ at: 1, grade: 'good' as const }] },
    ]
    await repo.replaceRetrieval(items)
    const reloaded = await repo.listRetrieval()
    expect(reloaded).toHaveLength(2)
    expect(reloaded.map(r => r.id).sort()).toEqual(['r1', 'r2'])

    // Replace fully overwrites, never merges.
    await repo.replaceRetrieval([{ id: 'r3', lessonId: '0002', blockId: 'b9', kind: 'quiz' as const, dueAt: 30, intervalDays: 5, ease: 2.7, history: [] }])
    const afterReplace = await repo.listRetrieval()
    expect(afterReplace.map(r => r.id)).toEqual(['r3'])
  })
})
