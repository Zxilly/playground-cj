'use client'

import { Check } from 'lucide-react'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { cn } from '@/lib/utils'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type {
  ClassroomQuiz,
  ClassroomSession,
  ClassroomStreamItem,
} from '@/lib/ai/classroom/types'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'
import { lessonBlockKey } from '@/features/tour-ai/utils/lesson-block-key'
import { LessonBlockView } from '@/features/tour-ai/components/LessonBlockView'
import { QuizPracticeCard } from '@/features/tour-ai/components/QuizPracticeCard'

interface ClassroomStreamProps {
  session: ClassroomSession
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
}

export function ClassroomStream({ session, lang, dispatch, bridge }: ClassroomStreamProps) {
  if (session.stream.length === 0) {
    return (
      <div className={aiClassroomStyles.surface.muted}>
        正在规划下一步
      </div>
    )
  }

  return (
    <div className={aiClassroomStyles.stream.list}>
      {session.stream.map(item => (
        <StreamItemView
          key={item.id}
          item={item}
          currentQuiz={session.currentQuiz}
          lang={lang}
          dispatch={dispatch}
          bridge={bridge}
        />
      ))}
    </div>
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
      <div className={aiClassroomStyles.stream.lessonBlocks}>
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
      <section className={cn(aiClassroomStyles.surface.card, 'text-sm')}>
        <div className={cn(aiClassroomStyles.text.titleSmall, 'mb-2')}>运行结果</div>
        <pre className={aiClassroomStyles.code.result}>
          输出：
          {item.result.stdout || '(empty)'}
        </pre>
      </section>
    )
  }

  if (item.type === 'progress_update') {
    return (
      <section className={aiClassroomStyles.surface.success}>
        <Check className="size-4" />
        已记录：
        {item.outcome}
        {' '}
        ·
        {' '}
        {item.conceptId}
      </section>
    )
  }

  return (
    <section className={aiClassroomStyles.surface.system}>
      {item.event.type}
    </section>
  )
}
