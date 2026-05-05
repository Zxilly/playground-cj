'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  AssistantRuntimeProvider,
  Suggestions,
  Tools,
  useAui,
} from '@assistant-ui/react'
import type { Toolkit } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { DirectChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { InferAgentUIMessage } from 'ai'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/components/thread'
import { useAIBridge } from '@/components/tour/EditorBridgeContext'
import { createChatAgentToolkit } from '@/components/tour/ai/tools'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { createChatAgent } from '@/lib/ai/chat-agent'

type AgentUIMessage = InferAgentUIMessage<ReturnType<typeof createChatAgent>>

interface BootstrapState {
  status: 'loading' | 'ready' | 'error'
  error?: string
}

function buildSuggestions(lang: string) {
  if (lang === 'en') {
    return [
      { title: 'Explain the quiz', label: 'quiz', prompt: 'Explain what the current quiz is asking without solving it completely.' },
      { title: 'Read my code', label: 'code', prompt: 'Look at my editor code and explain the likely issue.' },
      { title: 'Go deeper', label: 'intent', prompt: 'I want a deeper explanation of this concept.' },
    ]
  }
  return [
    { title: '解释题目', label: 'quiz', prompt: '解释一下当前 quiz 想考什么，不要直接给完整答案。' },
    { title: '看看代码', label: 'code', prompt: '读一下我编辑器里的代码，说明可能的问题。' },
    { title: '讲深一点', label: 'intent', prompt: '我想把这个概念讲得更深入一些。' },
  ]
}

function useAIKeyBootstrap(): BootstrapState {
  const apiKey = useLLMConfig().apiKey
  const keySource = useLLMConfigStore(s => s.keySource)
  const applyAutoKey = useLLMConfigStore(s => s.applyAutoKey)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (apiKey || keySource !== 'auto')
      return
    let cancelled = false
    fetch('/api/ai-key', { method: 'GET' })
      .then(async (resp) => {
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}`)
        return resp.json() as Promise<{ baseURL: string, apiKey: string, model: string }>
      })
      .then((data) => {
        if (!cancelled)
          applyAutoKey(data)
      })
      .catch((e: Error) => {
        if (!cancelled)
          setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [apiKey, keySource, applyAutoKey])

  if (apiKey)
    return { status: 'ready' }
  if (error)
    return { status: 'error', error }
  return { status: 'loading' }
}

function ChatInner({ toolkit, lang }: { toolkit: Toolkit, lang: string }) {
  const config = useLLMConfig()
  const suggestions = useMemo(() => buildSuggestions(lang), [lang])
  const transport = useMemo(() => {
    const agent = createChatAgent(config, toolkit)
    return new DirectChatTransport({ agent })
  }, [config, toolkit])

  const runtime = useChatRuntime<AgentUIMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: useCallback(() => undefined, []),
  })

  const auiConfig = useMemo(
    () => ({
      tools: Tools({ toolkit }),
      suggestions: Suggestions(suggestions),
    }),
    [toolkit, suggestions],
  )
  const aui = useAui(auiConfig)

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      <TooltipProvider delayDuration={250}>
        <Thread />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
}

export function TourAIChat() {
  const bridge = useAIBridge()
  const config = useLLMConfig()
  const bootstrap = useAIKeyBootstrap()
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
          ? <ChatInner toolkit={toolkit} lang={bridge.lang} />
          : <BootstrapStatus state={bootstrap} />}
      </div>
    </div>
  )
}

function BootstrapStatus({ state }: { state: BootstrapState }) {
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
