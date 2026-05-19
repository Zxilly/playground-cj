'use client'

import { CheckCircle2, ChevronDown, KeyRound, Loader2, Wrench, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { cn } from '@/lib/utils'
import type { LessonGenerationProgressState, LessonGenerationProgressStatus } from '@/features/tour-ai/state/lesson-generation-progress-state'
import type { LessonGenerationProgressItem } from '@/lib/ai/lesson-generation-progress'
import {
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from '@/modules/assistant-ui/registry/reasoning-primitives'
import {
  classroomCardVariants,
  classroomCollapseVariants,
  classroomQuickTransition,
  classroomSpinTransition,
  classroomStaggerVariants,
} from '@/features/tour-ai/components/classroom-motion'
import { friendlyToolStatus } from '@/features/tour-ai/utils/lesson-progress-friendly-status'

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
  // The api_key block is rendered as a dedicated CTA row in the body, so the
  // fallback text only needs to cover the non-blocked cases. Otherwise the
  // user would see the same "请配置 API Key" sentence twice.
  const bodyText = progress.text.trim()
    || (blockedReason === 'api_key'
      ? ''
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
                {blockedReason === 'api_key' && <LessonGenerationApiKeyCta />}
                <AnimatePresence initial={false}>
                  {items.map((item, index) => {
                    if (item.type === 'tool')
                      return <LessonGenerationToolCall key={item.id} item={item} />
                    if (item.type === 'reasoning') {
                      // Shimmer the trigger only while THIS block is the one
                      // currently being streamed — i.e. nothing has appended
                      // after it yet and the overall run is still running.
                      const active = progress.status === 'running' && index === items.length - 1
                      return <LessonGenerationReasoning key={item.id} item={item} active={active} />
                    }
                    return <LessonGenerationTextProgress key={item.id} item={item} />
                  })}
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

const REASONING_MARKDOWN_COMPONENTS = {
  p: ({ className, ...props }: React.ComponentProps<'p'>) => (
    <p className={cn('my-1.5 leading-relaxed first:mt-0 last:mb-0', className)} {...props} />
  ),
  ul: ({ className, ...props }: React.ComponentProps<'ul'>) => (
    <ul className={cn('my-1.5 ms-4 list-disc marker:text-muted-foreground/60 [&>li]:mt-0.5', className)} {...props} />
  ),
  ol: ({ className, ...props }: React.ComponentProps<'ol'>) => (
    <ol className={cn('my-1.5 ms-4 list-decimal marker:text-muted-foreground/60 [&>li]:mt-0.5', className)} {...props} />
  ),
  li: ({ className, ...props }: React.ComponentProps<'li'>) => (
    <li className={cn('leading-relaxed', className)} {...props} />
  ),
  code: ({ className, ...props }: React.ComponentProps<'code'>) => (
    <code className={cn('rounded border border-border/40 bg-muted/40 px-1 py-0.5 font-mono text-[0.85em]', className)} {...props} />
  ),
  pre: ({ className, ...props }: React.ComponentProps<'pre'>) => (
    <pre className={cn('my-2 overflow-x-auto rounded border border-border/40 bg-muted/40 p-2 font-mono text-[0.85em] leading-relaxed [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0', className)} {...props} />
  ),
  a: ({ className, ...props }: React.ComponentProps<'a'>) => (
    <a className={cn('underline underline-offset-2 hover:text-foreground', className)} target="_blank" rel="noreferrer" {...props} />
  ),
  blockquote: ({ className, ...props }: React.ComponentProps<'blockquote'>) => (
    <blockquote className={cn('my-1.5 border-s-2 border-muted-foreground/30 ps-2 italic', className)} {...props} />
  ),
} as const

function LessonGenerationReasoning({
  item,
  active,
}: {
  item: Extract<LessonGenerationProgressItem, { type: 'reasoning' }>
  active: boolean
}) {
  // Reuse the same Reasoning primitives the chat side renders so the brain
  // icon / shimmer / collapsible UX stays consistent. Reasoning content is
  // rendered as markdown because models often emit code fences and lists.
  const text = item.text
  // Auto-open the *currently streaming* reasoning block so the learner can see
  // "AI is thinking" in real time, but collapse historical reasoning blocks so
  // the panel doesn't become a wall of past chain-of-thought. Click-to-expand
  // remains available for anyone who wants the older traces.
  return (
    <motion.div layout data-testid="lesson-generation-reasoning" variants={classroomCardVariants}>
      <ReasoningRoot variant="muted" defaultOpen={active} className="mb-0">
        <ReasoningTrigger active={active} />
        <ReasoningContent aria-busy={active}>
          <ReasoningText className="max-h-48 ps-0 pt-1 pb-1 text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={REASONING_MARKDOWN_COMPONENTS}>
              {text}
            </ReactMarkdown>
          </ReasoningText>
        </ReasoningContent>
      </ReasoningRoot>
    </motion.div>
  )
}

function LessonGenerationApiKeyCta() {
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  return (
    <motion.div
      layout
      data-testid="lesson-generation-api-key-cta"
      variants={classroomCardVariants}
      className="flex items-start gap-3 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg"
    >
      <KeyRound className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 leading-relaxed">
        {t`请在设置中配置 API Key 后继续生成课程。`}
      </div>
      <button
        type="button"
        onClick={() => openSettings(true)}
        className="shrink-0 rounded-md border border-classroom-warning-border bg-tour-surface px-2 py-1 font-semibold hover:brightness-95"
      >
        {t`打开设置`}
      </button>
    </motion.div>
  )
}

function LessonGenerationToolCall({ item }: { item: Extract<LessonGenerationProgressItem, { type: 'tool' }> }) {
  const statusLabel = lessonGenerationToolStatusLabel(item.status)
  const statusTone = item.status === 'completed'
    ? 'text-classroom-success-fg'
    : item.status === 'failed' ? 'text-destructive' : 'text-tour-accent-fg'
  const friendly = friendlyToolStatus(item.toolName)

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
          {/* Friendly label replaces the raw tool name (e.g. "append_concept_card")
              that previously leaked here. Raw name moves to the title attribute so
              developers / power users can still inspect it on hover. */}
          <div
            className="truncate text-xs font-semibold text-tour-text"
            title={item.toolName}
            data-tool-name={item.toolName}
          >
            {friendly.label}
          </div>
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
