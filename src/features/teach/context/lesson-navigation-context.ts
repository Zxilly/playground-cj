import { createContext } from 'react'

/**
 * Navigation actions lesson blocks invoke to move around the workspace or seed
 * the teacher chat. Kept as a thin context (mirroring `glossary-context`) so the
 * navigation/collateral blocks (`lesson_link` / `reference_link` /
 * `followup_prompt`) stay decoupled from the Phase 9 workspace store — the store
 * wires its `selectLesson` / `setView` / chat-prefill actions into a provider,
 * while tests inject fakes.
 */
export interface LessonNavigationContextValue {
  /** Switch the central viewport to the lesson with the given id. */
  selectLesson: (lessonId: string) => void
  /** Switch to the reference view and select the reference with the given id. */
  openReference: (referenceId: string) => void
  /** Seed the teacher chat composer with a follow-up prompt for the learner. */
  prefillChat: (prompt: string) => void
}

/**
 * Default no-op navigation. Until a provider supplies real actions (Phase 9
 * shell), blocks degrade gracefully: clicking a navigation block simply does
 * nothing rather than throwing.
 */
export const noopLessonNavigation: LessonNavigationContextValue = {
  selectLesson: () => {},
  openReference: () => {},
  prefillChat: () => {},
}

export const LessonNavigationContext
  = createContext<LessonNavigationContextValue>(noopLessonNavigation)
