'use client'

import { useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { BlockOutcome } from '@/lib/teach/lessons/lesson'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'
import { gradeRecallAnswer } from '@/lib/teach/feedback/grade-recall'
import { useLLMConfig } from '@/stores/llmConfig'
import { createConfiguredModel } from '@/lib/ai/model-provider'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { GlossaryProvider } from '@/features/teach/context/GlossaryProvider'
import { LessonRenderer } from '@/features/teach/components/LessonRenderer'
import { useWorkspaceResource } from './use-workspace-resource'
import { ViewEmptyState } from './ViewEmptyState'
import { WorkspaceViewSkeleton } from './WorkspaceViewSkeleton'

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
  const config = useLLMConfig()
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

  // The oj block needs per-test-case stdin, which the teacher runner contract
  // does not carry, so it always runs through the feedback runner directly.
  const runProgram = useCallback(
    (code: string, opts?: { stdin?: string, signal?: AbortSignal }): Promise<RunResult> =>
      runCangjieCode(code, opts),
    [],
  )

  // Free-text recall answers are graded by the learner's configured model; the
  // block falls back to self-grading if the config is partial / grading errors.
  const gradeRecall = useCallback(
    (params: { prompt: string, reference: string, answer: string }) =>
      gradeRecallAnswer(params, { model: createConfiguredModel(config) }),
    [config],
  )

  if (loading)
    return <WorkspaceViewSkeleton />

  if (!lesson) {
    return (
      <ViewEmptyState testId="lesson-missing" icon={BookOpen}>
        <Trans>该课程不存在或已被移除。请返回课程列表选择其他课程。</Trans>
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
          runProgram={runProgram}
          gradeRecall={gradeRecall}
          activeEditor={activeEditor}
        />
      </article>
    </GlossaryProvider>
  )
}
