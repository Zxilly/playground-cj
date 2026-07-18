'use client'

import { create } from 'zustand'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'

/** One locally durable scratch buffer in the AI Tour Playground. */
export interface PlaygroundTab {
  id: string
  title: string
  initialCode: string
  result: RunResult | null
  running: boolean
}

const PLAYGROUND_SESSION_KEY = 'teach:playground-session:v1'

const DEFAULT_PLAYGROUND_CODE = `package playground

main(): Int64 {
    println("你好，仓颉！")
    return 0
}`

function initialPlaygroundTabs(): PlaygroundTab[] {
  return [{
    id: 'playground-1',
    title: 'Playground 1',
    initialCode: DEFAULT_PLAYGROUND_CODE,
    result: null,
    running: false,
  }]
}

interface PlaygroundSession {
  playgroundTabs: PlaygroundTab[]
  currentPlaygroundTabId: string | null
  nextPlaygroundTabNumber: number
}

function defaultPlaygroundSession(): PlaygroundSession {
  return {
    playgroundTabs: initialPlaygroundTabs(),
    currentPlaygroundTabId: 'playground-1',
    nextPlaygroundTabNumber: 2,
  }
}

function isRunResult(value: unknown): value is RunResult | null {
  if (value === null)
    return true
  if (value == null || typeof value !== 'object')
    return false
  const result = value as Partial<RunResult>
  return typeof result.ok === 'boolean'
    && typeof result.stdout === 'string'
    && typeof result.stderr === 'string'
}

