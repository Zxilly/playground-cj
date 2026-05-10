'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { createClassroomChatToolkit } from '@/features/tour-ai/agent/tools'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import type { LLMConfigBootstrapState } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { TourAIChatRuntime } from '@/features/tour-ai/components/TourAIChatRuntime'
import { useLLMConfig } from '@/stores/llmConfig'

export function TourAIChat() {
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const bootstrap = useLLMConfigBootstrap()
  const toolkit = useMemo(() => createClassroomChatToolkit(bridge), [bridge])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-tour-border px-3 py-2 text-xs">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tour-accent-fg/15 text-tour-accent-fg">
          <Sparkles className="size-3" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold text-tour-text"><Trans>聊天</Trans></span>
          <span className="truncate text-[10px] text-muted-foreground"><Trans>用户只和这里聊天</Trans></span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {bootstrap.status === 'ready' && config.apiKey
          ? <TourAIChatRuntime toolkit={toolkit} lang={bridge.lang} />
          : <BootstrapStatus state={bootstrap} hasApiKey={Boolean(config.apiKey)} />}
      </div>
    </div>
  )
}

function BootstrapStatus({ state, hasApiKey }: { state: LLMConfigBootstrapState, hasApiKey: boolean }) {
  if (state.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground">
        <div className="space-y-1">
          <div className="font-medium text-classroom-warning-fg"><Trans>无法获取 AI 配额，请在设置里填入自带 Key。</Trans></div>
          <div className="font-mono text-[10px] opacity-70">{state.error}</div>
        </div>
      </div>
    )
  }
  if (state.status === 'ready' && !hasApiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground">
        <div className="font-medium text-tour-text"><Trans>请在设置里填入 AI 服务的 API Key 后开始聊天。</Trans></div>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3 animate-pulse text-tour-accent-fg" />
        <span><Trans>正在准备聊天</Trans></span>
      </div>
    </div>
  )
}
