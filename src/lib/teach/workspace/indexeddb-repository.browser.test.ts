import type { WorkspaceRepository } from './repository'
import { beforeEach, describe, expect, it } from 'vitest'
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

  it('export reflects retrieval items round-trip', async () => {
    const snap = await repo.exportAll()
    snap.retrieval.push({ id: 'r1', lessonId: '0001', blockId: 'b1', kind: 'quiz', dueAt: 0, intervalDays: 1, ease: 2.5, history: [] })
    const repo2 = freshRepo()
    await repo2.importAll(snap)
    const reloaded = await repo2.exportAll()
    expect(reloaded.retrieval).toHaveLength(1)
    expect(reloaded.retrieval[0].id).toBe('r1')
  })
})
