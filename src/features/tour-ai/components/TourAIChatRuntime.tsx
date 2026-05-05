'use client'

import { useCallback, useMemo } from 'react'
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
import { createChatAgent } from '@/lib/ai/chat-agent'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import { buildTourAIChatSuggestions } from '@/features/tour-ai/agent/chat-suggestions'
import { useLLMConfig } from '@/stores/llmConfig'

type AgentUIMessage = InferAgentUIMessage<ReturnType<typeof createChatAgent>>

export function TourAIChatRuntime({ toolkit, lang }: { toolkit: Toolkit, lang: string }) {
  const config = useLLMConfig()
  const suggestions = useMemo(() => buildTourAIChatSuggestions(lang), [lang])
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
