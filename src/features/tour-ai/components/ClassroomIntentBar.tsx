'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronsRight, HelpCircle, KeyRound, Loader2, Telescope, Turtle } from 'lucide-react'
import { t } from '@lingui/core/macro'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ChatIntentKind, ClassroomSession, ExerciseIntent } from '@/lib/ai/classroom/types'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { cn } from '@/lib/utils'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import { chatIntentRequiresResolvedExercise } from '@/lib/ai/classroom/chat-intent-guards'
import { deriveActiveConceptId } from '@/lib/ai/classroom/selectors'
import { getConcept } from '@/lib/ai/concept-graph/loader'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

interface ClassroomIntentBarProps {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  disabled: boolean
  disabledReason?: IntentBarDisabledReason
  generationFailed?: boolean
}

type IntentBarDisabledReason = 'lesson_generation' | 'shared_quota'

interface QueuedIntentState {
  intent: ChatIntentKind
  requestId: number
}

interface IntentChoice {
  intent: ChatIntentKind
  label: string
  summary: string
  icon: React.ReactNode
  tone: 'neutral' | 'help'
}

// Intent options surfaced as one-tap buttons. We deliberately drop
// `change_topic` from the bar — switching topics mid-session is high friction
// and is better expressed as free-form chat ("I'd rather learn X next") than as
// an always-visible button.
function useIntentChoices(): IntentChoice[] {
  return useMemo(() => [
    {
      intent: 'advance',
      label: t`继续下一步`,
      summary: 'Learner is comfortable with the current content and wants to advance to the next teaching step.',
      icon: <ChevronsRight aria-hidden="true" className="size-4" />,
      tone: 'neutral',
    },
    {
      intent: 'go_deeper',
      label: t`再深入讲讲`,
      summary: 'Learner wants a deeper explanation or more advanced examples of the current topic before moving on.',
      icon: <Telescope aria-hidden="true" className="size-4" />,
      tone: 'neutral',
    },
    {
      intent: 'slow_down',
      label: t`讲慢一点`,
      summary: 'Learner wants the explanation slowed down with smaller steps and more elementary examples.',
      icon: <Turtle aria-hidden="true" className="size-4" />,
      tone: 'neutral',
    },
    {
      intent: 'explain_error',
      label: t`帮我看看错在哪`,
      summary: 'Learner needs help understanding their recent mistake or why their code does not behave as expected.',
      icon: <HelpCircle aria-hidden="true" className="size-4" />,
      tone: 'help',
    },
  ], [])
}

