import type { Lesson } from '@/lib/teach/lessons/lesson'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceScope } from './workspace-store'
import { describe, expect, it, vi } from 'vitest'
import { createObservableRepository } from './observable-repository'

const lesson: Lesson = {
  id: '0001',
  title: 't',
  missionLink: 'm',
  skillFocus: 's',
  zpdRationale: 'z',
  blocks: [{ type: 'prose', markdown: 'x' }],
  citations: [],
  state: { status: 'in_progress', blockProgress: {} },
  createdAt: 1,
}

/**
 * A repository stub where every method is a spy; tests override the few methods
 * they exercise. Only the methods under test need realistic return values.
 */
function makeRepo(overrides: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    getMission: vi.fn(),
    setMission: vi.fn(async () => {}),
    listLearningRecords: vi.fn(),
    appendLearningRecord: vi.fn(),
    supersedeLearningRecord: vi.fn(async () => true),
    getGlossary: vi.fn(),
    upsertGlossaryTerm: vi.fn(async () => {}),
    getNotes: vi.fn(),
    setNotes: vi.fn(async () => {}),
    listLessons: vi.fn(),
    getLesson: vi.fn(),
    appendLesson: vi.fn(),
    updateLessonState: vi.fn(async () => lesson),
    recordBlockOutcome: vi.fn(async () => lesson),
    listReferences: vi.fn(),
    getReference: vi.fn(),
    upsertReference: vi.fn(async () => {}),
    listRetrieval: vi.fn(),
    replaceRetrieval: vi.fn(async () => {}),
    exportAll: vi.fn(),
    importAll: vi.fn(async () => {}),
    ...overrides,
  } as unknown as WorkspaceRepository
}

describe('createObservableRepository', () => {
  it('passes reads through without firing onChange', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const repo = makeRepo({ getMission: vi.fn(async () => null) })
    const observed = createObservableRepository(repo, onChange)

    await observed.getMission()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fires onChange with the document scope after a successful write', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(makeRepo(), onChange)

    await observed.setMission({ topic: 't', why: 'w', successLooksLike: [], constraints: [], outOfScope: [], updatedAt: 1 })
    await observed.upsertGlossaryTerm({ term: 'let', definition: 'd' } as never)
    await observed.setNotes({ body: 'b' })
    await observed.upsertReference({ id: 'r1' } as never)

    expect(onChange.mock.calls.map(c => c[0])).toEqual(['mission', 'glossary', 'notes', 'references'])
  })

  it('maps lesson writes to the lessons scope', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(makeRepo(), onChange)

    await observed.recordBlockOutcome('0001', 'b0', { attempts: 1, correct: true })
    expect(onChange).toHaveBeenCalledWith('lessons')
  })

  it('does NOT fire when recordBlockOutcome no-ops on a missing lesson', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(
      makeRepo({ recordBlockOutcome: vi.fn(async () => null) }),
      onChange,
    )

    await observed.recordBlockOutcome('9999', 'b0', { attempts: 1 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does NOT fire when updateLessonState no-ops on a missing lesson', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(
      makeRepo({ updateLessonState: vi.fn(async () => null) }),
      onChange,
    )

    await observed.updateLessonState('9999', { status: 'in_progress', blockProgress: {} })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does NOT fire when supersedeLearningRecord no-ops on a missing record', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(
      makeRepo({ supersedeLearningRecord: vi.fn(async () => false) }),
      onChange,
    )

    await observed.supersedeLearningRecord('9999', '0001')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fires the learningRecords scope when supersede actually changes a record', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(
      makeRepo({ supersedeLearningRecord: vi.fn(async () => true) }),
      onChange,
    )

    await observed.supersedeLearningRecord('0001', '0002')
    expect(onChange).toHaveBeenCalledWith('learningRecords')
  })

  it('fires the all scope after importAll', async () => {
    const onChange = vi.fn<(scope: WorkspaceScope) => void>()
    const observed = createObservableRepository(makeRepo(), onChange)

    await observed.importAll({} as never)
    expect(onChange).toHaveBeenCalledWith('all')
  })
})
