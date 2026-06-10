'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BookOpenCheck, RefreshCw, Settings2 } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { ChatIntentKind, ClassroomEvent, ClassroomSession } from '@/lib/ai/classroom/types'
import { compactPlainText } from '@/lib/ai/classroom/display-text'
import { cn } from '@/lib/utils'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

type LessonGenerationRetryBlockedReason = 'running' | 'api_key' | 'shared_quota'

export function LessonGenerationErrorRetry({
  session,
  retryableInitialFailure = false,
  retryBlockedReason,
  readableContentAvailable = false,
  onRetry,
  onOpenReview,
}: {
  session: ClassroomSession
  retryableInitialFailure?: boolean
  retryBlockedReason?: LessonGenerationRetryBlockedReason
  readableContentAvailable?: boolean
  onRetry: () => void
  onOpenReview?: () => void
}) {
  const [retryRequest, setRetryRequest] = useState<{ failureSignature: string } | null>(null)
  const lastClickRef = useRef(0)
  const titleId = useId()
  const descriptionId = useId()
  const retryContextId = useId()
  const retrySafetyId = useId()
  const retryBlockedHintId = useId()
  const retryRequestedStatusId = useId()
  const errorSummaryId = useId()
  const reviewActionDescriptionId = useId()
  const settingsActionDescriptionId = useId()
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)

  useEffect(() => {
    if (retryBlockedReason === 'running' && retryRequest != null) {
      // Once the runtime has acknowledged the retry, let the parent-owned
      // running state control the disabled affordance. This keeps repeated
      // failures with the same message retryable after the run settles.
      // eslint-disable-next-line react/set-state-in-effect -- External runtime acknowledgement clears a stale local retry lock.
      setRetryRequest(null)
    }
  }, [retryBlockedReason, retryRequest])

  if (session.eventQueue.length === 0 && !retryableInitialFailure)
    return null

  const lastError = session.stream.findLast(
    item => item.type === 'system_event' && item.event.type === 'lesson_generation_error',
  )
  const errorSummary = lastError?.type === 'system_event' && lastError.event.type === 'lesson_generation_error'
    ? lastError.event.summary
    : retryableInitialFailure
      ? ''
      : null
  if (errorSummary == null)
    return null
  const retryEvent = session.eventQueue[0]
  const retryContext = retryContextLabel(retryEvent, retryableInitialFailure)
  const failureSignature = retryFailureSignature(retryEvent, errorSummary, retryableInitialFailure)
  const retryRequested = retryBlockedReason == null && retryRequest?.failureSignature === failureSignature
  const presentation = retryPresentation(retryEvent, {
    retryableInitialFailure,
    readableContentAvailable,
  })
  const retrySafetyText = readableContentAvailable
    ? t`恢复范围：重试只会重新准备失败的 AI 任务；已生成内容、练习结果和复习笔记会保留。`
    : t`恢复范围：重试只会重新准备失败的 AI 任务；不会清除已有课堂记录。`
  const retryBlockedHintTextValue = retryBlockedReason
    ? retryBlockedHintText(retryBlockedReason, autoQuota?.nextResetAt)
    : ''
  const errorSummaryPreview = errorSummary ? compactPlainText(errorSummary, 220) : ''
  const alertDescription = [
    descriptionId,
    retryContext ? retryContextId : null,
    retrySafetyId,
    retryBlockedReason ? retryBlockedHintId : null,
    errorSummaryPreview ? errorSummaryId : null,
  ].filter((id): id is string => Boolean(id)).join(' ')
  const retryButtonDescription = [
    retryContext ? retryContextId : null,
    retrySafetyId,
    retryBlockedReason ? retryBlockedHintId : null,
    retryRequested ? retryRequestedStatusId : null,
  ].filter((id): id is string => Boolean(id)).join(' ')

  const retryDisabled = retryBlockedReason != null || retryRequested
  const settingsActionLabel = retryBlockedReason === 'shared_quota'
    ? <Trans>使用自己的 API Key</Trans>
    : <Trans>检查 AI 设置</Trans>
  const settingsActionDescription = retryBlockedReason === 'shared_quota'
    ? t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会立即重试。`
    : t`打开 AI 服务设置检查服务地址、API Key、模型和额度，不会立即重试。`
  const reviewActionDescription = t`打开复习视图查看已经生成的课堂内容，不会重试失败的 AI 任务。`
  const retryButtonTitle = [
    retryContext ? t`将重试：${retryContext}` : null,
    retrySafetyText,
    retryBlockedHintTextValue || null,
    retryRequested ? t`已收到重试请求，正在准备课堂内容。` : null,
  ].filter((text): text is string => Boolean(text)).join(' ')
  const handleClick = () => {
    if (retryDisabled)
      return
    const now = Date.now()
    if (now - lastClickRef.current < 300)
      return
    lastClickRef.current = now
    setRetryRequest({ failureSignature })
    onRetry()
  }

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={alertDescription || undefined}
      className={cn('rounded-md border border-classroom-warning-border bg-classroom-warning-bg p-3 text-sm text-classroom-warning-fg', 'mt-4')}
    >
      <div
        role="alert"
        aria-labelledby={titleId}
        aria-describedby={alertDescription || undefined}
      >
        <div id={titleId} className="font-semibold">
          {presentation.title}
        </div>
        <div id={descriptionId} className="mt-1 text-xs leading-6">
          {presentation.description}
        </div>
        {retryContext && (
          <div id={retryContextId} data-testid="lesson-generation-retry-context" className="mt-2 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-2 text-xs leading-6">
            <Trans>将重试：</Trans>
            {retryContext}
          </div>
        )}
        <div id={retrySafetyId} data-testid="lesson-generation-retry-safety" className="mt-2 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-2 text-xs leading-6">
          {retrySafetyText}
        </div>
        {retryBlockedReason && (
          <div
            id={retryBlockedHintId}
            data-testid="lesson-generation-retry-blocked-hint"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-2 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-2 text-xs leading-6"
          >
            {retryBlockedHintTextValue}
          </div>
        )}
        {retryRequested && (
          <div
            id={retryRequestedStatusId}
            data-testid="lesson-generation-retry-requested-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-2 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-2 text-xs leading-6"
          >
            <Trans>已收到重试请求，正在准备课堂内容。</Trans>
          </div>
        )}
        {errorSummaryPreview
          ? (
              <div
                id={errorSummaryId}
                title={errorSummary}
                className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-2 text-xs leading-6"
              >
                <Trans>失败原因：</Trans>
                {errorSummaryPreview}
              </div>
            )
          : null}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={retryDisabled}
          aria-describedby={retryButtonDescription || undefined}
          title={retryButtonTitle}
          onClick={handleClick}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-3.5', (retryBlockedReason === 'running' || retryRequested) && 'animate-spin')}
          />
          {retryBlockedReason === 'running' || retryRequested
            ? <Trans>正在重试...</Trans>
            : presentation.retryLabel}
        </button>
        {readableContentAvailable && onOpenReview && (
          <button
            type="button"
            onClick={onOpenReview}
            aria-describedby={reviewActionDescriptionId}
            title={reviewActionDescription}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg hover:bg-tour-bg sm:w-auto"
          >
            <BookOpenCheck aria-hidden="true" className="size-3.5" />
            <Trans>去复习已生成内容</Trans>
          </button>
        )}
        <button
          type="button"
          onClick={() => openSettings(true)}
          aria-describedby={settingsActionDescriptionId}
          title={settingsActionDescription}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg hover:bg-tour-bg sm:w-auto"
        >
          <Settings2 aria-hidden="true" className="size-3.5" />
          {settingsActionLabel}
        </button>
        <span id={reviewActionDescriptionId} className="sr-only">
          {reviewActionDescription}
        </span>
        <span id={settingsActionDescriptionId} className="sr-only">
          {settingsActionDescription}
        </span>
      </div>
    </section>
  )
}

function retryFailureSignature(
  event: ClassroomEvent | undefined,
  errorSummary: string,
  retryableInitialFailure: boolean,
): string {
  if (!event)
    return retryableInitialFailure ? `initial:${errorSummary}` : `empty:${errorSummary}`
  return [
    event.type,
    event.createdAt,
    event.type === 'chat_intent' ? event.intent : '',
    event.summary ?? '',
    errorSummary,
  ].join(':')
}

function retryPresentation(
  event: ClassroomEvent | undefined,
  {
    retryableInitialFailure,
    readableContentAvailable,
  }: {
    retryableInitialFailure: boolean
    readableContentAvailable: boolean
  },
): { title: string, description: string, retryLabel: string } {
  const isInitialPreparation = retryableInitialFailure || event?.type === 'classroom_opened'

  if (isInitialPreparation) {
    return {
      title: t`课堂准备失败`,
      description: t`可以重试；如果持续失败，请检查网络、模型和 API Key 设置。`,
      retryLabel: t`重试准备课堂`,
    }
  }

  if (readableContentAvailable) {
    return {
      title: t`这次 AI 生成失败`,
      description: t`现有课堂内容仍可阅读；可以重试这次任务，或先继续复习已生成内容。`,
      retryLabel: t`重试这次任务`,
    }
  }

  return {
    title: t`下一步准备失败`,
    description: t`可以重试；如果持续失败，请检查网络、模型和 API Key 设置。`,
    retryLabel: t`重试准备下一步`,
  }
}

function retryBlockedHintText(reason: LessonGenerationRetryBlockedReason, nextResetAt?: number): string {
  if (reason === 'running') {
    return t`正在重试课堂准备，请稍候。`
  }
  if (reason === 'api_key') {
    return t`完成 AI 服务配置后再重试。`
  }
  const resetMoment = nextResetAt ? formatResetMoment(nextResetAt) : ''
  return resetMoment
    ? t`共享额度将在${resetMoment}自动刷新；刷新后再重试，或改用自己的 API Key 立刻继续。`
    : t`共享额度刷新后再重试，或改用自己的 API Key 立刻继续。`
}

function retryContextLabel(event: ClassroomEvent | undefined, retryableInitialFailure: boolean): string | null {
  if (!event) {
    return retryableInitialFailure ? t`首次课堂准备` : null
  }
  if (event.type === 'classroom_opened') {
    return t`首次课堂准备`
  }
  if (event.type === 'exercise_success') {
    return event.exerciseIntent === 'review_check'
      ? t`复习检查结果反馈`
      : t`继续下一步课程`
  }
  if (event.type === 'exercise_skip') {
    return event.exerciseIntent === 'review_check'
      ? t`复习检查跳过反馈`
      : t`跳过后的下一步`
  }
  if (event.type === 'exercise_failure') {
    return event.exerciseIntent === 'review_check'
      ? t`复习检查错误反馈`
      : t`练习错误反馈`
  }
  if (event.type === 'chat_intent') {
    return chatIntentRetryContextLabel(event.intent)
  }
  return null
}

function chatIntentRetryContextLabel(intent: ChatIntentKind): string {
  if (intent === 'advance') {
    return t`继续下一步`
  }
  if (intent === 'go_deeper') {
    return t`深入讲解`
  }
  if (intent === 'slow_down') {
    return t`放慢讲解`
  }
  if (intent === 'change_topic') {
    return t`切换主题`
  }
  if (intent === 'explain_error') {
    return t`错误讲解`
  }
  return t`复习检查`
}
