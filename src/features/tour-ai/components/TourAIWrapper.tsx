'use client'

import dynamic from 'next/dynamic'
import { motion, MotionConfig } from 'framer-motion'
import { Trans } from '@lingui/react/macro'
import { ClassroomBrandChip } from '@/features/tour-ai/components/ClassroomBrandChip'
import { cn } from '@/lib/utils'
import { classroomCardVariants, classroomFadeUpVariants, classroomStaggerVariants } from '@/features/tour-ai/components/classroom-motion'

function AIClassroomLoadingShell() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        data-motion="ai-classroom-fallback"
        variants={classroomFadeUpVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="ai-classroom-root h-screen bg-tour-bg text-tour-text"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border bg-tour-surface px-5">
          <div className="flex min-w-0 items-center gap-3">
            <ClassroomBrandChip />
          </div>
        </header>
        <motion.main
          variants={classroomStaggerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto w-full max-w-[920px] px-6 py-8 pb-20"
        >
          <motion.div variants={classroomFadeUpVariants} className="text-xs font-semibold uppercase text-tour-link"><Trans>课堂内容</Trans></motion.div>
          <motion.h1 variants={classroomFadeUpVariants} className="mt-1 text-2xl font-bold tracking-normal text-tour-heading"><Trans>AI 课堂</Trans></motion.h1>
          <motion.div variants={classroomCardVariants} className={cn('rounded-md border border-tour-border bg-tour-surface px-4 py-4 text-sm text-muted-foreground', 'mt-6')}>
            <Trans>正在加载 AI 课堂</Trans>
          </motion.div>
        </motion.main>
      </motion.div>
    </MotionConfig>
  )
}

const TourAIApp = dynamic(
  () => import('./TourAIApp'),
  {
    ssr: false,
    loading: AIClassroomLoadingShell,
  },
)

const ChineseTourAIApp = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(
    () => import('./TourAIApp'),
  ),
  {
    ssr: false,
    loading: AIClassroomLoadingShell,
  },
)

interface TourAIWrapperProps {
  lang: string
}

export default function TourAIWrapper(props: TourAIWrapperProps) {
  const Component = props.lang === 'zh' ? ChineseTourAIApp : TourAIApp
  return <Component lang={props.lang} />
}
