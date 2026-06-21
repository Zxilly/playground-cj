import type { KnowledgeHit, KnowledgeSource } from '../knowledge/source'
import type { TourOutlineChapter, TourSource, TourStep } from '../knowledge/tour-source'
import type { RunResult } from '../feedback/run-cangjie'
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
import type { Lesson, LessonDraft, LessonState } from '../lessons/lesson'
import type { EditorBridge, RetrievalStore, TeacherRunner } from './toolkit'
import { describe, expect, it, vi } from 'vitest'
import { createTeacherToolkit } from './toolkit'

/** In-memory {@link WorkspaceRepository} fake that actually persists writes. */
function createMemoryRepo(): WorkspaceRepository {
  let mission: Mission | null = null
  const learningRecords: LearningRecord[] = []
  let glossary: Glossary = { terms: [] }
  let notes: Notes = { body: '' }
  const lessons: Lesson[] = []
  const references: ReferenceDoc[] = []
  const retrieval: RetrievalItem[] = []
  let recordSeq = 0
  let lessonSeq = 0
  const pad = (n: number) => String(n).padStart(4, '0')

  return {
    getMission: async () => mission,
    setMission: async (m) => {
      mission = m
    },
    listLearningRecords: async () => [...learningRecords],
    appendLearningRecord: async (draft: LearningRecordDraft) => {
      recordSeq += 1
      const record: LearningRecord = {
        id: pad(recordSeq),
        title: draft.title,
        body: draft.body,
        evidence: draft.evidence,
        status: 'active',
        createdAt: 1,
      }
      learningRecords.push(record)
      return record
    },
    supersedeLearningRecord: async (id, supersededBy) => {
      const record = learningRecords.find(r => r.id === id)
      if (!record)
        return false
      record.status = 'superseded'
      record.supersededBy = supersededBy
      return true
    },
    getGlossary: async () => glossary,
    upsertGlossaryTerm: async (term: GlossaryTerm) => {
      // Match the production repo's normalized dedup key (trim + lowercase) so the
      // fake stays a faithful regression guard for case/whitespace term variants.
      const key = (t: string) => t.trim().toLowerCase()
      const next = glossary.terms.filter(t => key(t.term) !== key(term.term))
      next.push(term)
      glossary = { terms: next }
    },
    getNotes: async () => notes,
    setNotes: async (n) => {
      notes = n
    },
    listLessons: async () => [...lessons],
    getLesson: async (id: string) => lessons.find(l => l.id === id) ?? null,
    appendLesson: async (draft: LessonDraft) => {
      lessonSeq += 1
      const lesson: Lesson = {
        ...draft,
        id: pad(lessonSeq),
        state: { status: 'unstarted', blockProgress: {} },
        createdAt: 1,
      }
      lessons.push(lesson)
      return lesson
    },
    updateLessonState: async (id: string, state: LessonState) => {
      const lesson = lessons.find(l => l.id === id)
      if (!lesson)
        return null
      lesson.state = state
      return lesson
    },
    recordBlockOutcome: async (lessonId, blockId, outcome) => {
      const lesson = lessons.find(l => l.id === lessonId)
      if (!lesson)
        return null
      lesson.state = {
        ...lesson.state,
        status: lesson.state.status === 'completed' ? 'completed' : 'in_progress',
        blockProgress: { ...lesson.state.blockProgress, [blockId]: outcome },
      }
      return lesson
    },
    listReferences: async () => [...references],
    getReference: async (id: string) => references.find(r => r.id === id) ?? null,
    upsertReference: async (ref: ReferenceDoc) => {
      const idx = references.findIndex(r => r.id === ref.id)
      if (idx >= 0)
        references[idx] = ref
      else
        references.push(ref)
    },
    listRetrieval: async () => [...retrieval],
    replaceRetrieval: async (items) => {
      retrieval.length = 0
      retrieval.push(...items)
    },
    exportAll: async () => ({} as WorkspaceSnapshot),
    importAll: async () => {},
  }
}

