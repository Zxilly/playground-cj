'use client'

import { useCallback, useMemo } from 'react'
import {
  AssistantRuntimeProvider,
  Suggestions,
  Tools,
  useAui,
} from '@assistant-ui/react'
import type { SuggestionConfig, Toolkit } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { createScopedChatTransport } from '@/lib/ai/classroom/scoped-chat-transport'
import { useClassroomAbortScope } from '@/features/tour-ai/context/classroom-abort-scope'
import type { InferAgentUIMessage } from 'ai'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createClassroomChat } from '@/lib/ai/classroom-chat'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import { buildTourAIChatSuggestions } from '@/features/tour-ai/agent/chat-suggestions'
import type { LocalSuggestion } from '@/features/tour-ai/agent/chat-suggestions'
import { useLLMConfig } from '@/stores/llmConfig'

// Adapter: assistant-ui's SuggestionConfig requires `label` (used as a tag chip we don't render).
// We pass empty string so the upstream type contract is satisfied without coupling our local model.
function adaptSuggestions(suggestions: LocalSuggestion[]): SuggestionConfig[] {
  return suggestions.map(s => ({ ...s, label: '' }))
}

type ClassroomChatMessage = InferAgentUIMessage<ReturnType<typeof createClassroomChat>>

export function TourAIChatRuntime({ toolkit, lang }: { toolkit: Toolkit, lang: string }) {
  const config = useLLMConfig()
  const scopeSignal = useClassroomAbortScope()
  const transport = useMemo(() => {
    const chat = createClassroomChat(config, toolkit)
    return createScopedChatTransport(chat, scopeSignal)
  }, [config, toolkit, scopeSignal])
  const suggestions = useMemo(() => buildTourAIChatSuggestions(lang), [lang])

  const runtime = useChatRuntime<ClassroomChatMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: useCallback(() => undefined, []),
  })

  const auiConfig = useMemo(
    () => ({
      tools: Tools({ toolkit }),
      suggestions: Suggestions(adaptSuggestions(suggestions)),
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
