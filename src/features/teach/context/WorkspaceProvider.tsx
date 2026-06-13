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
   * Seed the teacher chat composer (e.g. from a `followup_prompt` block's "ask
   * the teacher" button). Wired by the shell to the chat runtime; defaults to a
   * no-op so navigation blocks degrade gracefully before chat is mounted.
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
  editor,
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
      editor,
      runner,
      now,
    }),
    [repo, retrievalStore, knowledge, editor, runner, now, bumpRevision],
  )

  const navigation = useMemo<LessonNavigationContextValue>(
    () => ({
      selectLesson: lessonId => useWorkspaceStore.getState().selectLesson(lessonId),
      openReference: referenceId => useWorkspaceStore.getState().openReference(referenceId),
      prefillChat: prompt => onPrefillChat?.(prompt),
    }),
    [onPrefillChat],
  )

  return (
    <WorkspaceContext value={value}>
      <LessonNavigationContext value={navigation}>{children}</LessonNavigationContext>
    </WorkspaceContext>
  )
}
