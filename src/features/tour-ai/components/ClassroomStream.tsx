'use client'

import { Trans } from '@lingui/react/macro'
import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import { useClassroomVirtuosoRef } from '@/features/tour-ai/context/classroom-virtuoso-context'
import { LessonBlockView } from '@/features/tour-ai/components/LessonBlockView'
import { ClassroomWelcomeCard } from '@/features/tour-ai/components/ClassroomWelcomeCard'
import { QuizPracticeCard } from '@/features/tour-ai/components/QuizPracticeCard'
import { useViewportRef } from '@/features/tour-ai/context/classroom-viewport-context'
import { lessonBlockDomId } from '@/lib/ai/classroom/selectors'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type {
  ClassroomQuiz,
  ClassroomSession,
  ClassroomStreamItem,
} from '@/lib/ai/classroom/types'
import { useLLMConfig } from '@/stores/llmConfig'
import { cn } from '@/lib/utils'
import { classroomCardVariants, classroomFadeUpVariants, classroomStaggerVariants } from '@/features/tour-ai/components/classroom-motion'

interface ClassroomStreamProps {
  session: ClassroomSession
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
}

export function ClassroomStream({ session, lang, dispatch, bridge }: ClassroomStreamProps) {
  const viewportRef = useViewportRef()
  const config = useLLMConfig()
  const virtuosoRef = useClassroomVirtuosoRef()
  if (session.stream.length === 0)
    return <ClassroomWelcomeCard hasApiKey={Boolean(config.apiKey)} />

  return (
    <Virtuoso
      ref={virtuosoRef ?? undefined}
      data={session.stream.filter(item => item.type !== 'run_result')}
      customScrollParent={viewportRef.current ?? undefined}
      computeItemKey={(_, item) => item.id}
      // Rough average between paragraph blocks (~120) and quiz cards (~600).
      // Only used as a placeholder for not-yet-rendered items; real heights
      // come from Virtuoso's ResizeObserver after first paint.
      defaultItemHeight={240}
      itemContent={(_, item) => (
        // No `layout` — Virtuoso owns item positioning via spacer divs and
        // framer-motion's FLIP would otherwise fight the spacer adjustments.
        // No `exit` — there is no enclosing AnimatePresence, and Virtuoso
        // would not honour an exit animation anyway (it drops items from the
        // data list synchronously). Enter animation stays on opacity+y, both
        // of which are transforms and don't perturb offsetHeight.
        <motion.div
          variants={classroomFadeUpVariants}
          initial="hidden"
          animate="visible"
          className="mb-5"
        >
          <StreamItemView
            item={item}
            currentQuiz={session.currentQuiz}
            lang={lang}
            dispatch={dispatch}
            bridge={bridge}
            lastRun={session.lastRun}
          />
        </motion.div>
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
  lastRun,
}: {
  item: ClassroomStreamItem
  currentQuiz: ClassroomQuiz | null
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
  lastRun: ClassroomSession['lastRun']
}) {
  if (item.type === 'lesson_blocks') {
    return (
      <motion.div
        variants={classroomStaggerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {item.blocks.map((block, blockIndex) => (
          <LessonBlockView
            key={lessonBlockDomId(item.id, blockIndex)}
            block={block}
            chapterId={block.type === 'heading' ? lessonBlockDomId(item.id, blockIndex) : undefined}
          />
        ))}
      </motion.div>
    )
  }

  if (item.type === 'quiz') {
    return (
      <QuizPracticeCard
        quiz={item.quiz}
        isActive={Boolean(currentQuiz && currentQuiz.id === item.quiz.id && currentQuiz.status === 'active')}
        lang={lang}
        dispatch={dispatch}
        bridge={bridge}
        lastRun={currentQuiz?.id === item.quiz.id ? lastRun : null}
      />
    )
  }

  // No `layout` on the inner sections: each Virtuoso row re-renders whenever
  // the stream array changes, and `layout` would fire FLIP animations against
  // a position that Virtuoso's spacer has already adjusted for us.
  if (item.type === 'run_result') {
    return (
      <motion.section variants={classroomCardVariants} className={cn('rounded-md border border-tour-border bg-tour-surface p-4', 'text-sm')}>
        <div className="mb-2 font-semibold"><Trans>运行结果</Trans></div>
        <pre className="whitespace-pre-wrap rounded bg-tour-code-bg p-3 font-mono text-xs">
          <Trans>输出：</Trans>
          {item.result.stdout || <Trans>(empty)</Trans>}
        </pre>
      </motion.section>
    )
  }

  if (item.type === 'progress_update') {
    return (
      <motion.section variants={classroomCardVariants} className="inline-flex items-center gap-2 rounded-md border border-classroom-success-border bg-classroom-success-bg px-3 py-2 text-sm text-classroom-success-fg">
        <Check className="size-4" />
        <Trans>已记录：</Trans>
        {item.outcome}
        {' '}
        ·
        {' '}
        {item.conceptId}
      </motion.section>
    )
  }

  const errorSummary = item.event.summary

  if (item.event.type === 'lesson_generation_error') {
    return (
      <motion.section variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground">
        <Trans>
          课程生成失败：
          {errorSummary}
        </Trans>
      </motion.section>
    )
  }

  return (
    <motion.section variants={classroomCardVariants} className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground">
      {errorSummary || item.event.type}
    </motion.section>
  )
}
