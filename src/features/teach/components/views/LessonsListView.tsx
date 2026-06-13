'use client'

import { BookOpen, CircleCheck, CircleDashed, CircleDot } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { LessonState } from '@/lib/teach/lessons/lesson'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'

/**
 * Per-status icon for a lesson's completion state, surfacing progress at a glance
 * in the list (the central spine of the workspace).
 */
function StatusIcon({ status }: { status: LessonState['status'] }) {
  if (status === 'completed')
    return <CircleCheck aria-hidden="true" className="size-4 text-emerald-500" />
  if (status === 'in_progress')
    return <CircleDot aria-hidden="true" className="size-4 text-amber-500" />
  return <CircleDashed aria-hidden="true" className="size-4 text-muted-foreground" />
}

/**
 * The lessons list view: every lesson with its completion status, ordered as the
 * repository returns them (id order = creation order). Clicking a lesson opens it
 * in the central viewport via the navigation context (`selectLesson`). Lessons
 * are authored by the teacher, so an empty list points the learner back to chat.
 */
export function LessonsListView() {
  const { repo } = useWorkspace()
  const { selectLesson } = useLessonNavigation()
  const { data: lessons, loading } = useWorkspaceResource(() => repo.listLessons(), [repo])

  if (loading)
    return null

  if (!lessons || lessons.length === 0) {
    return (
      <ViewEmptyState testId="lessons-empty" icon={BookOpen}>
        <Trans>还没有课程。先和老师确定学习目标，老师会据此安排第一课。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <ul data-testid="lessons-list-view" className="flex flex-col gap-2">
      {lessons.map(lesson => (
        <li key={lesson.id}>
          <button
            type="button"
            data-testid="lesson-list-item"
            data-status={lesson.state.status}
            onClick={() => selectLesson(lesson.id)}
            className="flex w-full items-center gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3 text-start transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <StatusIcon status={lesson.state.status} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">{lesson.title}</span>
              <span className="truncate text-xs text-muted-foreground">{lesson.skillFocus}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
