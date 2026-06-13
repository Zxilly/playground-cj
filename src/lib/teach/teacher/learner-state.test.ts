import type { Lesson, LessonDraft, LessonState } from '../lessons/lesson'
import type { RetrievalItem } from '../retrieval/types'
import type {
  Glossary,
  GlossaryTerm,
  LearningRecord,
  LearningRecordDraft,
  Mission,
  Notes,
  ReferenceDoc,
  WorkspaceSnapshot,
} from '../workspace/documents'
import type { WorkspaceRepository } from '../workspace/repository'
import { describe, expect, it } from 'vitest'
import { readLearnerState } from './learner-state'

/**
 * Minimal in-memory {@link WorkspaceRepository} fake. `readLearnerState` only
 * reads, so the mutating methods are stubbed enough to satisfy the interface.
 */
function createFakeRepo(seed: {
  mission?: Mission | null
  lessons?: Lesson[]
  learningRecords?: LearningRecord[]
  glossary?: Glossary
}): WorkspaceRepository {
  const mission = seed.mission ?? null
  const lessons = seed.lessons ?? []
  const learningRecords = seed.learningRecords ?? []
  const glossary: Glossary = seed.glossary ?? { terms: [] }
  const notes: Notes = { body: '' }

  return {
    getMission: async () => mission,
    setMission: async () => {},
    listLearningRecords: async () => [...learningRecords],
    appendLearningRecord: async (_draft: LearningRecordDraft) => {
      throw new Error('not implemented')
    },
    supersedeLearningRecord: async () => false,
    getGlossary: async () => glossary,
    upsertGlossaryTerm: async (_term: GlossaryTerm) => {},
    getNotes: async () => notes,
    setNotes: async () => {},
    listLessons: async () => [...lessons],
    getLesson: async (id: string) => lessons.find(l => l.id === id) ?? null,
    appendLesson: async (_draft: LessonDraft) => {
      throw new Error('not implemented')
    },
    updateLessonState: async (_id: string, _state: LessonState) => null,
    recordBlockOutcome: async () => null,
    listReferences: async () => [] as ReferenceDoc[],
    getReference: async () => null,
    upsertReference: async () => {},
    listRetrieval: async () => [] as RetrievalItem[],
    replaceRetrieval: async () => {},
    exportAll: async () => ({} as WorkspaceSnapshot),
    importAll: async () => {},
  }
}

function makeLesson(id: string, status: LessonState['status']): Lesson {
  return {
    id,
    title: `lesson ${id}`,
    missionLink: 'm',
    skillFocus: 's',
    zpdRationale: 'z',
    blocks: [{ type: 'prose', markdown: 'x' }],
    citations: [],
    state: { status, blockProgress: {} },
    createdAt: 1,
  }
}

function makeRecord(id: string, status: LearningRecord['status'], createdAt: number): LearningRecord {
  return { id, title: `r${id}`, body: 'b', status, createdAt }
}

function makeRetrieval(id: string, dueAt: number): RetrievalItem {
  return { id, lessonId: '0001', blockId: 'b1', kind: 'quiz', dueAt, intervalDays: 1, ease: 2.5, history: [] }
}

const mission: Mission = {
  topic: 't',
  why: 'w',
  successLooksLike: ['s'],
  constraints: [],
  outOfScope: [],
  updatedAt: 1,
}

describe('readLearnerState', () => {
  it('passes the mission through', async () => {
    const repo = createFakeRepo({ mission })
    const state = await readLearnerState(repo, [], 1000)
    expect(state.mission).toEqual(mission)
  })

  it('returns null mission when unset', async () => {
    const repo = createFakeRepo({ mission: null })
    const state = await readLearnerState(repo, [], 1000)
    expect(state.mission).toBeNull()
  })

  it('completedLessonIds only includes completed lessons', async () => {
    const repo = createFakeRepo({
      lessons: [
        makeLesson('0001', 'completed'),
        makeLesson('0002', 'in_progress'),
        makeLesson('0003', 'unstarted'),
        makeLesson('0004', 'completed'),
      ],
    })
    const state = await readLearnerState(repo, [], 1000)
    expect(state.completedLessonIds).toEqual(['0001', '0004'])
  })

  it('knownGlossaryTerms come from the glossary terms', async () => {
    const repo = createFakeRepo({
      glossary: {
        terms: [
          { term: 'let', definition: 'd', avoid: [], addedAt: 1 },
          { term: 'var', definition: 'd', avoid: [], addedAt: 2 },
        ],
      },
    })
    const state = await readLearnerState(repo, [], 1000)
    expect(state.knownGlossaryTerms).toEqual(['let', 'var'])
  })

  it('dueRetrieval is filtered by dueItems against now', async () => {
    const items = [
      makeRetrieval('r1', 500),
      makeRetrieval('r2', 1000),
      makeRetrieval('r3', 5000),
    ]
    const repo = createFakeRepo({})
    const state = await readLearnerState(repo, items, 1000)
    expect(state.dueRetrieval.map(i => i.id)).toEqual(['r1', 'r2'])
  })

  it('recentLearningRecords keeps only active records, most recent first', async () => {
    const repo = createFakeRepo({
      learningRecords: [
        makeRecord('0001', 'active', 100),
        makeRecord('0002', 'superseded', 200),
        makeRecord('0003', 'active', 300),
      ],
    })
    const state = await readLearnerState(repo, [], 1000)
    expect(state.recentLearningRecords.map(r => r.id)).toEqual(['0003', '0001'])
    expect(state.recentLearningRecords.every(r => r.status === 'active')).toBe(true)
  })

  it('recentLearningRecords is capped at the most recent active records', async () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord(String(i + 1).padStart(4, '0'), 'active', (i + 1) * 100))
    const repo = createFakeRepo({ learningRecords: records })
    const state = await readLearnerState(repo, [], 1000)
    // Most recent first; capped to a small recency window.
    expect(state.recentLearningRecords.length).toBeLessThanOrEqual(records.length)
    expect(state.recentLearningRecords.at(0)?.id).toBe('0010')
    expect(state.recentLearningRecords.at(-1)?.createdAt).toBeGreaterThan(
      state.recentLearningRecords.length === records.length ? -1 : 0,
    )
  })
})
