import type { ToolCallOptions, ToolSet } from 'ai'
import type { KnowledgeSource } from '../knowledge/source'
import type { RunResult } from '../feedback/run-cangjie'
import type { RetrievalItem } from '../retrieval/types'
import type { WorkspaceRepository } from '../workspace/repository'
import { tool } from 'ai'
import { z } from 'zod'
import { lessonDraftSchema, lessonStateSchema } from '../lessons/lesson'
import {
  glossaryTermSchema,
  learningRecordDraftSchema,
  missionSchema,
  notesSchema,
  referenceDocSchema,
} from '../workspace/documents'
import { readLearnerState } from './learner-state'

/** Minimal contract for running Cangjie code through the remote runner. */
export interface TeacherRunner {
  /**
   * Compile and run `code`, resolving to a normalised {@link RunResult}.
   * `abortSignal`, when provided, cancels the in-flight run (and rejects) so a
   * stopped turn does not leave the runner request hanging.
   */
  run: (code: string, abortSignal?: AbortSignal) => Promise<RunResult>
}

/**
 * Minimal contract for reading/writing the learner's *currently active*
 * `code_task` editor. The teaching workspace has no single shared Monaco editor;
 * instead each `code_task` block owns its own editor and registers a handle as
 * "active" when the learner works in it (see the feature layer's active-editor
 * registry). The domain toolkit stays decoupled from Monaco and React: it only
 * sees `getCode` / `setCode`. `getCode` returns `null` when no code_task editor
 * is currently active (so `read_editor_code` can say so explicitly), and
 * `setCode` returns `false` when there is nothing to write to.
 */
export interface EditorBridge {
  /** Read the active editor's contents, or null when no editor is active. */
  getCode: () => string | null
  /** Replace the active editor's contents; returns false when none is active. */
  setCode: (code: string) => boolean
}

/**
 * Persistence boundary for the spaced-retrieval schedule. Kept separate from the
 * workspace repository so `read_learner_state` can fold the live schedule into
 * the learner signal without the toolkit owning storage details.
 */
export interface RetrievalStore {
  /** All scheduled retrieval items. */
  list: () => Promise<RetrievalItem[]>
  /** Replace the full schedule. */
  save: (items: RetrievalItem[]) => Promise<void>
}

export interface TeacherToolkitDeps {
  repo: WorkspaceRepository
  knowledge: KnowledgeSource
  runner: TeacherRunner
  retrievalStore: RetrievalStore
  /**
   * Bridge to the learner's currently active `code_task` editor, backing
   * `read_editor_code` / `set_editor_code`. The feature layer wires this to the
   * active-editor registry; tests inject a fake.
   */
  editor: EditorBridge
  /** Injected clock; the toolkit never reads `Date.now()` directly. */
  now: () => number
}

function ok<T extends object>(extra?: T) {
  return { ok: true as const, ...(extra ?? ({} as T)) }
}

function fail(error: string) {
  return { ok: false as const, error }
}

/** Tool result emitted when the learner stops the turn mid tool-call. */
interface AbortedToolResult {
  ok: false
  error: 'User aborted'
  aborted: true
}

const ABORTED_RESULT: AbortedToolResult = { ok: false, error: 'User aborted', aborted: true }

/**
 * Run an interruptible tool's work under the turn's abort signal. When the
 * learner stops the turn, the in-flight request is cancelled (`run` receives the
 * signal to pass to fetch/MCP) and the tool resolves to a "User aborted" result
 * instead of throwing or hanging — so the message keeps a valid tool result
 * rather than a dangling call. Generic over the tool's own output (`Output`) so
 * it adapts to each caller's result shape; non-abort errors propagate unchanged.
 */
function withAbort<Output>(
  options: ToolCallOptions,
  run: (signal: AbortSignal | undefined) => Promise<Output>,
): Promise<Output | AbortedToolResult> {
  const signal = options.abortSignal
  if (signal?.aborted)
    return Promise.resolve(ABORTED_RESULT)
  return run(signal).catch((error) => {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
      return ABORTED_RESULT
    throw error
  })
}

/**
 * Input schema for `set_mission`. The agent supplies the mission content; the
 * `updatedAt` timestamp is filled by the toolkit from the injected clock so the
 * model never invents a time.
 */
const setMissionInputSchema = missionSchema.omit({ updatedAt: true })

