import { ChevronDown, Loader2 } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { cn } from '@/lib/utils'
import type { LessonGenerationProgressState, LessonGenerationProgressStatus } from '@/features/tour-ai/state/lesson-generation-progress-state'

export function LessonGenerationProgressPanel({
  progress,
  visible,
  onToggle,
}: {
  progress: LessonGenerationProgressState
  visible: boolean
  onToggle: () => void
}) {
  if (!visible)
    return null

  const headerLabel = t`课程生成进度`
  const statusLabel = lessonGenerationProgressStatusLabel(progress.status)
  const bodyText = progress.text.trim() || (progress.status === 'running' ? t`等待生成进度...` : t`暂无进度详情`)

  return (
    <section data-testid="lesson-generation-progress-panel" className="mt-5 overflow-hidden rounded-md border border-tour-border bg-tour-surface text-sm">
      <button
        type="button"
        aria-expanded={progress.expanded}
        aria-controls="lesson-generation-progress-body"
        aria-label={headerLabel}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-tour-bg"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !progress.expanded && '-rotate-90')} />
          {progress.status === 'running' && <Loader2 className="size-3.5 shrink-0 animate-spin text-tour-accent-fg" />}
          <span className="font-semibold text-tour-text">{headerLabel}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{statusLabel}</span>
      </button>
      {progress.expanded && (
        <div id="lesson-generation-progress-body" className="border-t border-tour-border bg-tour-bg p-3">
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
            {bodyText}
          </pre>
        </div>
      )}
    </section>
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
