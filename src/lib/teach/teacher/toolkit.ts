import type { ToolCallOptions, ToolSet } from 'ai'
import type { KnowledgeSource } from '../knowledge/source'
import type { TourSource } from '../knowledge/tour-source'
import type { RunResult } from '../feedback/run-cangjie'
import type { RetrievalItem } from '../retrieval/types'
import type { WorkspaceRepository } from '../workspace/repository'
import type { TeacherLang } from './system-prompt'
import { tool } from 'ai'
import { z } from 'zod'
import { isUserAbort } from '../abort'
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
 * Minimal contract for reading/writing the learner's currently active central
 * editor. Lesson `code_task` blocks and Playground tabs both register through
 * the same feature-layer registry. The domain toolkit stays decoupled from
 * Monaco and React: it only sees `getCode` / `setCode`.
 */
export interface EditorBridge {
  /** Read the active editor's contents, or null when no editor is active. */
  getCode: () => string | null
  /** Replace the active editor's contents; returns false when none is active. */
  setCode: (code: string) => boolean
}

/** UI routing boundary for the ephemeral, multi-tab Playground workspace. */
export interface TeacherPlayground {
  /** List the tabs the learner can currently see in Playground. */
  listTabs: () => Array<{ id: string, title: string }>
  /** Create and select a tab, routing the central viewport to Playground. */
  openTab: (input: { title: string, code: string }) => string
  /** Select an existing tab and route the central viewport to Playground. */
  selectTab: (tabId: string) => boolean
  /** Surface a model-triggered run result in the currently visible Playground tab. */
  recordRunResult: (result: RunResult) => void
}

export type TeacherWorkspaceRoute
  = | { view: 'overview' | 'mission' | 'lessons' | 'playground' | 'glossary' | 'records' | 'notes' }
    | { view: 'lesson', id: string }
    | { view: 'reference', id?: string }

/** UI boundary that lets the teacher choose the learner's primary workspace surface. */
export interface TeacherWorkspaceNavigation {
  /** Route the central viewport; returns false only when the UI rejects the route. */
  navigate: (route: TeacherWorkspaceRoute) => boolean
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
  /**
   * Curated, hand-written tour content source backing `list_tour` / `read_tour`.
   * Preferred over `knowledge` (`search_docs`) as the canonical, highest-quality
   * grounding for Cangjie concepts, examples, and ordering when authoring lessons.
   */
  tour: TourSource
  runner: TeacherRunner
  retrievalStore: RetrievalStore
  /**
   * Bridge to the learner's currently active lesson/Playground editor, backing
   * `read_editor_code` / `set_editor_code`. The feature layer wires this to the
   * active-editor registry; tests inject a fake.
   */
  editor: EditorBridge
  /** Controller that lets the teacher route temporary code into Playground. */
  playground: TeacherPlayground
  /** Controller for the entire learner-visible central workspace. */
  navigation: TeacherWorkspaceNavigation
  /**
   * UI language of the teaching workspace. `read_tour` uses it implicitly to pick
   * the curated prose/code locale, so the model never has to pass a language.
   */
  lang: TeacherLang
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
    if (isUserAbort(error, signal))
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

const navigateWorkspaceInputSchema = z.object({
  view: z.enum([
    'overview',
    'mission',
    'lessons',
    'lesson',
    'playground',
    'glossary',
    'reference',
    'records',
    'notes',
  ]),
  id: z.string().min(1).optional(),
}).superRefine((route, ctx) => {
  if (route.view === 'lesson' && route.id === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['id'],
      message: 'id is required when view is lesson',
    })
  }
  else if (route.view !== 'lesson' && route.view !== 'reference' && route.id !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['id'],
      message: `id is not supported when view is ${route.view}`,
    })
  }
})

/**
 * Build the single Teacher agent's tool set (AI SDK v6 `tool()` API). Each tool
 * delegates to one of the injected dependencies (workspace repository,
 * curated tour source, knowledge source, editor bridge, runner, retrieval store)
 * and returns a compact JSON payload (`{ ok, ... }`) the model can reason over.
 *
 * `create_lesson` uses {@link lessonDraftSchema} directly as its `inputSchema`
 * so the model's lesson is zod-validated (including the equal-length quiz rule)
 * before it is persisted.
 */
