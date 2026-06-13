'use client'

import { useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { BlockOutcome } from '@/lib/teach/lessons/lesson'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { GlossaryProvider } from '@/features/teach/context/GlossaryProvider'
import { LessonRenderer } from '@/features/teach/components/LessonRenderer'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'

export interface LessonViewProps {
  /** Id of the lesson to open, or null when no lesson is selected. */
  lessonId: string | null
}

/**
 * The single-lesson central viewport. Loads the selected lesson (and the
 * glossary the renderer's `glossary_ref` blocks resolve against) from the
 * workspace repository, then renders it with {@link LessonRenderer}. Block
 * outcomes are committed atomically through `repo.recordBlockOutcome` (so a
 * second block's write cannot clobber an earlier block's progress), and
 * interactive `code_task` blocks run through the injected workspace runner so
 * the lesson shares the same remote runner the teacher drives.
 *
 * The component is keyed by `lessonId` in the shell so switching lessons
 * remounts it with fresh state rather than carrying over the prior lesson's
 * in-memory progress.
 */
export function LessonView({ lessonId }: LessonViewProps) {
  const { repo, retrievalStore, now, runner, activeEditor } = useWorkspace()
  const { data: lesson, loading } = useWorkspaceResource(
    () => (lessonId ? repo.getLesson(lessonId) : Promise.resolve(null)),
    [repo, lessonId],
  )
  const { data: glossary } = useWorkspaceResource(() => repo.getGlossary(), [repo])

  const record = useCallback(
    (blockId: string, outcome: BlockOutcome) =>
      lessonId ? repo.recordBlockOutcome(lessonId, blockId, outcome) : Promise.resolve(null),
    [repo, lessonId],
  )

  const runCode = useCallback(
    (code: string): Promise<RunResult> => {
      if (!runner)
        return runCangjieCode(code)
      return runner.run(code)
    },
    [runner],
  )

  if (loading)
    return null

  if (!lesson) {
    return (
      <ViewEmptyState testId="lesson-missing" icon={BookOpen}>
        <Trans>这节课不存在或已被移除。回到课程列表选择另一节课。</Trans>
      </ViewEmptyState>
    )
  }

  return (
    <GlossaryProvider terms={glossary?.terms ?? []}>
      <article className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lesson.missionLink}</p>
          <h2 className="text-xl font-semibold text-foreground">{lesson.title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{lesson.skillFocus}</p>
        </header>
        <LessonRenderer
          lesson={lesson}
          record={record}
          retrievalStore={retrievalStore}
          now={now}
          runCode={runCode}
          activeEditor={activeEditor}
        />
      </article>
    </GlossaryProvider>
  )
}
