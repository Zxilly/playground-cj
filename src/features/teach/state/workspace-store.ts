'use client'

import { create } from 'zustand'

/**
 * The active surface in the central viewport of the teaching workspace. Mirrors
 * the left-nav entries plus the `'lesson'` viewport that the renderer occupies
 * when a single lesson is open (distinct from the `'lessons'` list).
 *
 *  - `mission`    — the mission document (topic / why / success criteria)
 *  - `lessons`    — the list of lessons with completion state (default landing)
 *  - `lesson`     — a single open lesson rendered by `LessonRenderer`
 *  - `glossary`   — the mastered-term glossary
 *  - `reference`  — reference cheat-sheets
 *  - `records`    — learning records (active + superseded)
 *  - `notes`      — free-form teaching-preference notes
 */
export type WorkspaceView
  = | 'mission'
    | 'lessons'
    | 'lesson'
    | 'glossary'
    | 'reference'
    | 'records'
    | 'notes'

export interface WorkspaceStore {
  /** The view currently shown in the central viewport. */
  view: WorkspaceView
  /** Id of the lesson open in the `'lesson'` view, or null when none is open. */
  currentLessonId: string | null
  /** Id of the reference selected in the `'reference'` view, or null. */
  currentReferenceId: string | null
  /**
   * Monotonic revision bumped whenever the workspace documents change (e.g. a
   * teacher tool writes the mission or a lesson). Document reads
   * ({@link useWorkspaceResource}) depend on it, so a write through chat refreshes
   * the views and the mission-first gate without a manual reload.
   */
  revision: number
  /** Switch the central viewport to a top-level view (nav click). */
  setView: (view: WorkspaceView) => void
  /** Open a lesson: switch to the `'lesson'` view and record its id. */
  selectLesson: (lessonId: string) => void
  /** Open a reference: switch to the `'reference'` view and record its id. */
  openReference: (referenceId: string) => void
  /** Signal that workspace documents changed so dependent reads re-run. */
  bumpRevision: () => void
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
export const useWorkspaceStore = create<WorkspaceStore>()(set => ({
  view: 'lessons',
  currentLessonId: null,
  currentReferenceId: null,
  revision: 0,
  setView: view => set({ view }),
  selectLesson: lessonId => set({ view: 'lesson', currentLessonId: lessonId }),
  openReference: referenceId => set({ view: 'reference', currentReferenceId: referenceId }),
  bumpRevision: () => set(state => ({ revision: state.revision + 1 })),
}))
