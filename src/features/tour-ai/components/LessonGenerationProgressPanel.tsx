'use client'

import { CheckCircle2, ChevronDown, KeyRound, Loader2, Settings2, XCircle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { useId } from 'react'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { cn } from '@/lib/utils'
import type { LessonGenerationProgressState, LessonGenerationProgressStatus } from '@/features/tour-ai/state/lesson-generation-progress-state'
import type { LessonGenerationProgressItem } from '@/lib/ai/lesson-generation-progress'
import { friendlyToolStatus } from '@/features/tour-ai/utils/lesson-progress-friendly-status'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import type { LessonGenerationRecoveryReason } from '@/features/tour-ai/runtime/useLessonGenerationRuntime'

export function LessonGenerationProgressPanel({
  progress,
  visible,
  blockedReason,
  recoveryReason = null,
  stalled = false,
  onToggle,
}: {
  progress: LessonGenerationProgressState
  visible: boolean
  blockedReason?: 'api_key' | 'shared_quota'
  recoveryReason?: LessonGenerationRecoveryReason | null
  stalled?: boolean
  onToggle: () => void
}) {
  const headerButtonId = useId()
  const bodyId = useId()
  const statusId = useId()
  const blockedHeaderDescriptionId = useId()
  const shouldRender = visible && !(progress.status === 'completed' && !progress.expanded)
  if (!shouldRender)
    return null
  const expanded = progress.expanded || blockedReason != null
  const blockedHeaderDescription = blockedReason === 'api_key'
    ? t`完成 AI 服务配置前，进度面板会保持展开。`
    : blockedReason === 'shared_quota'
      ? t`等待共享额度期间，进度面板会保持展开。`
      : ''

  const headerLabel = t`课堂准备进度`
  const statusLabel = blockedReason === 'api_key'
    ? t`等待 AI 服务配置`
    : blockedReason === 'shared_quota'
      ? t`等待共享额度`
      : stalled && progress.status === 'running'
        ? t`等待 AI 响应`
        : lessonGenerationProgressStatusLabel(progress.status)
  // The api_key block is rendered as a dedicated CTA row in the body, so the
  // fallback text only needs to cover the non-blocked cases. Otherwise the
  // user would see the same configuration sentence twice.
  const bodyText = progress.text.trim()
    || (blockedReason
      ? ''
      : progress.status === 'running' ? t`正在准备下一步...` : t`暂无进度详情`)
  const items = progress.items?.length
    ? progress.items
    : bodyText ? [{ id: 'fallback-text', type: 'text' as const, text: bodyText }] : []
  const visibleToolItems = items.filter(item => item.type === 'tool')

  return (
    <section
      data-testid="lesson-generation-progress-panel"
      aria-busy={progress.status === 'running' || blockedReason != null}
      className="mt-5 overflow-hidden rounded-md border border-tour-border bg-tour-surface text-sm"
    >
      <button
        id={headerButtonId}
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-describedby={blockedReason ? `${statusId} ${blockedHeaderDescriptionId}` : statusId}
        aria-disabled={blockedReason != null || undefined}
        aria-label={headerLabel}
        title={blockedHeaderDescription || undefined}
        onClick={() => {
          if (blockedReason)
            return
          onToggle()
        }}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-tour-bg',
          blockedReason && 'cursor-default hover:bg-transparent',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-transform',
              !expanded && '-rotate-90',
            )}
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </span>
          {progress.status === 'running' && <MotionSpinner className="size-3.5 text-tour-accent-fg" />}
          <span className="min-w-0 break-words font-semibold text-tour-text">{headerLabel}</span>
        </span>
        <span
          id={statusId}
          data-testid="lesson-generation-progress-status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 max-w-[45%] break-words text-right text-xs text-muted-foreground"
        >
          {statusLabel}
        </span>
        {blockedReason && (
          <span id={blockedHeaderDescriptionId} className="sr-only">
            {blockedHeaderDescription}
          </span>
        )}
      </button>
      <div
        id={bodyId}
        role="region"
        aria-labelledby={headerButtonId}
        hidden={!expanded}
        className="overflow-hidden border-t border-tour-border bg-tour-bg"
      >
        {expanded && (
          <div className="max-h-64 space-y-2 overflow-auto p-3">
            {blockedReason === 'api_key' && <LessonGenerationApiKeyCta />}
            {blockedReason === 'shared_quota' && <LessonGenerationSharedQuotaCta />}
            {!blockedReason && recoveryReason && progress.status === 'running' && (
              <LessonGenerationRecoveryHint reason={recoveryReason} />
            )}
            {!blockedReason && !recoveryReason && stalled && <LessonGenerationStalledHint />}
            {!blockedReason && !recoveryReason && !stalled && visibleToolItems.length === 0 && (
              <LessonGenerationStatusHint status={progress.status} />
            )}
            {items.map((item) => {
              if (item.type === 'tool')
                return <LessonGenerationToolCall key={item.id} item={item} />
              if (item.type === 'reasoning') {
                // Reasoning chunks are internal model traces. The header
                // already communicates that generation is running; do not
                // expose chain-of-thought text in the learner UI.
                return null
              }
              return null
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function LessonGenerationRecoveryHint({ reason }: { reason: LessonGenerationRecoveryReason }) {
  const text = reason === 'shared_quota_auto'
    ? t`共享额度已恢复，课堂正在继续准备 AI 内容。`
    : t`已切换到你的 API Key，课堂正在继续准备 AI 内容。`
  return (
    <div
      data-testid="lesson-generation-recovery-hint"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-start gap-2 rounded-md border border-classroom-success-border bg-classroom-success-bg px-3 py-2 text-xs leading-relaxed text-classroom-success-fg"
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-words">{text}</div>
    </div>
  )
}

function LessonGenerationStalledHint() {
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const stalledDescriptionId = useId()
  const settingsTitle = t`打开 AI 服务设置检查服务地址、API Key、模型和额度；不会立即重试或清除已生成内容。`
  return (
    <div
      data-testid="lesson-generation-stalled-hint"
      className="flex flex-col gap-3 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:flex-row sm:items-start"
    >
      <div
        id={stalledDescriptionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 break-words leading-relaxed"
      >
        {t`AI 响应时间比预期更久。已生成内容不会丢失，你可以继续等待，或检查网络和 AI 设置。`}
      </div>
      <button
        type="button"
        aria-describedby={stalledDescriptionId}
        title={settingsTitle}
        onClick={() => openSettings(true)}
        className="inline-flex w-full max-w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-2 py-1 font-semibold hover:brightness-95 sm:w-auto"
      >
        <Settings2 aria-hidden="true" className="size-3.5" />
        <span className="min-w-0 break-words">{t`检查 AI 设置`}</span>
      </button>
    </div>
  )
}

function LessonGenerationStatusHint({ status }: { status: LessonGenerationProgressStatus }) {
  const text = status === 'failed'
    ? t`准备失败。可以重试，或检查网络和 API 设置。`
    : status === 'completed'
      ? t`课堂已准备好。`
      : t`正在连接课堂内容和练习规划，通常需要几秒。若长时间没有变化，请检查网络或 API 设置。`

  return (
    <div
      data-testid="lesson-generation-status-hint"
      className="break-words rounded-md border border-tour-border bg-tour-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground"
    >
      {text}
    </div>
  )
}

function LessonGenerationApiKeyCta() {
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const descriptionId = useId()
  const settingsTitle = t`打开 AI 服务设置完成服务地址、API Key 和模型配置；不会立即重试或清除已生成内容。`
  return (
    <div
      data-testid="lesson-generation-api-key-cta"
      className="flex flex-col gap-3 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:flex-row sm:items-start"
    >
      <div className="flex min-w-0 items-start gap-3">
        <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div
          id={descriptionId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 flex-1 break-words leading-relaxed"
        >
          {t`请先完成 AI 服务配置后继续准备下一步。`}
        </div>
      </div>
      <button
        type="button"
        aria-describedby={descriptionId}
        title={settingsTitle}
        onClick={() => openSettings(true)}
        className="w-full max-w-full shrink-0 rounded-md border border-classroom-warning-border bg-tour-surface px-2 py-1 font-semibold hover:brightness-95 sm:w-auto"
      >
        <span className="min-w-0 break-words">{t`打开设置`}</span>
      </button>
    </div>
  )
}

function LessonGenerationSharedQuotaCta() {
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const descriptionId = useId()
  const resetMoment = autoQuota?.nextResetAt ? formatResetMoment(autoQuota.nextResetAt) : ''
  const settingsTitle = resetMoment
    ? t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的课堂任务或清除已生成内容。共享额度下次刷新：${resetMoment}。`
    : t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的课堂任务或清除已生成内容。`
  return (
    <div
      data-testid="lesson-generation-shared-quota-cta"
      className="flex flex-col gap-3 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:flex-row sm:items-start"
    >
      <div className="flex min-w-0 items-start gap-3">
        <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div
          id={descriptionId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 flex-1 break-words leading-relaxed"
        >
          {resetMoment
            ? t`共享额度已用完。下次刷新：${resetMoment}，刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。`
            : t`共享额度已用完。刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。`}
        </div>
      </div>
      <button
        type="button"
        aria-describedby={descriptionId}
        title={settingsTitle}
        onClick={() => openSettings(true)}
        className="w-full max-w-full shrink-0 rounded-md border border-classroom-warning-border bg-tour-surface px-2 py-1 font-semibold hover:brightness-95 sm:w-auto"
      >
        <span className="min-w-0 break-words">{t`使用自己的 API Key`}</span>
      </button>
    </div>
  )
}

function LessonGenerationToolCall({ item }: { item: Extract<LessonGenerationProgressItem, { type: 'tool' }> }) {
  const statusLabel = lessonGenerationToolStatusLabel(item.status)
  const statusTone = item.status === 'completed'
    ? 'text-classroom-success-fg'
    : item.status === 'failed' ? 'text-destructive' : 'text-tour-accent-fg'
  const friendly = friendlyToolStatus(item.toolName)
  const summary = lessonGenerationToolSummaryLabel(item, statusLabel)

  return (
    <div
      data-testid="lesson-generation-tool-call"
      className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-tour-border bg-tour-surface px-3 py-2"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span className={cn('mt-0.5 shrink-0', statusTone)}>
          {item.status === 'completed'
            ? <CheckCircle2 aria-hidden="true" className="size-4" />
            : item.status === 'failed' ? <XCircle aria-hidden="true" className="size-4" /> : <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        </span>
        <div className="min-w-0">
          {/* Friendly label replaces the raw tool name (e.g. "append_concept_card")
              that previously leaked here. Raw name moves to the title attribute so
              developers / power users can still inspect it on hover. */}
          <div
            className="truncate text-xs font-semibold text-tour-text"
            title={friendly.label}
            data-tool-name={item.toolName}
          >
            {friendly.label}
          </div>
          {summary && (
            <div data-testid="lesson-generation-tool-summary" className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
              {summary}
            </div>
          )}
        </div>
      </div>
      <span className={cn('shrink-0 text-xs font-semibold', statusTone)}>{statusLabel}</span>
    </div>
  )
}

function lessonGenerationToolSummaryLabel(
  item: Extract<LessonGenerationProgressItem, { type: 'tool' }>,
  statusLabel: string,
): string | null {
  if (item.status === 'failed')
    return t`这一步未完成。已有内容会保留；如果准备失败，可以重试。`
  if (!item.summary || item.summary === statusLabel)
    return null
  return item.summary
}

function MotionSpinner({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 animate-spin items-center justify-center"
    >
      <Loader2 aria-hidden="true" className={className} />
    </span>
  )
}

function lessonGenerationProgressStatusLabel(status: LessonGenerationProgressStatus): string {
  const labels: Record<LessonGenerationProgressStatus, string> = {
    running: t`正在准备课堂`,
    completed: t`课堂已准备好`,
    failed: t`准备失败`,
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