export function ClassroomIntentBar({ session, dispatch, disabled, disabledReason, generationFailed = false }: ClassroomIntentBarProps) {
  const choices = useIntentChoices()
  const config = useLLMConfig()
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const configReady = isLLMConfigReady(config)
  const [queuedIntentState, setQueuedIntentState] = useState<QueuedIntentState | null>(null)
  const observedPendingAfterQueuedIntentRef = useRef(false)
  const externalPending = disabled || session.eventQueue.length > 0
  const locallyQueued = queuedIntentState != null && (!observedPendingAfterQueuedIntentRef.current || externalPending)
  const effectiveDisabled = disabled || !configReady || locallyQueued
  const activeExerciseIntent = session.currentExercise?.status === 'active' ? session.currentExercise.intent : null
  const activeConceptId = useMemo(() => deriveActiveConceptId(session) ?? undefined, [session])
  const activeConceptTitle = useConceptTitle(activeConceptId, session.lang)
  const queuedChoice = locallyQueued
    ? choices.find(choice => choice.intent === queuedIntentState?.intent) ?? null
    : null
  const queuedChoiceLabel = queuedChoice?.label ?? ''
  const queuedStatusText = queuedChoice
    ? activeConceptTitle
      ? t`已收到：${queuedChoiceLabel}（${activeConceptTitle}）。正在准备下一步。`
      : t`已收到：${queuedChoiceLabel}。正在准备下一步。`
    : ''
  const externalStatusText = !queuedChoice && disabled && configReady && disabledReason === 'lesson_generation'
    ? lessonGenerationBlockedStatusText(session, generationFailed)
    : ''
  const sharedQuotaStatusText = !queuedChoice && disabled && configReady && disabledReason === 'shared_quota'
    ? sharedQuotaVisibleStatusText(autoQuota?.nextResetAt)
    : ''
  const configStatusText = !queuedChoice && !configReady
    ? aiServiceConfigVisibleStatusText()
    : ''
  const activeExerciseStatusText = !queuedChoice && !externalStatusText && activeExerciseIntent
    ? activeExerciseBlockedStatusText(activeExerciseIntent)
    : ''

  useEffect(() => {
    if (!queuedIntentState) {
      observedPendingAfterQueuedIntentRef.current = false
      return
    }
    if (externalPending)
      observedPendingAfterQueuedIntentRef.current = true
  }, [externalPending, queuedIntentState])

  const onClick = useCallback((choice: IntentChoice) => {
    // Clicking an intent without a runnable model config would only queue an event that
    // never runs. Take them straight to settings instead of leaving the
    // request silently stuck.
    if (!configReady || (disabled && disabledReason === 'shared_quota')) {
      openSettings(true)
      return
    }
    if (disabled)
      return
    if (locallyQueued)
      return
    observedPendingAfterQueuedIntentRef.current = false
    setQueuedIntentState(current => ({
      intent: choice.intent,
      requestId: (current?.requestId ?? 0) + 1,
    }))
    dispatch({
      type: 'EMIT_CHAT_INTENT',
      intent: choice.intent,
      summary: choice.summary,
      ...(activeConceptId ? { activeConceptId } : {}),
      now: Date.now(),
    })
  }, [activeConceptId, configReady, disabled, disabledReason, dispatch, locallyQueued, openSettings])

  // Hide on the truly-empty state — the welcome card owns onboarding then.
  if (session.stream.length === 0)
    return null

  return (
    <div
      data-testid="classroom-intent-bar"
      className={cn(
        'mx-auto mt-6 flex w-full max-w-3xl justify-center px-2 pb-3',
      )}
    >
      <div
        className={cn(
          'flex w-full min-w-0 max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-tour-border bg-tour-surface/95 px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur sm:w-auto sm:rounded-full',
        )}
        role="group"
        aria-label={t`告诉 AI 你的下一步`}
      >
        {choices.map(choice => (
          <IntentButton
            key={choice.intent}
            choice={choice}
            configReady={configReady}
            disabled={effectiveDisabled}
            disabledReason={disabledReason}
            quotaResetAt={autoQuota?.nextResetAt}
            activeExerciseIntent={activeExerciseIntent}
            onClick={onClick}
          />
        ))}
        {activeExerciseStatusText && (
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="classroom-intent-active-exercise-status"
            className="inline-flex max-w-[min(82vw,24rem)] shrink-0 items-center break-words whitespace-normal rounded-2xl border border-tour-border bg-tour-bg px-2.5 py-1 text-left text-[11px] font-medium leading-5 text-muted-foreground"
          >
            {activeExerciseStatusText}
          </span>
        )}
        {queuedChoice && (
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-busy="true"
            data-testid="classroom-intent-queued-status"
            className="inline-flex max-w-[min(82vw,24rem)] shrink-0 items-center gap-1.5 break-words whitespace-normal rounded-2xl border border-tour-border bg-tour-bg px-2.5 py-1 text-left text-[11px] font-medium leading-5 text-muted-foreground"
          >
            <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-tour-accent-fg" />
            <span className="min-w-0 break-words">{queuedStatusText}</span>
          </span>
        )}
        {externalStatusText && (
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-busy={generationFailed ? undefined : 'true'}
            data-testid="classroom-intent-external-status"
            className="inline-flex max-w-[min(82vw,28rem)] shrink-0 items-center gap-1.5 break-words whitespace-normal rounded-2xl border border-tour-border bg-tour-bg px-2.5 py-1 text-left text-[11px] font-medium leading-5 text-muted-foreground"
          >
            {!generationFailed && <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-tour-accent-fg" />}
            <span className="min-w-0 break-words">{externalStatusText}</span>
          </span>
        )}
        {sharedQuotaStatusText && (
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="classroom-intent-shared-quota-status"
            className="inline-flex max-w-[min(82vw,30rem)] shrink-0 items-center break-words whitespace-normal rounded-2xl border border-classroom-warning-border bg-classroom-warning-bg px-2.5 py-1 text-left text-[11px] font-medium leading-5 text-classroom-warning-fg"
          >
            {sharedQuotaStatusText}
          </span>
        )}
        {configStatusText && (
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="classroom-intent-config-status"
            className="inline-flex max-w-[min(82vw,30rem)] shrink-0 items-center gap-1.5 break-words whitespace-normal rounded-2xl border border-classroom-warning-border bg-classroom-warning-bg px-2.5 py-1 text-left text-[11px] font-medium leading-5 text-classroom-warning-fg"
          >
            <KeyRound aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 break-words">{configStatusText}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function useConceptTitle(conceptId: string | undefined, lang: string): string | null {
  return useMemo(() => {
    if (!conceptId)
      return null
    const concept = getConcept(conceptId)
    if (!concept)
      return null
    return lang === 'en' ? concept.title.en : concept.title.zh
  }, [conceptId, lang])
}

function activeExerciseBlockedStatusText(intent: ExerciseIntent): string {
  return intent === 'review_check'
    ? t`先提交或跳过当前复习检查，再继续下一步。运行只会看结果，不会记录进度。`
    : t`先提交或跳过当前练习，再继续下一步。运行只会看结果，不会记录进度。`
}

function lessonGenerationBlockedStatusText(session: ClassroomSession, generationFailed: boolean): string {
  const event = session.eventQueue[0]
  if (generationFailed)
    return lessonGenerationFailedStatusText(event)
  if (event?.type === 'exercise_failure') {
    return event.exerciseIntent === 'review_check'
      ? t`这次复习检查已记录，AI 正在准备针对性反馈；你可以先继续修改代码。`
      : t`这次提交已记录，AI 正在准备针对性提示；你可以先继续修改代码。`
  }
  if (event?.type === 'exercise_success')
    return event.exerciseIntent === 'review_check' ? t`复习检查已记录，AI 正在准备下一步。` : t`练习已记录，AI 正在准备下一步。`
  if (event?.type === 'exercise_skip')
    return event.exerciseIntent === 'review_check' ? t`已跳过复习检查，AI 正在整理下一步。` : t`已跳过练习，AI 正在准备更合适的下一步。`
  if (event?.type === 'chat_intent')
    return t`AI 正在处理上一条请求，请稍候。`
  return t`课堂正在准备下一步，请稍候。`
}

function lessonGenerationFailedStatusText(event: ClassroomSession['eventQueue'][number] | undefined): string {
  if (event?.type === 'exercise_failure') {
    return event.exerciseIntent === 'review_check'
      ? t`这次复习检查已记录，但 AI 反馈准备失败。请先重试这次任务；你可以继续修改代码。`
      : t`这次提交已记录，但 AI 提示准备失败。请先重试这次任务；你可以继续修改代码。`
  }
  if (event?.type === 'exercise_success')
    return event.exerciseIntent === 'review_check' ? t`复习检查已记录，但下一步准备失败。请先重试这次任务。` : t`练习已记录，但下一步准备失败。请先重试这次任务。`
  if (event?.type === 'exercise_skip')
    return event.exerciseIntent === 'review_check' ? t`已跳过复习检查，但下一步准备失败。请先重试这次任务。` : t`已跳过练习，但下一步准备失败。请先重试这次任务。`
  if (event?.type === 'chat_intent')
    return t`上一条 AI 请求准备失败。请先重试这次任务，或先复习已生成内容。`
  return t`课堂准备失败。请先重试，或检查 AI 设置。`
}

function IntentButton({
  choice,
  configReady,
  disabled,
  disabledReason,
  quotaResetAt,
  activeExerciseIntent,
  onClick,
}: {
  choice: IntentChoice
  configReady: boolean
  disabled: boolean
  disabledReason?: IntentBarDisabledReason
  quotaResetAt?: number
  activeExerciseIntent: ExerciseIntent | null
  onClick: (choice: IntentChoice) => void
}) {
  const descriptionId = useId()
  const blockedByExercise = chatIntentRequiresResolvedExercise(choice.intent) && activeExerciseIntent != null
  const blockedBySharedQuota = disabled && configReady && disabledReason === 'shared_quota'
  const blockedByClassroomState = disabled && configReady && !blockedBySharedQuota
  const title = !configReady
    ? t`需要先完成 AI 服务配置。点击会打开设置，不会排队新的 AI 请求。`
    : blockedByExercise
      ? activeExerciseIntent === 'review_check'
        ? t`先完成、跳过或提交当前复习检查后再继续`
        : t`先完成、跳过或提交当前练习后再继续`
      : blockedBySharedQuota
        ? intentSharedQuotaRecoveryTitle(quotaResetAt)
        : blockedByClassroomState
          ? intentDisabledTitle(disabledReason, quotaResetAt)
          : intentReadyTitle(choice.intent)

  return (
    <>
      <button
        type="button"
        disabled={blockedByClassroomState || blockedByExercise}
        aria-describedby={title ? descriptionId : undefined}
        data-testid={`classroom-intent-${choice.intent}`}
        title={title}
        onClick={() => onClick(choice)}
        className={cn(
          'inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
          'text-tour-text hover:bg-tour-bg disabled:cursor-not-allowed disabled:opacity-40',
          !configReady && 'opacity-70',
          choice.tone === 'help' && 'text-classroom-warning-fg hover:bg-classroom-warning-bg',
        )}
      >
        {choice.icon}
        <span className="min-w-0 break-words">{choice.label}</span>
      </button>
      {title && (
        <span id={descriptionId} className="sr-only">
          {title}
        </span>
      )}
    </>
  )
}

function intentDisabledTitle(reason: IntentBarDisabledReason | undefined, quotaResetAt?: number): string {
  if (reason === 'shared_quota') {
    if (quotaResetAt) {
      const resetMoment = formatResetMoment(quotaResetAt)
      return t`共享额度已用完。下次刷新：${resetMoment}；也可以改用自己的 API Key 后继续。`
    }
    return t`共享额度已用完。刷新后会恢复；也可以改用自己的 API Key 后继续。`
  }
  return t`课堂正在准备下一步，请稍候`
}

function intentReadyTitle(intent: ChatIntentKind): string {
  if (intent === 'advance') {
    return t`请求 AI 准备下一步课堂内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。`
  }
  if (intent === 'go_deeper') {
    return t`请求 AI 围绕当前内容深入讲解；会进入等待状态，不会提交代码、运行代码或清除学习记录。`
  }
  if (intent === 'slow_down') {
    return t`请求 AI 放慢节奏重新讲解当前内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。`
  }
  if (intent === 'explain_error') {
    return t`请求 AI 分析最近的错误或代码问题；会进入等待状态，不会提交代码、运行代码或清除学习记录。`
  }
  return t`请求 AI 处理这一步课堂内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。`
}

function intentSharedQuotaRecoveryTitle(quotaResetAt?: number): string {
  if (quotaResetAt) {
    const resetMoment = formatResetMoment(quotaResetAt)
    return t`共享额度已用完。下次刷新：${resetMoment}；点击会打开设置，改用自己的 API Key 后继续；不会排队新的 AI 请求。`
  }
  return t`共享额度已用完。刷新后会恢复；点击会打开设置，改用自己的 API Key 后继续；不会排队新的 AI 请求。`
}

function aiServiceConfigVisibleStatusText(): string {
  return t`AI 服务还没配置。点击任一 AI 操作会打开设置，不会排队新的请求。`
}

function sharedQuotaVisibleStatusText(quotaResetAt?: number): string {
  if (quotaResetAt) {
    const resetMoment = formatResetMoment(quotaResetAt)
    return t`共享额度已用完。下次刷新：${resetMoment}；点击操作会打开设置，改用自己的 API Key 后继续；不会排队新的 AI 请求。`
  }
  return t`共享额度已用完。点击操作会打开设置，改用自己的 API Key 后继续；不会排队新的 AI 请求。`
}
