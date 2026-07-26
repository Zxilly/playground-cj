'use client'

import { memo } from 'react'
import {
  AlertCircleIcon,
  CheckIcon,
  LoaderIcon,
  XCircleIcon,
} from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type {
  ToolCallMessagePartComponent,
  ToolCallMessagePartStatus,
} from '@assistant-ui/react'
import { cn } from '@/lib/utils'

type ToolStatus = ToolCallMessagePartStatus['type']

const statusIconMap: Record<ToolStatus, React.ElementType> = {
  'running': LoaderIcon,
  'complete': CheckIcon,
  'incomplete': XCircleIcon,
  'requires-action': AlertCircleIcon,
}

/**
 * Learner-facing tool status. Tool names, arguments, results, and raw errors
 * are deliberately not accepted by the rendered tree: Course Content Pack
 * results contain evaluator answers and editor tools can contain learner code.
 */
const ToolFallbackImpl: ToolCallMessagePartComponent = ({ status }) => {
  const isCancelled
    = status?.type === 'incomplete' && status.reason === 'cancelled'
  const isRunning = status?.type === 'running'
  const isFailed = status?.type === 'incomplete' && !isCancelled
  const Icon = statusIconMap[status?.type ?? 'complete']
  const label = isRunning
    ? <Trans>老师正在准备课堂内容…</Trans>
    : isCancelled
      ? <Trans>课堂操作已取消</Trans>
      : isFailed
        ? <Trans>课堂操作失败</Trans>
        : <Trans>课堂内容已准备</Trans>

  return (
    <div
      data-slot="tool-fallback-safe-summary"
      role={isRunning ? 'status' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border border-border bg-background px-3.5 py-3 text-xs text-muted-foreground',
        isCancelled && 'bg-muted line-through',
        isFailed && 'text-destructive',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0',
          isRunning && 'animate-spin motion-reduce:animate-none',
        )}
      />
      <span>{label}</span>
    </div>
  )
}

export const ToolFallback = memo(ToolFallbackImpl)
