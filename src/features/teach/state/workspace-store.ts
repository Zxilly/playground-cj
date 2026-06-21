'use client'

import { create } from 'zustand'

/**
 * The active surface in the central viewport of the teaching workspace. Mirrors
 * the left-nav entries plus the `'lesson'` viewport that the renderer occupies
 * when a single lesson is open (distinct from the `'lessons'` list).
 *
 *  - `overview`   — the learner-facing progress dashboard
 *  - `mission`    — the mission document (topic / why / success criteria)
 *  - `lessons`    — the list of lessons with completion state (default landing)
 *  - `lesson`     — a single open lesson rendered by `LessonRenderer`
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
   * Reset the ephemeral view/selection state back to defaults. Called after an
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
 * View defaults to `'lessons'` so the learner lands on their lesson list. Not
 * persisted: view selection is ephemeral session state, not part of the
 * portable workspace snapshot.
 */
export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  view: 'lessons',
  currentLessonId: null,
  currentReferenceId: null,
  pendingPrefill: null,
  revisions: initialRevisions(),
  setView: view => set({ view }),
  selectLesson: lessonId => set({ view: 'lesson', currentLessonId: lessonId }),
  openReference: referenceId => set({ view: 'reference', currentReferenceId: referenceId }),
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
