'use client'

import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ArrowRightLeft, Code2, Settings2, Sparkles } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { createClassroomChatToolkit } from '@/features/tour-ai/agent/tools'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import type { LLMConfigBootstrapState } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { TourAIChatRuntime } from '@/features/tour-ai/components/TourAIChatRuntime'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import { getConcept } from '@/lib/ai/concept-graph/loader'

export function TourAIChat({
  activeConceptId,
  onUseCurrentExerciseContext,
}: {
  activeConceptId?: string
  onUseCurrentExerciseContext?: (conceptId: string) => void
}) {
  const titleId = useId()
  const scopeId = useId()
  const progressBoundaryId = useId()
  const activeExerciseContextId = useId()
  const contextMismatchId = useId()
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const keySource = useLLMConfigStore(s => s.keySource)
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const bootstrap = useLLMConfigBootstrap()
  const toolkit = useMemo(() => createClassroomChatToolkit(bridge, { activeConceptId }), [bridge, activeConceptId])
  const activeConceptTitle = useConceptTitle(activeConceptId, bridge.lang)
  const scopeLabel = activeConceptTitle
    ? t`围绕 ${activeConceptTitle} 提问`
    : activeConceptId ? t`围绕当前概念提问` : t`围绕当前课堂提问`
  const activeExercise = bridge.classroom?.getSession().currentExercise
  const activeExerciseConceptId = activeExercise?.status === 'active' ? activeExercise.conceptIds[0] : undefined
  const activeExerciseConceptTitle = useConceptTitle(activeExerciseConceptId, bridge.lang)
  const activeExerciseContext = activeExercise?.status === 'active'
    ? {
        label: activeExercise.intent === 'review_check' ? t`当前复习检查` : t`当前练习`,
        prompt: compactExercisePrompt(activeExercise.prompt),
      }
    : null
  const contextMismatch = activeExerciseContext
    && activeConceptId
    && activeExerciseConceptId
    && activeConceptId !== activeExerciseConceptId
    ? {
        scopedTitle: activeConceptTitle ?? t`当前概念`,
        exerciseTitle: activeExerciseConceptTitle ?? t`当前练习概念`,
        exerciseConceptId: activeExerciseConceptId,
      }
    : null
  const contextMismatchExerciseTitle = contextMismatch?.exerciseTitle ?? ''
  const contextMismatchScopedTitle = contextMismatch?.scopedTitle ?? ''
  const contextMismatchExerciseConceptId = contextMismatch?.exerciseConceptId ?? ''
  const contextSwitchDescription = contextMismatch
    ? t`将聊天范围切换到 ${contextMismatchExerciseTitle}；不会修改当前代码、提交练习或改变已记录进度。`
    : ''
  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const configReady = isLLMConfigReady(config)
  const describedBy = [
    scopeId,
    progressBoundaryId,
    activeExerciseContext ? activeExerciseContextId : null,
    contextMismatch ? contextMismatchId : null,
  ].filter((id): id is string => Boolean(id)).join(' ')

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex items-center gap-2 border-b border-tour-border px-3 py-2 text-xs">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tour-accent-fg/15 text-tour-accent-fg">
          <Sparkles aria-hidden="true" className="size-3" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span id={titleId} className="truncate font-semibold text-tour-text"><Trans>聊天</Trans></span>
          <span id={scopeId} title={scopeLabel} className="line-clamp-2 break-words text-[10px] text-muted-foreground">{scopeLabel}</span>
          <span id={progressBoundaryId} className="sr-only">
            <Trans>聊天回答不会直接改变学习进度；只有保存复习说明、排队课堂动作或运行提交练习后，课堂才会记录进度。</Trans>
          </span>
        </div>
      </div>
      {activeExerciseContext && (
        <div
          id={activeExerciseContextId}
          data-testid="chat-active-exercise-context"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2 border-b border-tour-border bg-tour-bg px-3 py-2 text-[11px] leading-5 text-muted-foreground"
        >
          <Code2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-tour-accent-fg" />
          <div className="min-w-0">
            <div className="font-medium text-tour-text">{activeExerciseContext.label}</div>
            <div className="line-clamp-2 break-words">{activeExerciseContext.prompt}</div>
            <div className="text-[10px] leading-4 opacity-80"><Trans>会结合当前编辑器代码回答；聊天本身不会记录练习进度。</Trans></div>
          </div>
        </div>
      )}
      {contextMismatch && (
        <div
          data-testid="chat-context-mismatch"
          className="border-b border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-[11px] leading-5 text-classroom-warning-fg"
        >
          <div id={contextMismatchId} role="status" aria-live="polite" aria-atomic="true">
            {t`聊天仍围绕 ${contextMismatchScopedTitle}；当前练习属于 ${contextMismatchExerciseTitle}。`}
          </div>
          {onUseCurrentExerciseContext && (
            <button
              type="button"
              aria-describedby={contextMismatchId}
              title={contextSwitchDescription}
              onClick={() => onUseCurrentExerciseContext(contextMismatchExerciseConceptId)}
              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-2 py-1 text-[11px] font-semibold leading-4 text-tour-heading hover:bg-tour-bg"
            >
              <ArrowRightLeft aria-hidden="true" className="size-3.5 shrink-0" />
              <Trans>改为当前练习</Trans>
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {bootstrap.status === 'ready' && configReady && !sharedQuotaExhausted
          ? (
              <div className="h-full">
                <TourAIChatRuntime toolkit={toolkit} lang={bridge.lang} />
              </div>
            )
          : (
              <div className="h-full">
                <BootstrapStatus
                  state={bootstrap}
                  configReady={configReady}
                  sharedQuotaExhausted={sharedQuotaExhausted}
                  quotaResetAt={autoQuota?.nextResetAt}
                />
              </div>
            )}
      </div>
    </section>
  )
}

function useConceptTitle(conceptId: string | undefined, lang: string) {
  return useMemo(() => {
    if (!conceptId)
      return null
    const concept = getConcept(conceptId)
    if (!concept)
      return null
    return lang === 'en' ? concept.title.en : concept.title.zh
  }, [conceptId, lang])
}

function compactExercisePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, ' ').trim()
}

function BootstrapStatus({
  state,
  configReady,
  sharedQuotaExhausted,
  quotaResetAt,
}: {
  state: LLMConfigBootstrapState
  configReady: boolean
  sharedQuotaExhausted: boolean
  quotaResetAt?: number
}) {
  const openSettings = useLLMConfigStore(s => s.setSettingsDialogOpen)
  const titleId = useId()
  const detailId = useId()

  if (sharedQuotaExhausted) {
    const resetMoment = quotaResetAt ? formatResetMoment(quotaResetAt) : ''
    return (
      <div
        role="region"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground"
      >
        <div
          role="alert"
          aria-labelledby={titleId}
          aria-describedby={detailId}
          className="space-y-1"
        >
          <div id={titleId} className="font-medium text-classroom-warning-fg"><Trans>共享额度已用完，暂时无法开始新的 AI 聊天。</Trans></div>
          <div id={detailId} className="text-[10px] leading-5 opacity-70">
            {resetMoment
              ? (
                  <Trans>
                    下次刷新：
                    {resetMoment}
                    。使用自己的 API Key 可立刻继续。
                  </Trans>
                )
              : <Trans>使用自己的 API Key 可立刻继续。</Trans>}
          </div>
        </div>
        <ChatSettingsButton
          describedBy={detailId}
          label={<Trans>使用自己的 API Key</Trans>}
          onClick={() => openSettings(true)}
        />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div
        role="region"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground"
      >
        <div
          role="alert"
          aria-labelledby={titleId}
          aria-describedby={detailId}
          className="space-y-1"
        >
          <div id={titleId} className="font-medium text-classroom-warning-fg"><Trans>无法获取 AI 配额，请在设置里填写自己的 API Key。</Trans></div>
          <div id={detailId} className="text-[10px] leading-5 opacity-70">
            <Trans>打开 AI 服务设置，填写自己的 API Key 后可继续聊天；如果只是网络异常，也可以稍后重试。</Trans>
          </div>
        </div>
        <ChatSettingsButton
          describedBy={detailId}
          label={<Trans>使用自己的 API Key</Trans>}
          onClick={() => openSettings(true)}
        />
      </div>
    )
  }
  if (state.status === 'ready' && !configReady) {
    return (
      <div
        role="region"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground"
      >
        <div
          role="alert"
          aria-labelledby={titleId}
          aria-describedby={detailId}
        >
          <div id={titleId} className="font-medium text-tour-text"><Trans>请先完成 AI 服务配置后开始聊天。</Trans></div>
          <div id={detailId} className="mt-1 text-[10px] opacity-70"><Trans>需要服务地址、API Key 和模型。</Trans></div>
        </div>
        <ChatSettingsButton describedBy={detailId} onClick={() => openSettings(true)} />
      </div>
    )
  }
  return (
    <div
      role="status"
      aria-labelledby={titleId}
      aria-describedby={detailId}
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-flex text-tour-accent-fg">
          <Sparkles aria-hidden="true" className="size-3" />
        </span>
        <span id={titleId}><Trans>正在准备聊天</Trans></span>
      </div>
      <span id={detailId} className="sr-only">
        <Trans>准备完成后会显示课堂聊天输入框。</Trans>
      </span>
    </div>
  )
}

function ChatSettingsButton({
  describedBy,
  label = <Trans>配置 AI 服务</Trans>,
  title,
  onClick,
}: {
  describedBy: string
  label?: ReactNode
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-describedby={describedBy}
      title={title ?? t`打开 AI 服务设置；不会发送聊天消息、排队 AI 请求或改变学习进度。`}
      onClick={onClick}
      className="mt-4 inline-flex max-w-full items-center justify-center gap-1.5 rounded-md border border-tour-border bg-tour-surface px-3 py-1.5 text-left text-xs font-semibold text-tour-text hover:bg-tour-bg"
    >
      <Settings2 aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </button>
  )
}