function createFakeKnowledge(hits: KnowledgeHit[]): KnowledgeSource & { search: ReturnType<typeof vi.fn> } {
  const search = vi.fn(async () => hits)
  return { id: 'cangjie-mcp', search }
}

/**
 * Fake {@link TourSource} backing `list_tour` / `read_tour`. `outline` returns the
 * seeded chapters; `read` returns the seeded step keyed by id (null when missing),
 * mirroring the live accessor's graceful degradation.
 */
function createFakeTour(overrides: {
  outline?: TourOutlineChapter[]
  steps?: Record<string, TourStep>
} = {}): TourSource & { outline: ReturnType<typeof vi.fn>, read: ReturnType<typeof vi.fn> } {
  const steps = overrides.steps ?? {}
  const outline = vi.fn(async () => overrides.outline ?? [])
  const read = vi.fn(async (id: string) => steps[id] ?? null)
  return { outline, read }
}

function createFakeRunner(result: RunResult): TeacherRunner & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => result)
  return { run }
}

/**
 * A fake "active code_task editor" bridge backed by a plain string. `getCode`
 * returns null when there is no active editor (mirroring the live
 * {@link createActiveEditorRegistry}); `setCode` reports whether the write landed.
 */
function createFakeEditor(initial: string | null = 'main() {}'): EditorBridge & {
  getCode: ReturnType<typeof vi.fn>
  setCode: ReturnType<typeof vi.fn>
} {
  let code = initial
  const getCode = vi.fn(() => code)
  const setCode = vi.fn((next: string) => {
    if (code === null)
      return false
    code = next
    return true
  })
  return { getCode, setCode }
}

function createMemoryRetrievalStore(seed: RetrievalItem[] = []): RetrievalStore {
  let items = [...seed]
  return {
    list: async () => [...items],
    save: async (next) => {
      items = [...next]
    },
  }
}

const runResult: RunResult = { ok: true, stdout: 'hi\n', stderr: '', exitCode: 0 }

function setup(overrides: {
  knowledgeHits?: KnowledgeHit[]
  tourOutline?: TourOutlineChapter[]
  tourSteps?: Record<string, TourStep>
  retrieval?: RetrievalItem[]
  now?: () => number
  editorCode?: string | null
  lang?: 'zh' | 'en'
} = {}) {
  const repo = createMemoryRepo()
  const knowledge = createFakeKnowledge(overrides.knowledgeHits ?? [])
  const tour = createFakeTour({ outline: overrides.tourOutline, steps: overrides.tourSteps })
  const runner = createFakeRunner(runResult)
  const retrievalStore = createMemoryRetrievalStore(overrides.retrieval ?? [])
  const editor = createFakeEditor(overrides.editorCode === undefined ? 'main() {}' : overrides.editorCode)
  const now = overrides.now ?? (() => 123)
  const lang = overrides.lang ?? 'zh'
  const toolkit = createTeacherToolkit({ repo, knowledge, tour, runner, retrievalStore, editor, lang, now })
  return { repo, knowledge, tour, runner, retrievalStore, editor, toolkit }
}

async function call<T = unknown>(tool: unknown, input: unknown): Promise<T> {
  const execute = (tool as { execute: (input: unknown, options: unknown) => Promise<T> }).execute
  return execute(input, { toolCallId: 't', messages: [] })
}

/** Invoke a tool's execute with an abort signal in the call options. */
async function callWithSignal<T = unknown>(tool: unknown, input: unknown, signal: AbortSignal): Promise<T> {
  const execute = (tool as { execute: (input: unknown, options: unknown) => Promise<T> }).execute
  return execute(input, { toolCallId: 't', messages: [], abortSignal: signal })
}

/** A runner whose run rejects with an AbortError, simulating a cancelled fetch. */
function createAbortingRunner(): TeacherRunner & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    throw error
  })
  return { run }
}