export function createTeacherToolkit(deps: TeacherToolkitDeps): ToolSet {
  const { repo, knowledge, tour, runner, retrievalStore, editor, playground, navigation, lang, now } = deps

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

    // ---- Central workspace routing ----
    navigate_workspace: tool({
      description: 'Route the learner-visible central workspace, which is the primary interaction surface. Use this to show overview, mission, lesson list, a specific lesson, Playground, glossary, a reference, learning records, or notes after the relevant tool work; Chat is only auxiliary. A lesson/reference id must already exist.',
      inputSchema: navigateWorkspaceInputSchema,
      execute: async (route) => {
        if (route.view === 'lesson') {
          const id = route.id!
          if (!(await repo.getLesson(id)))
            return fail(`No lesson with id ${id}.`)
          return navigation.navigate({ view: 'lesson', id })
            ? ok()
            : fail('Could not navigate to lesson.')
        }
        if (route.view === 'reference') {
          if (route.id && !(await repo.getReference(route.id)))
            return fail(`No reference with id ${route.id}.`)
          return navigation.navigate({ view: 'reference', id: route.id })
            ? ok()
            : fail('Could not navigate to reference.')
        }
        return navigation.navigate({ view: route.view })
          ? ok()
          : fail(`Could not navigate to ${route.view}.`)
      },
    }),

    // ---- Lesson orchestration ----
    create_lesson: tool({
      description: 'Author a new structured lesson for the central workspace, which is the learner\'s primary interaction surface (Chat is auxiliary). The lesson must be short, build a single takeaway, sit inside the learner\'s ZPD (justify in zpdRationale), trace back to the mission (missionLink), and cite trusted sources. Prefer structured blocks; use raw_html only as a sandboxed fallback. When mission-linked instruction or practice requires code, include a code_task with starterCode in this initial draft. Temporary examples and experiments belong in Playground via open_playground_tab, not in a lesson. A quiz block holds a questions[] array (each question its own options/answerIndices/multiple/explanation; you may mix single- and multiple-choice questions); within each question all options must be equal length so option length never leaks the answer. recall_prompt answers are graded automatically by the AI (the learner no longer self-grades). Use an oj block for LeetCode/Codeforces-style problems: mode "function" (learner implements a function — give starterCode as the stub, a callTemplate using ${args} to invoke and print, and testCases each with args + expectedOutput) or mode "stdio" (learner writes a full program reading stdin — testCases each with stdin + expectedOutput); visible:false test cases are hidden from the learner.',
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
    list_tour: tool({
      description: 'List the curated, hand-written Cangjie tour outline (chapters → steps with stable ids + titles). This is the canonical, highest-quality grounding source: PREFER it over search_docs for Cangjie concepts, examples, and teaching order. Call this first to see what canonical material exists, then read_tour the relevant steps.',
      inputSchema: z.object({}),
      execute: (input, options) => withAbort(options, async (signal) => {
        const outline = await tour.outline(lang, { signal })
        return ok({ outline })
      }),
    }),
    read_tour: tool({
      description: 'Read one curated tour step by id (the stable id from list_tour, e.g. "basics/1"), returning its curated prose and Cangjie code in the workspace language. PREFER this as the canonical source when authoring lessons; fall back to search_docs only for what the tour does not cover. Returns null when no step has that id.',
      inputSchema: z.object({ id: z.string() }),
      execute: (input, options) => withAbort(options, async (signal) => {
        const step = await tour.read(input.id, lang, { signal })
        if (!step)
          return fail(`No tour step with id ${input.id}.`)
        return ok({ step })
      }),
    }),
    search_docs: tool({
      description: 'Search the trusted Cangjie knowledge source. Use it to supplement the curated tour (list_tour / read_tour) — call it before stating any Cangjie fact, writing a code sample, or authoring a lesson the tour does not cover, and never guess from parametric memory. Cite the returned hits in the blocks you author.',
      inputSchema: z.object({ query: z.string(), limit: z.number().int().positive().max(20).optional() }),
      execute: (input, options) => withAbort(options, async (signal) => {
        const hits = await knowledge.search(input.query, { limit: input.limit, signal })
        return ok({ hits })
      }),
    }),

    // ---- Playground routing / editor + runner ----
    list_playground_tabs: tool({
      description: 'List the learner-visible tabs in the central Playground. Temporary demonstrations, experiments, and code used before a mission exists belong here rather than in Chat or a lesson document.',
      inputSchema: z.object({}),
      execute: async () => ok({ tabs: playground.listTabs() }),
    }),
    open_playground_tab: tool({
      description: 'Create a learner-visible Playground tab with Cangjie code and route the central workspace to it. Use this for temporary examples, demonstrations, experiments, and pre-mission code. After opening it, use run_code to run the visible editor contents; do not paste and run invisible code in Chat.',
      inputSchema: z.object({
        title: z.string().min(1),
        code: z.string(),
      }),
      execute: async input => ok({ id: playground.openTab(input) }),
    }),
    select_playground_tab: tool({
      description: 'Select an existing Playground tab by id and route the central workspace to it. Call list_playground_tabs first when you do not know the id.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => playground.selectTab(id)
        ? ok()
        : fail(`No Playground tab with id ${id}.`),
    }),
    read_editor_code: tool({
      description: 'Read the learner\'s code in the currently active central editor (a lesson code_task or Playground tab). Returns null when no editor is visible.',
      inputSchema: z.object({}),
      execute: async () => ok({ code: editor.getCode() }),
    }),
    set_editor_code: tool({
      description: 'Replace the contents of the learner\'s currently active central editor. If no editor is visible, this automatically creates a Playground tab and routes the learner to it, so code never exists only inside Chat.',
      inputSchema: z.object({ code: z.string() }),
      execute: async ({ code }) => {
        if (!editor.setCode(code)) {
          const id = playground.openTab({
            title: lang === 'en' ? 'Temporary code' : '临时代码',
            code,
          })
          return ok({ openedPlaygroundTab: id })
        }
        return ok()
      },
    }),
    run_code: tool({
      description: 'Compile and run the code in the currently visible central editor. This tool accepts no code input: use open_playground_tab or set_editor_code first so the learner can see and edit exactly what will run. The result is cached and also displayed in the active Playground tab.',
      inputSchema: z.object({}),
      execute: async (_input, options) => {
        const code = editor.getCode()
        if (code === null)
          return fail('No visible editor. Open a Playground tab before running code.')
        return withAbort(options, async (signal) => {
          lastRunResult = await runner.run(code, signal)
          playground.recordRunResult(lastRunResult)
          return ok({ result: lastRunResult })
        })
      },
    }),
    read_run_result: tool({
      description: 'Read the most recent run_code result, or null if nothing has been run yet.',
      inputSchema: z.object({}),
      execute: async () => ok({ result: lastRunResult }),
    }),
  }
}
