'use client'

import { CheckCircle2, ChevronDown, Loader2, Wrench, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { cn } from '@/lib/utils'
import type { LessonGenerationProgressState, LessonGenerationProgressStatus } from '@/features/tour-ai/state/lesson-generation-progress-state'
import type { LessonGenerationProgressItem } from '@/lib/ai/lesson-generation-progress'
import {
  classroomCardVariants,
  classroomCollapseVariants,
  classroomQuickTransition,
  classroomSpinTransition,
  classroomStaggerVariants,
} from '@/features/tour-ai/components/classroom-motion'

export function LessonGenerationProgressPanel({
  progress,
  visible,
  blockedReason,
  onToggle,
}: {
  progress: LessonGenerationProgressState
  visible: boolean
  blockedReason?: 'api_key'
  onToggle: () => void
}) {
  const shouldRender = visible && !(progress.status === 'completed' && !progress.expanded)
  if (!shouldRender) {
    return (
      <AnimatePresence initial={false} />
    )
  }

  const headerLabel = t`课程生成进度`
  const statusLabel = blockedReason === 'api_key'
    ? t`等待 API Key`
    : lessonGenerationProgressStatusLabel(progress.status)
  const bodyText = progress.text.trim()
    || (blockedReason === 'api_key'
      ? t`请在设置中配置 API Key 后继续生成课程。`
      : progress.status === 'running' ? t`等待生成进度...` : t`暂无进度详情`)
  const items = progress.items?.length
    ? progress.items
    : bodyText ? [{ id: 'fallback-text', type: 'text' as const, text: bodyText }] : []

  return (
    <AnimatePresence initial={false}>
      <motion.section
        key="lesson-generation-progress-panel"
        layout
        data-testid="lesson-generation-progress-panel"
        variants={classroomCardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="mt-5 overflow-hidden rounded-md border border-tour-border bg-tour-surface text-sm"
      >
        <button
          type="button"
          aria-expanded={progress.expanded}
          aria-controls="lesson-generation-progress-body"
          aria-label={headerLabel}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-tour-bg"
        >
          <span className="flex min-w-0 items-center gap-2">
            <motion.span
              aria-hidden="true"
              animate={{ rotate: progress.expanded ? 0 : -90 }}
              transition={classroomQuickTransition}
              className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground"
            >
              <ChevronDown className="size-4" />
            </motion.span>
            {progress.status === 'running' && <MotionSpinner className="size-3.5 text-tour-accent-fg" />}
            <span className="font-semibold text-tour-text">{headerLabel}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{statusLabel}</span>
        </button>
        <AnimatePresence initial={false}>
          {progress.expanded && (
            <motion.div
              key="lesson-generation-progress-body"
              id="lesson-generation-progress-body"
              variants={classroomCollapseVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden border-t border-tour-border bg-tour-bg"
            >
              <motion.div
                variants={classroomStaggerVariants}
                initial="hidden"
                animate="visible"
                className="max-h-64 space-y-2 overflow-auto p-3"
              >
                <AnimatePresence initial={false}>
                  {items.map(item => (
                    item.type === 'tool'
                      ? <LessonGenerationToolCall key={item.id} item={item} />
                      : <LessonGenerationTextProgress key={item.id} item={item} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </AnimatePresence>
  )
}

function LessonGenerationTextProgress({ item }: { item: Extract<LessonGenerationProgressItem, { type: 'text' }> }) {
  return (
    <motion.p layout variants={classroomCardVariants} className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
      {item.text.trim() || item.text}
    </motion.p>
  )
}

function LessonGenerationToolCall({ item }: { item: Extract<LessonGenerationProgressItem, { type: 'tool' }> }) {
  const statusLabel = lessonGenerationToolStatusLabel(item.status)
  const statusTone = item.status === 'completed'
    ? 'text-classroom-success-fg'
    : item.status === 'failed' ? 'text-destructive' : 'text-tour-accent-fg'

  return (
    <motion.div
      layout
      data-testid="lesson-generation-tool-call"
      variants={classroomCardVariants}
      className="flex items-start justify-between gap-3 rounded-md border border-tour-border bg-tour-surface px-3 py-2"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className={cn('mt-0.5 shrink-0', statusTone)}>
          {item.status === 'completed'
            ? <CheckCircle2 className="size-4" />
            : item.status === 'failed' ? <XCircle className="size-4" /> : <Wrench className="size-4" />}
        </span>
        <div className="min-w-0">
          <div className="truncate font-mono text-xs font-semibold text-tour-text">{item.toolName}</div>
          {item.summary && <div className="mt-1 text-xs text-muted-foreground">{item.summary}</div>}
        </div>
      </div>
      <span className={cn('shrink-0 text-xs font-semibold', statusTone)}>{statusLabel}</span>
    </motion.div>
  )
}

function MotionSpinner({ className }: { className: string }) {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={classroomSpinTransition}
      className="inline-flex shrink-0 items-center justify-center"
    >
      <Loader2 className={className} />
    </motion.span>
  )
}

function lessonGenerationProgressStatusLabel(status: LessonGenerationProgressStatus): string {
  const labels: Record<LessonGenerationProgressStatus, string> = {
    running: t`正在编写课程`,
    completed: t`课程内容已生成`,
    failed: t`生成失败`,
    idle: t`等待开始`,
  }
  return labels[status]
}

function lessonGenerationToolStatusLabel(status: Extract<LessonGenerationProgressItem, { type: 'tool' }>['status']): string {
  const labels = {
    running: t`运行中`,
    completed: t`已完成`,
    failed: t`失败`,
  }
  return labels[status]
}