/**
 * Input schema for `upsert_glossary_term`. `addedAt` is server-supplied.
 */
const upsertGlossaryTermInputSchema = glossaryTermSchema.omit({ addedAt: true })

/**
 * Input schema for `upsert_reference`. `updatedAt` is server-supplied.
 */
const upsertReferenceInputSchema = referenceDocSchema.omit({ updatedAt: true })

/**
 * Build the single Teacher agent's tool set (AI SDK v6 `tool()` API). Each tool
 * delegates to one of the injected dependencies (workspace repository,
 * knowledge source, editor bridge, runner, retrieval store) and returns a compact
 * JSON payload (`{ ok, ... }`) the model can reason over.
 *
 * `create_lesson` uses {@link lessonDraftSchema} directly as its `inputSchema`
 * so the model's lesson is zod-validated (including the equal-length quiz rule)
 * before it is persisted.
 */
export function createTeacherToolkit(deps: TeacherToolkitDeps): ToolSet {
  const { repo, knowledge, runner, retrievalStore, editor, now } = deps

  // The last run result is held here so `read_run_result` can return it without
  // re-running. Reset implicitly when `run_code` runs again.
  let lastRunResult: RunResult | null = null

  return {
    // ---- Workspace reads ----
    read_mission: tool({
      description: 'Read the current mission, or null if the intake interview has not produced one yet. Read this before producing any lesson.',
      inputSchema: z.object({}),
      execute: async () => ok({ mission: await repo.getMission() }),
    }),
    read_learning_records: tool({
      description: 'List all learning records (ADR-style notes capturing non-trivial understanding, prior knowledge, corrected misconceptions, or mission drift), including superseded ones.',
      inputSchema: z.object({}),
      execute: async () => ok({ records: await repo.listLearningRecords() }),
    }),
    read_glossary: tool({
      description: 'Read the glossary of terms the learner has genuinely mastered, including each term\'s definition and "avoid" phrasings.',
      inputSchema: z.object({}),
      execute: async () => ok({ glossary: await repo.getGlossary() }),
    }),
    read_notes: tool({
      description: 'Read the learner\'s free-form teaching-preference notes.',
      inputSchema: z.object({}),
      execute: async () => ok({ notes: await repo.getNotes() }),
    }),
    list_lessons: tool({
      description: 'List all lessons with their state (unstarted / in_progress / completed) so you can pick or revisit one.',
      inputSchema: z.object({}),
      execute: async () => ok({ lessons: await repo.listLessons() }),
    }),
    read_lesson: tool({
      description: 'Read a single lesson by id, including its blocks and per-block progress.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const lesson = await repo.getLesson(id)
        if (!lesson)
          return fail(`No lesson with id ${id}.`)
        return ok({ lesson })
      },
    }),
    list_references: tool({
      description: 'List the reference documents (compressed cheat-sheets) in the workspace.',
      inputSchema: z.object({}),
      execute: async () => ok({ references: await repo.listReferences() }),
    }),
    read_learner_state: tool({
      description: 'Read the aggregated learner signal for ZPD lesson selection: the mission, completed lesson ids, recent active learning records, mastered glossary terms, and retrieval items due now. Read this before choosing the next lesson.',
      inputSchema: z.object({}),
      execute: async () => {
        const retrieval = await retrievalStore.list()
        const state = await readLearnerState(repo, retrieval, now())
        return ok({ state })
      },
    }),

    // ---- Workspace writes ----
    set_mission: tool({
      description: 'Set or replace the mission after interviewing the learner. Changing an existing mission requires the user\'s confirmation and should be paired with an append_learning_record noting the drift. The updatedAt timestamp is filled automatically.',
      inputSchema: setMissionInputSchema,
      execute: async (input) => {
        await repo.setMission({ ...input, updatedAt: now() })
        return ok()
      },
    }),
    append_learning_record: tool({
      description: 'Append a learning record. Only do this when the learner genuinely understands a non-trivial concept, discloses prior knowledge, corrects a misconception, or the mission drifts — never for mere "coverage".',
      inputSchema: learningRecordDraftSchema,
      execute: async (input) => {
        const record = await repo.appendLearningRecord(input)
        return ok({ id: record.id })
      },
    }),
    supersede_learning_record: tool({
      description: 'Mark a learning record as superseded by a newer one (never delete records).',
      inputSchema: z.object({ id: z.string(), supersededBy: z.string() }),
      execute: async ({ id, supersededBy }) => {
        await repo.supersedeLearningRecord(id, supersededBy)
        return ok()
      },
    }),
    upsert_glossary_term: tool({
      description: 'Add or update a glossary term. Only add a term once the learner has genuinely mastered it. The addedAt timestamp is filled automatically.',
      inputSchema: upsertGlossaryTermInputSchema,
      execute: async (input) => {
        await repo.upsertGlossaryTerm({ ...input, addedAt: now() })
        return ok()
      },
    }),
    set_notes: tool({
      description: 'Replace the learner\'s teaching-preference notes.',
      inputSchema: notesSchema,
      execute: async (input) => {
        await repo.setNotes(input)
        return ok()
      },
    }),
    upsert_reference: tool({
      description: 'Create or update a reference document (a compressed cheat-sheet built from a subset of lesson blocks). The updatedAt timestamp is filled automatically.',
      inputSchema: upsertReferenceInputSchema,
      execute: async (input) => {
        await repo.upsertReference({ ...input, updatedAt: now() })
        return ok({ id: input.id })
      },
    }),

    // ---- Lesson orchestration ----
    create_lesson: tool({
      description: 'Author a new structured lesson. The lesson must be short, build a single takeaway, sit inside the learner\'s ZPD (justify in zpdRationale), trace back to the mission (missionLink), and cite trusted sources. Prefer structured blocks; use raw_html only as a sandboxed fallback. All quiz options must be equal length.',
      inputSchema: lessonDraftSchema,
      execute: async (input) => {
        const lesson = await repo.appendLesson(input)
        return ok({ id: lesson.id })
      },
    }),
    update_lesson_state: tool({
      description: 'Replace a lesson\'s state (status and per-block progress).',
      inputSchema: z.object({ id: z.string(), state: lessonStateSchema }),
      execute: async ({ id, state }) => {
        await repo.updateLessonState(id, state)
        return ok()
      },
    }),
    mark_lesson_complete: tool({
      description: 'Mark a lesson as completed, preserving its existing per-block progress. The completedAt timestamp is filled automatically.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const lesson = await repo.getLesson(id)
        if (!lesson)
          return fail(`No lesson with id ${id}.`)
        await repo.updateLessonState(id, {
          ...lesson.state,
          status: 'completed',
          completedAt: now(),
        })
        return ok()
      },
    }),

    // ---- Knowledge grounding ----
    search_docs: tool({
      description: 'Search the trusted Cangjie knowledge source. You MUST call this before stating any Cangjie fact, writing a code sample, or authoring a lesson — never guess from parametric memory. Cite the returned hits in the blocks you author.',
      inputSchema: z.object({ query: z.string(), limit: z.number().int().positive().max(20).optional() }),
      execute: (input, options) => withAbort(options, async (signal) => {
        const hits = await knowledge.search(input.query, { limit: input.limit, signal })
        return ok({ hits })
      }),
    }),

    // ---- Feedback loop / editor + runner ----
    read_editor_code: tool({
      description: 'Read the learner\'s code in the currently active code_task editor (the code_task they last worked in). Returns null code when no code_task is active — author or open one first.',
      inputSchema: z.object({}),
      execute: async () => ok({ code: editor.getCode() }),
    }),
    set_editor_code: tool({
      description: 'Replace the contents of the learner\'s currently active code_task editor (e.g. to seed a snippet to run, or demonstrate a fix). Fails when no code_task is active.',
      inputSchema: z.object({ code: z.string() }),
      execute: async ({ code }) => {
        if (!editor.setCode(code))
          return fail('No active code_task editor — open or author a code_task before setting its code.')
        return ok()
      },
    }),
    run_code: tool({
      description: 'Compile and run Cangjie code on the remote runner, returning stdout/stderr/exitCode. The result is also cached for read_run_result.',
      inputSchema: z.object({ code: z.string() }),
      execute: (input, options) => withAbort(options, async (signal) => {
        lastRunResult = await runner.run(input.code, signal)
        return ok({ result: lastRunResult })
      }),
    }),
    read_run_result: tool({
      description: 'Read the most recent run_code result, or null if nothing has been run yet.',
      inputSchema: z.object({}),
      execute: async () => ok({ result: lastRunResult }),
    }),
  }
}
