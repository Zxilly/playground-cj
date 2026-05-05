'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { createChatAgentToolkit } from '@/features/tour-ai/agent/tools'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import type { LLMConfigBootstrapState } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { TourAIChatRuntime } from '@/features/tour-ai/components/TourAIChatRuntime'
import { useLLMConfig } from '@/stores/llmConfig'

export function TourAIChat() {
  const bridge = useAIClassroomBridge()
  const config = useLLMConfig()
  const bootstrap = useLLMConfigBootstrap()
  const toolkit = useMemo(() => createChatAgentToolkit(bridge), [bridge])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[#E8E2D5] px-3 py-2 text-xs">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0F8C6E]/15 text-[#0F8C6E]">
          <Sparkles className="size-3" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold text-[#1F1B16]">ChatAgent</span>
          <span className="truncate text-[10px] text-[#8A8174]">用户只和这里聊天</span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {bootstrap.status === 'ready' && config.apiKey
          ? <TourAIChatRuntime toolkit={toolkit} lang={bridge.lang} />
          : <BootstrapStatus state={bootstrap} />}
      </div>
    </div>
  )
}

function BootstrapStatus({ state }: { state: LLMConfigBootstrapState }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-[#8A8174]">
      {state.status === 'error'
        ? (
            <div className="space-y-1">
              <div className="font-medium text-[#B47A12]">无法获取 AI 配额，请在设置里填入自带 Key。</div>
              <div className="font-mono text-[10px] opacity-70">{state.error}</div>
            </div>
          )
        : (
            <div className="flex items-center gap-2">
              <Sparkles className="size-3 animate-pulse text-[#0F8C6E]" />
              <span>正在准备 ChatAgent</span>
            </div>
          )}
    </div>
  )
}
