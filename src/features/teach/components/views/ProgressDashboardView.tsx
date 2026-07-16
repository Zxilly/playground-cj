'use client'

import { BookOpen, CircleCheck, CircleDashed, CircleDot, RotateCcw, ScrollText, Sparkles, SpellCheck, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import type { LessonState } from '@/lib/teach/lessons/lesson'
import { dueItems } from '@/lib/teach/retrieval/scheduler'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'
import { WorkspaceViewSkeleton } from './WorkspaceViewSkeleton'

/** How many recent lessons the progress list surfaces, newest first. */
const RECENT_LESSON_LIMIT = 5

/** Per-status chip for a lesson, mirroring the lessons-list status iconography. */
function LessonStatusChip({ status }: { status: LessonState['status'] }) {
  if (status === 'completed') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-500">
        <CircleCheck aria-hidden="true" className="size-3.5" />
        <Trans>已完成</Trans>
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-500">
        <CircleDot aria-hidden="true" className="size-3.5" />
        <Trans>进行中</Trans>
      </span>
    )
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
      <CircleDashed aria-hidden="true" className="size-3.5" />
      <Trans>未开始</Trans>
    </span>
  )
}

/** A single headline metric card (a count behind one icon + label). */
function StatCard({
  testId,
  icon: Icon,
  label,
  value,
}: {
  testId: string
  icon: LucideIcon
  label: ReactNode
  value: number
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/40 px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-primary" />
        {label}
      </span>
      <span data-testid={testId} className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/**
 * The learner-facing progress dashboard: a calm "学习概览" surface that reflects
 * the progress the workspace already tracks internally — mission, lesson
 * completion, due spaced-retrieval reviews, mastered terms, and learning records
 * — back to the learner. Reads everything through the workspace repository so a
 * teacher-tool write (a completed lesson, a new mastered term) refreshes it via
 * the per-scope revision counters, just like the document views.
 *
 * When the workspace is cold (no mission and no lessons), it shows a friendly
 * empty state pointing back to the teacher rather than a wall of zeros.
 */
export function ProgressDashboardView() {
  const { repo, now } = useWorkspace()
  const { selectLesson } = useLessonNavigation()

  const { data: mission, loading: missionLoading } = useWorkspaceResource(() => repo.getMission(), [repo], 'mission')
  const { data: lessons, loading: lessonsLoading } = useWorkspaceResource(() => repo.listLessons(), [repo], 'lessons')
  const { data: glossary, loading: glossaryLoading } = useWorkspaceResource(() => repo.getGlossary(), [repo], 'glossary')
  const { data: records, loading: recordsLoading } = useWorkspaceResource(() => repo.listLearningRecords(), [repo], 'learningRecords')
  const { data: retrieval, loading: retrievalLoading } = useWorkspaceResource(() => repo.listRetrieval(), [repo], 'retrieval')

  if (missionLoading || lessonsLoading || glossaryLoading || recordsLoading || retrievalLoading)
    return <WorkspaceViewSkeleton />

  const lessonList = lessons ?? []
  const termCount = glossary?.terms.length ?? 0
  const activeRecordCount = (records ?? []).filter(record => record.status === 'active').length
  const dueReviewCount = dueItems(retrieval ?? [], now()).length

  // Cold start: nothing authored yet. A wall of zeros reads as failure, so we
  // point the learner back to the teacher instead (mission-first spirit).
  if (!mission && lessonList.length === 0) {
    return (
      <ViewEmptyState testId="progress-empty" icon={Sparkles}>
        <Trans>还没有可展示的进度。请先与老师确定学习目标，开始你的第一课，这里就会显示你的学习概览。</Trans>
      </ViewEmptyState>
    )
  }

  const completed = lessonList.filter(lesson => lesson.state.status === 'completed').length
  const inProgress = lessonList.filter(lesson => lesson.state.status === 'in_progress').length
  const notStarted = lessonList.filter(lesson => lesson.state.status === 'unstarted').length
  const total = lessonList.length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  const recentLessons = [...lessonList].slice(-RECENT_LESSON_LIMIT).reverse()

  return (
    <div data-testid="progress-dashboard" className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Target aria-hidden="true" className="size-3.5" />
          <Trans>学习概览</Trans>
        </p>
        {mission
          ? <h2 className="text-xl font-semibold text-foreground">{mission.topic}</h2>
          : (
              <p className="text-sm leading-6 text-muted-foreground">
                <Trans>尚未设定学习目标。请先与老师沟通你学习仓颉的目的，共同确定目标。</Trans>
              </p>
            )}
      </header>

      <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BookOpen aria-hidden="true" className="size-4 text-primary" />
            <Trans>课程进度</Trans>
          </h3>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {t`已完成 ${completed}/${total}`}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground"><Trans>已完成</Trans></dt>
            <dd data-testid="progress-completed" className="text-lg font-semibold tabular-nums text-emerald-500">{completed}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground"><Trans>进行中</Trans></dt>
            <dd data-testid="progress-in-progress" className="text-lg font-semibold tabular-nums text-amber-500">{inProgress}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground"><Trans>未开始</Trans></dt>
            <dd data-testid="progress-not-started" className="text-lg font-semibold tabular-nums text-muted-foreground">{notStarted}</dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <StatCard testId="progress-due-reviews" icon={RotateCcw} label={<Trans>待复习</Trans>} value={dueReviewCount} />
        <StatCard testId="progress-terms" icon={SpellCheck} label={<Trans>已掌握术语</Trans>} value={termCount} />
        <StatCard testId="progress-records" icon={ScrollText} label={<Trans>学习记录</Trans>} value={activeRecordCount} />
      </div>

      {recentLessons.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BookOpen aria-hidden="true" className="size-4 text-primary" />
            <Trans>近期课程</Trans>
          </h3>
          <ul className="flex flex-col gap-2">
            {recentLessons.map(lesson => (
              <li key={lesson.id}>
                <button
                  type="button"
                  data-testid="progress-recent-lesson"
                  data-status={lesson.state.status}
                  onClick={() => selectLesson(lesson.id)}
                  className="flex w-full items-center gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-2.5 text-start transition-colors hover:border-primary/60 hover:bg-primary/5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{lesson.title}</span>
                  <LessonStatusChip status={lesson.state.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
