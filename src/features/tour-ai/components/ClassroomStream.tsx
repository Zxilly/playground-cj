'use client'

import { Trans } from '@lingui/react/macro'
import { Check } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import { LessonBlockView } from '@/features/tour-ai/components/LessonBlockView'
import { QuizPracticeCard } from '@/features/tour-ai/components/QuizPracticeCard'
import { useViewportRef } from '@/features/tour-ai/context/classroom-viewport-context'
import { lessonBlockKey } from '@/features/tour-ai/utils/lesson-block-key'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type {
  ClassroomQuiz,
  ClassroomSession,
  ClassroomStreamItem,
} from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'

interface ClassroomStreamProps {
  session: ClassroomSession
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
}

export function ClassroomStream({ session, lang, dispatch, bridge }: ClassroomStreamProps) {
  const viewportRef = useViewportRef()
  if (session.stream.length === 0) {
    return (
      <div className="rounded-md border border-tour-border bg-tour-surface px-4 py-4 text-sm text-muted-foreground">
        <Trans>正在规划下一步</Trans>
      </div>
    )
  }

  return (
    <Virtuoso
      data={session.stream}
      customScrollParent={viewportRef.current ?? undefined}
      computeItemKey={(_, item) => item.id}
      itemContent={(_, item) => (
        <div className="mb-5">
          <StreamItemView
            item={item}
            currentQuiz={session.currentQuiz}
            lang={lang}
            dispatch={dispatch}
            bridge={bridge}
          />
        </div>
      )}
    />
  )
}

function StreamItemView({
  item,
  currentQuiz,
  lang,
  dispatch,
  bridge,
}: {
  item: ClassroomStreamItem
  currentQuiz: ClassroomQuiz | null
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
}) {
  if (item.type === 'lesson_blocks') {
    return (
      <div className="space-y-4">
        {item.blocks.map(block => (
          <LessonBlockView key={lessonBlockKey(block)} block={block} />
        ))}
      </div>
    )
  }

  if (item.type === 'quiz') {
    return (
      <QuizPracticeCard
        quiz={item.quiz}
        isActive={Boolean(currentQuiz && currentQuiz.createdAt === item.quiz.createdAt && currentQuiz.status === 'active')}
        lang={lang}
        dispatch={dispatch}
        bridge={bridge}
      />
    )
  }

  if (item.type === 'run_result') {
    return (
      <section className={cn('rounded-md border border-tour-border bg-tour-surface p-4', 'text-sm')}>
        <div className="mb-2 font-semibold"><Trans>运行结果</Trans></div>
        <pre className="whitespace-pre-wrap rounded bg-tour-code-bg p-3 font-mono text-xs">
          <Trans>输出：</Trans>
          {item.result.stdout || <Trans>(empty)</Trans>}
        </pre>
      </section>
    )
  }

  if (item.type === 'progress_update') {
    return (
      <section className="inline-flex items-center gap-2 rounded-md border border-classroom-success-border bg-classroom-success-bg px-3 py-2 text-sm text-classroom-success-fg">
        <Check className="size-4" />
        <Trans>已记录：</Trans>
        {item.outcome}
        {' '}
        ·
        {' '}
        {item.conceptId}
      </section>
    )
  }

  const errorSummary = item.event.summary

  if (item.event.type === 'lesson_generation_error') {
    return (
      <section className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground">
        <Trans>
          课程生成失败：
          {errorSummary}
        </Trans>
      </section>
    )
  }

  return (
    <section className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground">
      {errorSummary || item.event.type}
    </section>
  )
}