describe('createTeacherToolkit', () => {
  it('exposes the full tool set', () => {
    const { toolkit } = setup()
    const names = Object.keys(toolkit)
    expect(names).toEqual(
      expect.arrayContaining([
        'read_mission',
        'read_learning_records',
        'read_glossary',
        'read_notes',
        'list_lessons',
        'read_lesson',
        'list_references',
        'read_learner_state',
        'set_mission',
        'append_learning_record',
        'supersede_learning_record',
        'upsert_glossary_term',
        'set_notes',
        'upsert_reference',
        'create_lesson',
        'update_lesson_state',
        'mark_lesson_complete',
        'list_tour',
        'read_tour',
        'search_docs',
        'set_editor_code',
        'read_editor_code',
        'run_code',
        'read_run_result',
      ]),
    )
  })

  it('every tool has a description and an inputSchema', () => {
    const { toolkit } = setup()
    for (const [name, tool] of Object.entries(toolkit)) {
      expect(typeof (tool as { description?: unknown }).description, name).toBe('string')
      expect((tool as { inputSchema?: unknown }).inputSchema, name).toBeDefined()
    }
  })

  it('create_lesson uses lessonDraftSchema as its inputSchema and persists, returning the id', async () => {
    const { toolkit, repo } = setup()
    const draft = {
      title: 'let vs var',
      missionLink: 'build a CLI',
      skillFocus: 'declare bindings',
      zpdRationale: 'knows nothing yet',
      blocks: [{ type: 'prose', markdown: 'x' }],
      citations: [],
    }
    const result = await call<{ ok: boolean, id?: string }>(toolkit.create_lesson, draft)
    expect(result.ok).toBe(true)
    expect(result.id).toBe('0001')
    const lessons = await repo.listLessons()
    expect(lessons).toHaveLength(1)
    expect(lessons[0].title).toBe('let vs var')

    // The inputSchema must reject an invalid draft (empty blocks).
    const schema = (toolkit.create_lesson as { inputSchema: { safeParse: (v: unknown) => { success: boolean } } }).inputSchema
    expect(schema.safeParse({ ...draft, blocks: [] }).success).toBe(false)
    expect(schema.safeParse(draft).success).toBe(true)
  })

  it('search_docs forwards the query and limit to the knowledge source', async () => {
    const hits: KnowledgeHit[] = [{ sourceId: 'cangjie-mcp', ref: 'std/option', title: 'Option', snippet: 's' }]
    const { toolkit, knowledge } = setup({ knowledgeHits: hits })
    const result = await call<{ ok: boolean, hits?: KnowledgeHit[] }>(toolkit.search_docs, { query: 'option', limit: 3 })
    expect(knowledge.search).toHaveBeenCalledWith('option', { limit: 3 })
    expect(result.ok).toBe(true)
    expect(result.hits).toEqual(hits)
  })

  it('set_mission persists and read_mission reflects it (with a server-supplied timestamp)', async () => {
    const { toolkit, repo } = setup({ now: () => 999 })
    await call(toolkit.set_mission, {
      topic: 'Cangjie CLI',
      why: 'ship a tool',
      successLooksLike: ['parse args'],
      constraints: [],
      outOfScope: [],
    })
    const mission = await repo.getMission()
    expect(mission?.topic).toBe('Cangjie CLI')
    expect(mission?.updatedAt).toBe(999)

    const read = await call<{ ok: boolean, mission?: Mission | null }>(toolkit.read_mission, {})
    expect(read.mission?.topic).toBe('Cangjie CLI')
  })

  it('run_code runs through the runner and read_run_result returns the last result', async () => {
    const { toolkit, runner } = setup()
    const ran = await call<{ ok: boolean, result?: RunResult }>(toolkit.run_code, { code: 'main() {}' })
    expect(runner.run).toHaveBeenCalledWith('main() {}', undefined)
    expect(ran.result?.stdout).toBe('hi\n')

    const last = await call<{ ok: boolean, result?: RunResult | null }>(toolkit.read_run_result, {})
    expect(last.result?.stdout).toBe('hi\n')
  })

  it('read_editor_code returns the active code_task editor\'s current code', async () => {
    const { toolkit, editor } = setup({ editorCode: 'let x = 1' })
    const result = await call<{ ok: boolean, code?: string | null }>(toolkit.read_editor_code, {})
    expect(editor.getCode).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result.code).toBe('let x = 1')
  })

  it('read_editor_code reports no active editor (null code) when none is mounted', async () => {
    const { toolkit } = setup({ editorCode: null })
    const result = await call<{ ok: boolean, code?: string | null }>(toolkit.read_editor_code, {})
    expect(result.ok).toBe(true)
    expect(result.code).toBeNull()
  })

  it('set_editor_code writes into the active code_task editor', async () => {
    const { toolkit, editor } = setup()
    const result = await call<{ ok: boolean }>(toolkit.set_editor_code, { code: 'main() { println("hi") }' })
    expect(editor.setCode).toHaveBeenCalledWith('main() { println("hi") }')
    expect(result.ok).toBe(true)
    expect(editor.getCode()).toBe('main() { println("hi") }')
  })

  it('set_editor_code fails clearly when no code_task editor is active', async () => {
    const { toolkit } = setup({ editorCode: null })
    const result = await call<{ ok: boolean, error?: string }>(toolkit.set_editor_code, { code: 'x' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no active/i)
  })

  it('append_learning_record persists a record and returns its id', async () => {
    const { toolkit, repo } = setup()
    const result = await call<{ ok: boolean, id?: string }>(toolkit.append_learning_record, {
      title: 'understands let vs var',
      body: 'learner explained immutability unprompted',
    })
    expect(result.ok).toBe(true)
    expect(result.id).toBe('0001')
    const records = await repo.listLearningRecords()
    expect(records).toHaveLength(1)
    expect(records[0].status).toBe('active')
  })

  it('upsert_glossary_term adds a term with a server timestamp', async () => {
    const { toolkit, repo } = setup({ now: () => 555 })
    await call(toolkit.upsert_glossary_term, { term: 'let', definition: 'immutable binding', avoid: [] })
    const glossary = await repo.getGlossary()
    expect(glossary.terms).toHaveLength(1)
    expect(glossary.terms[0].term).toBe('let')
    expect(glossary.terms[0].addedAt).toBe(555)
  })

  it('mark_lesson_complete sets the lesson status to completed', async () => {
    const { toolkit, repo } = setup({ now: () => 777 })
    await repo.appendLesson({
      title: 't',
      missionLink: 'm',
      skillFocus: 's',
      zpdRationale: 'z',
      blocks: [{ type: 'prose', markdown: 'x' }],
      citations: [],
    })
    const result = await call<{ ok: boolean }>(toolkit.mark_lesson_complete, { id: '0001' })
    expect(result.ok).toBe(true)
    const lesson = await repo.getLesson('0001')
    expect(lesson?.state.status).toBe('completed')
    expect(lesson?.state.completedAt).toBe(777)
  })

  it('read_learner_state aggregates repo + due retrieval against now', async () => {
    const retrieval: RetrievalItem[] = [
      { id: 'r1', lessonId: '0001', blockId: 'b1', kind: 'quiz', dueAt: 100, intervalDays: 1, ease: 2.5, history: [] },
      { id: 'r2', lessonId: '0001', blockId: 'b2', kind: 'recall', dueAt: 9999, intervalDays: 1, ease: 2.5, history: [] },
    ]
    const { toolkit, repo } = setup({ retrieval, now: () => 1000 })
    await repo.setMission({ topic: 't', why: 'w', successLooksLike: ['s'], constraints: [], outOfScope: [], updatedAt: 1 })
    const result = await call<{ ok: boolean, state?: { mission: Mission | null, dueRetrieval: RetrievalItem[] } }>(
      toolkit.read_learner_state,
      {},
    )
    expect(result.ok).toBe(true)
    expect(result.state?.mission?.topic).toBe('t')
    expect(result.state?.dueRetrieval.map(i => i.id)).toEqual(['r1'])
  })

  it('upsert_reference persists a reference with a server timestamp', async () => {
    const { toolkit, repo } = setup({ now: () => 444 })
    await call(toolkit.upsert_reference, {
      id: 'ref-1',
      title: 'syntax card',
      blocks: [{ type: 'prose', markdown: 'x' }],
    })
    const ref = await repo.getReference('ref-1')
    expect(ref?.title).toBe('syntax card')
    expect(ref?.updatedAt).toBe(444)
  })

  it('run_code returns a "User aborted" result without invoking the runner when already aborted', async () => {
    const { toolkit, runner } = setup()
    const controller = new AbortController()
    controller.abort()
    const result = await callWithSignal<{ ok: boolean, error?: string, aborted?: boolean }>(
      toolkit.run_code,
      { code: 'main() {}' },
      controller.signal,
    )
    expect(result).toMatchObject({ ok: false, error: 'User aborted', aborted: true })
    expect(runner.run).not.toHaveBeenCalled()
  })

  it('run_code threads the abort signal to the runner and maps a runner abort to "User aborted"', async () => {
    const repo = createMemoryRepo()
    const runner = createAbortingRunner()
    const toolkit = createTeacherToolkit({
      repo,
      knowledge: createFakeKnowledge([]),
      tour: createFakeTour(),
      runner,
      retrievalStore: createMemoryRetrievalStore(),
      editor: createFakeEditor(),
      lang: 'zh',
      now: () => 1,
    })
    const controller = new AbortController()
    const result = await callWithSignal<{ ok: boolean, error?: string }>(
      toolkit.run_code,
      { code: 'main() {}' },
      controller.signal,
    )
    expect(runner.run).toHaveBeenCalledWith('main() {}', controller.signal)
    expect(result).toMatchObject({ ok: false, error: 'User aborted' })
  })

  it('search_docs threads the abort signal to the knowledge source', async () => {
    const { toolkit, knowledge } = setup()
    const controller = new AbortController()
    await callWithSignal(toolkit.search_docs, { query: 'option', limit: 3 }, controller.signal)
    expect(knowledge.search).toHaveBeenCalledWith('option', { limit: 3, signal: controller.signal })
  })

  it('list_tour returns the curated outline for the workspace language', async () => {
    const outline: TourOutlineChapter[] = [
      { id: 'basics', title: '基础', steps: [{ id: 'basics/1', chapter: '基础', title: '绑定' }] },
    ]
    const { toolkit, tour } = setup({ tourOutline: outline, lang: 'zh' })
    const result = await call<{ ok: boolean, outline?: TourOutlineChapter[] }>(toolkit.list_tour, {})
    expect(tour.outline).toHaveBeenCalledWith('zh', { signal: undefined })
    expect(result.ok).toBe(true)
    expect(result.outline).toEqual(outline)
  })

  it('read_tour returns a curated step by id in the workspace language', async () => {
    const step: TourStep = {
      id: 'basics/1',
      lang: 'en',
      chapter: 'Basics',
      title: 'Bindings',
      markdown: '# Bindings',
      code: 'main() {}',
    }
    const { toolkit, tour } = setup({ tourSteps: { 'basics/1': step }, lang: 'en' })
    const result = await call<{ ok: boolean, step?: TourStep }>(toolkit.read_tour, { id: 'basics/1' })
    expect(tour.read).toHaveBeenCalledWith('basics/1', 'en', { signal: undefined })
    expect(result.ok).toBe(true)
    expect(result.step).toEqual(step)
  })

  it('read_tour fails clearly when no step has that id', async () => {
    const { toolkit } = setup()
    const result = await call<{ ok: boolean, error?: string }>(toolkit.read_tour, { id: 'missing/9' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no tour step/i)
  })

  it('list_tour threads the abort signal to the tour source', async () => {
    const { toolkit, tour } = setup()
    const controller = new AbortController()
    await callWithSignal(toolkit.list_tour, {}, controller.signal)
    expect(tour.outline).toHaveBeenCalledWith('zh', { signal: controller.signal })
  })

  it('supersede_learning_record marks the record superseded', async () => {
    const { toolkit, repo } = setup()
    await repo.appendLearningRecord({ title: 'a', body: 'b' })
    await repo.appendLearningRecord({ title: 'c', body: 'd' })
    await call(toolkit.supersede_learning_record, { id: '0001', supersededBy: '0002' })
    const records = await repo.listLearningRecords()
    expect(records.find(r => r.id === '0001')?.status).toBe('superseded')
  })
})