function parsePlaygroundSession(value: unknown): PlaygroundSession | null {
  if (value == null || typeof value !== 'object')
    return null
  const candidate = value as Partial<PlaygroundSession>
  if (!Array.isArray(candidate.playgroundTabs)
    || typeof candidate.nextPlaygroundTabNumber !== 'number'
    || !Number.isInteger(candidate.nextPlaygroundTabNumber)
    || candidate.nextPlaygroundTabNumber < 1
    || (candidate.currentPlaygroundTabId !== null && typeof candidate.currentPlaygroundTabId !== 'string')) {
    return null
  }

  const tabs: PlaygroundTab[] = []
  const ids = new Set<string>()
  for (const value of candidate.playgroundTabs) {
    if (value == null || typeof value !== 'object')
      return null
    const tab = value as Partial<PlaygroundTab>
    if (typeof tab.id !== 'string'
      || tab.id.length === 0
      || ids.has(tab.id)
      || typeof tab.title !== 'string'
      || typeof tab.initialCode !== 'string'
      || !isRunResult(tab.result)) {
      return null
    }
    ids.add(tab.id)
    tabs.push({
      id: tab.id,
      title: tab.title.trim() || tab.id,
      initialCode: tab.initialCode,
      result: tab.result,
      // A page refresh cannot preserve an in-flight request.
      running: false,
    })
  }

  const currentPlaygroundTabId = candidate.currentPlaygroundTabId !== null
    && ids.has(candidate.currentPlaygroundTabId)
    ? candidate.currentPlaygroundTabId
    : tabs[0]?.id ?? null

  const highestTabNumber = tabs.reduce((highest, tab) => {
    const match = /^playground-(\d+)$/.exec(tab.id)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

  return {
    playgroundTabs: tabs,
    currentPlaygroundTabId,
    nextPlaygroundTabNumber: Math.max(candidate.nextPlaygroundTabNumber, highestTabNumber + 1),
  }
}

function loadPlaygroundSession(): PlaygroundSession {
  if (typeof window === 'undefined')
    return defaultPlaygroundSession()
  try {
    const saved = localStorage.getItem(PLAYGROUND_SESSION_KEY)
    return saved ? parsePlaygroundSession(JSON.parse(saved)) ?? defaultPlaygroundSession() : defaultPlaygroundSession()
  }
  catch {
    return defaultPlaygroundSession()
  }
}

function persistPlaygroundSession(state: WorkspaceStore): void {
  if (typeof window === 'undefined')
    return
  try {
    const session: PlaygroundSession = {
      playgroundTabs: state.playgroundTabs.map(tab => ({ ...tab, running: false })),
      currentPlaygroundTabId: state.currentPlaygroundTabId,
      nextPlaygroundTabNumber: state.nextPlaygroundTabNumber,
    }
    localStorage.setItem(PLAYGROUND_SESSION_KEY, JSON.stringify(session))
  }
  catch {
    // Storage may be blocked or full. The in-memory editor remains usable.
  }
}

/**
 * The active surface in the central viewport of the teaching workspace. Mirrors
 * the left-nav entries plus the `'lesson'` viewport that the renderer occupies
 * when a single lesson is open (distinct from the `'lessons'` list).
 *
 *  - `overview`   — the learner-facing progress dashboard
 *  - `mission`    — the mission document (topic / why / success criteria)
 *  - `lessons`    — the list of lessons with completion state (default landing)
 *  - `lesson`     — a single open lesson rendered by `LessonRenderer`
 *  - `playground` — ephemeral multi-tab code workspace for demos and experiments
 *  - `glossary`   — the mastered-term glossary
 *  - `reference`  — reference cheat-sheets
 *  - `records`    — learning records (active + superseded)
 *  - `notes`      — free-form teaching-preference notes
 */
export type WorkspaceView
  = | 'overview'
    | 'mission'
    | 'lessons'
    | 'lesson'
    | 'playground'
    | 'glossary'
    | 'reference'
    | 'records'
    | 'notes'

/**
 * The kind of workspace document a write touches (or a read subscribes to).
 * `useWorkspaceResource` subscribes to one scope so a glossary write only re-runs
 * glossary reads, not every read; `'all'` is the catch-all both for reads that
 * span document kinds and for whole-workspace writes (`importAll`).
 */
export type WorkspaceScope
  = | 'mission'
    | 'lessons'
    | 'glossary'
    | 'learningRecords'
    | 'references'
    | 'notes'
    | 'retrieval'
    | 'all'

/** Every per-document scope, in a stable order (excludes the `'all'` catch-all). */
export const WORKSPACE_SCOPES = [
  'mission',
  'lessons',
  'glossary',
  'learningRecords',
  'references',
  'notes',
  'retrieval',
] as const satisfies readonly Exclude<WorkspaceScope, 'all'>[]

/** Per-scope monotonic revision counters, plus the catch-all `'all'`. */
export type ScopeRevisions = Record<WorkspaceScope, number>

function initialRevisions(): ScopeRevisions {
  return {
    mission: 0,
    lessons: 0,
    glossary: 0,
    learningRecords: 0,
    references: 0,
    notes: 0,
    retrieval: 0,
    all: 0,
  }
}

export interface WorkspaceStore {
  /** The view currently shown in the central viewport. */
  view: WorkspaceView
  /** Id of the lesson open in the `'lesson'` view, or null when none is open. */
  currentLessonId: string | null
  /** Id of the reference selected in the `'reference'` view, or null. */
  currentReferenceId: string | null
  /** Local scratch buffers shown in the Playground; not part of workspace export. */
  playgroundTabs: PlaygroundTab[]
  /** Id of the visible Playground tab, or null when all tabs are closed. */
  currentPlaygroundTabId: string | null
  /** Monotonic id source so closing a tab never causes id/model reuse. */
  nextPlaygroundTabNumber: number
  /**
   * A prompt waiting to be seeded into the teacher chat composer, or null when
   * none is pending. Set by a navigation block ("和老师聊聊" on the
   * mission-first gate, "问老师" on a `followup_prompt` block) via the workspace
   * navigation context's `prefillChat`, and consumed by the teacher chat runtime
   * which writes it into the composer input and clears it. Kept in the store
   * (rather than a prop callback) so the producer — a lesson block deep in the
   * central viewport — and the consumer — the chat region mounted in a sibling
   * pane — stay decoupled.
   */
  pendingPrefill: string | null
  /**
   * Per-scope monotonic revisions, bumped whenever the matching workspace
   * documents change (e.g. a teacher tool writes the mission or a lesson).
   * Document reads ({@link useWorkspaceResource}) subscribe to their own scope,
   * so a write through chat refreshes only the affected views (and the
   * mission-first gate) without a manual reload, instead of re-running every
   * read. The `'all'` counter is bumped by every write so a span-everything read
   * (or `importAll`) still refreshes.
   */
  revisions: ScopeRevisions
  /** Switch the central viewport to a top-level view (nav click). */
  setView: (view: WorkspaceView) => void
  /** Open a lesson: switch to the `'lesson'` view and record its id. */
  selectLesson: (lessonId: string) => void
  /** Open a reference: switch to the `'reference'` view and record its id. */
  openReference: (referenceId: string) => void
  /** Create a Playground tab, select it, and route the central viewport there. */
  openPlaygroundTab: (input?: { title?: string, code?: string }) => string
  /** Select an existing Playground tab and route the central viewport there. */
  selectPlaygroundTab: (tabId: string) => boolean
  /** Close a Playground tab, selecting a neighbour when one remains. */
  closePlaygroundTab: (tabId: string) => void
  /** Rename a Playground tab while preserving its stable id/model URI. */
  renamePlaygroundTab: (tabId: string, title: string) => void
  /** Attach a model- or user-triggered run result to a Playground tab. */
  setPlaygroundTabResult: (tabId: string, result: RunResult | null) => void
  /** Track compile/run progress per tab so switching tabs never leaks busy UI. */
  setPlaygroundTabRunning: (tabId: string, running: boolean) => void
  /** Persist the live editor buffer before switching away from a Playground tab. */
  setPlaygroundTabCode: (tabId: string, code: string) => void
  /**
   * Queue `prompt` to be seeded into the teacher chat composer. Replaces any
   * prompt not yet consumed (the latest click wins).
   */
  setPendingPrefill: (prompt: string) => void
  /**
   * Take the pending prefill prompt (clearing it) so the chat runtime seeds it
   * exactly once. Returns null when nothing is queued.
   */
  consumePrefill: () => string | null
  /**
   * Signal that workspace documents of `scope` changed so dependent reads re-run.
   * Bumps that scope's counter and the `'all'` counter; a `'all'` scope bumps
   * every counter (a whole-workspace replace). Defaults to `'all'` so callers
   * that don't care about granularity keep the prior refresh-everything behaviour.
   */
  bumpRevision: (scope?: WorkspaceScope) => void
  /**
   * Reset document navigation back to defaults while keeping local Playground
   * drafts. Called after an
   * `importAll` replaces the whole workspace: the prior `currentLessonId` /
   * `currentReferenceId` point at documents that may no longer exist in the
   * imported snapshot, so without this the shell would land on a missing lesson.
   * Revisions are left untouched (the shell remounts on import anyway).
   */
  reset: () => void
}

/**
 * Local UI state for the teaching workspace shell: which view is active and
 * which lesson / reference is selected. Deliberately holds no domain data — the
 * documents themselves live in the {@link WorkspaceRepository} (read through the
 * workspace context). The store is what nav clicks and navigation blocks
 * (`lesson_link` / `reference_link`) mutate; views and the shell subscribe to
 * render the right surface.
 *
 * View defaults to `'lessons'` so the learner lands on their lesson list. Route
 * selection lives in the URL; Playground scratch buffers persist locally but
 * remain outside the portable workspace snapshot.
 */
const playgroundSession = loadPlaygroundSession()

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  view: 'lessons',
  currentLessonId: null,
  currentReferenceId: null,
  ...playgroundSession,
  pendingPrefill: null,
  revisions: initialRevisions(),
  setView: view => set({ view }),
  selectLesson: lessonId => set({ view: 'lesson', currentLessonId: lessonId }),
  openReference: referenceId => set({ view: 'reference', currentReferenceId: referenceId }),
  openPlaygroundTab: (input = {}) => {
    const number = get().nextPlaygroundTabNumber
    const id = `playground-${number}`
    const tab: PlaygroundTab = {
      id,
      title: input.title?.trim() || `Playground ${number}`,
      initialCode: input.code ?? '',
      result: null,
      running: false,
    }
    set(state => ({
      view: 'playground',
      playgroundTabs: [...state.playgroundTabs, tab],
      currentPlaygroundTabId: id,
      nextPlaygroundTabNumber: number + 1,
    }))
    return id
  },
  selectPlaygroundTab: (tabId) => {
    if (!get().playgroundTabs.some(tab => tab.id === tabId))
      return false
    set({ view: 'playground', currentPlaygroundTabId: tabId })
    return true
  },
  closePlaygroundTab: tabId => set((state) => {
    const index = state.playgroundTabs.findIndex(tab => tab.id === tabId)
    if (index < 0)
      return state
    const tabs = state.playgroundTabs.filter(tab => tab.id !== tabId)
    const closingCurrent = state.currentPlaygroundTabId === tabId
    const fallback = tabs[Math.min(index, tabs.length - 1)]?.id ?? null
    return {
      playgroundTabs: tabs,
      currentPlaygroundTabId: closingCurrent ? fallback : state.currentPlaygroundTabId,
    }
  }),
  renamePlaygroundTab: (tabId, title) => {
    const normalized = title.trim()
    if (!normalized)
      return
    set(state => ({
      playgroundTabs: state.playgroundTabs.map(tab => tab.id === tabId
        ? { ...tab, title: normalized }
        : tab),
    }))
  },
  setPlaygroundTabResult: (tabId, result) => set(state => ({
    playgroundTabs: state.playgroundTabs.map(tab => tab.id === tabId ? { ...tab, result } : tab),
  })),
  setPlaygroundTabRunning: (tabId, running) => set(state => ({
    playgroundTabs: state.playgroundTabs.map(tab => tab.id === tabId ? { ...tab, running } : tab),
  })),
  setPlaygroundTabCode: (tabId, code) => set(state => ({
    playgroundTabs: state.playgroundTabs.map(tab => tab.id === tabId ? { ...tab, initialCode: code } : tab),
  })),
  setPendingPrefill: prompt => set({ pendingPrefill: prompt }),
  consumePrefill: () => {
    const { pendingPrefill } = get()
    if (pendingPrefill !== null)
      set({ pendingPrefill: null })
    return pendingPrefill
  },
  reset: () => set({
    view: 'lessons',
    currentLessonId: null,
    currentReferenceId: null,
    pendingPrefill: null,
  }),
  bumpRevision: (scope = 'all') => set((state) => {
    if (scope === 'all') {
      // A whole-workspace replace: bump every counter so every subscriber re-runs.
      const bumped = {} as ScopeRevisions
      for (const key of Object.keys(state.revisions) as WorkspaceScope[])
        bumped[key] = state.revisions[key] + 1
      return { revisions: bumped }
    }
    // A scoped write: re-run that scope's subscribers and any span-everything
    // (`'all'`) subscriber, but leave unrelated scopes untouched.
    return {
      revisions: {
        ...state.revisions,
        [scope]: state.revisions[scope] + 1,
        all: state.revisions.all + 1,
      },
    }
  }),
}))

let lastPersistedPlaygroundSession = ''
useWorkspaceStore.subscribe((state) => {
  const signature = JSON.stringify({
    playgroundTabs: state.playgroundTabs,
    currentPlaygroundTabId: state.currentPlaygroundTabId,
    nextPlaygroundTabNumber: state.nextPlaygroundTabNumber,
  })
  if (signature === lastPersistedPlaygroundSession)
    return
  lastPersistedPlaygroundSession = signature
  persistPlaygroundSession(state)
})
