'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { createObservableRepository } from '@/features/teach/state/observable-repository'
import type { LessonNavigationContextValue } from './lesson-navigation-context'
import { LessonNavigationContext } from './lesson-navigation-context'
import type { WorkspaceContextValue } from './workspace-context'
import { WorkspaceContext } from './workspace-context'

export interface WorkspaceProviderProps extends WorkspaceContextValue {
  /**
   * Optional extra callback fired alongside the store-backed prefill signal when
   * a navigation block seeds the chat composer (the mission-first gate or a
   * `followup_prompt` block). The chat composer is seeded through the workspace
   * store's `pendingPrefill` signal regardless, so this is purely additive (e.g.
   * analytics) — wiring it is no longer required for the buttons to work.
   */
  onPrefillChat?: (prompt: string) => void
  children: ReactNode
}

/**
 * Root provider for a teaching workspace. It injects the runtime collaborators
 * ({@link WorkspaceContextValue}) and bridges the {@link LessonNavigationContext}
 * the lesson blocks consume into the workspace store, so a `lesson_link` /
 * `reference_link` click (or a `followup_prompt`) drives the same view state the
 * nav and views render from. The store is a module singleton; the navigation
 * actions read its setters lazily so the value is referentially stable.
 *
 * The repository is wrapped once here in a {@link createObservableRepository} so
 * that *every* write — whether from a lesson block committing an outcome or from
 * a teacher chat tool — bumps the workspace store's per-scope revision and
 * refreshes the affected views. (The chat runtime reads this same observed repo
 * from context, so it does not need to wrap again.)
 */
export function WorkspaceProvider({
  repo,
  retrievalStore,
  knowledge,
  runner,
  now,
  onPrefillChat,
  children,
}: WorkspaceProviderProps) {
  const bumpRevision = useWorkspaceStore(s => s.bumpRevision)
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      repo: createObservableRepository(repo, bumpRevision),
      retrievalStore,
      knowledge,
      runner,
      now,
    }),
    [repo, retrievalStore, knowledge, runner, now, bumpRevision],
  )

  const navigation = useMemo<LessonNavigationContextValue>(
    () => ({
      selectLesson: lessonId => useWorkspaceStore.getState().selectLesson(lessonId),
      openReference: referenceId => useWorkspaceStore.getState().openReference(referenceId),
      // Drive the chat composer through the store's prefill signal (the chat
      // runtime consumes it), so the button works whether or not the shell wired
      // the optional `onPrefillChat` callback.
      prefillChat: (prompt) => {
        useWorkspaceStore.getState().setPendingPrefill(prompt)
        onPrefillChat?.(prompt)
      },
    }),
    [onPrefillChat],
  )

  return (
    <WorkspaceContext value={value}>
      <LessonNavigationContext value={navigation}>{children}</LessonNavigationContext>
    </WorkspaceContext>
  )
}
