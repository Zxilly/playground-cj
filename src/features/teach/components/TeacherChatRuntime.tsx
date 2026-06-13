'use client'

import { useMemo } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { InferAgentUIMessage } from 'ai'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import { createTeacherToolkit } from '@/lib/teach/teacher/toolkit'
import { createTeacherAgent } from '@/lib/teach/teacher/agent'
import type { TeacherAgent } from '@/lib/teach/teacher/agent'
import type { TeacherLang } from '@/lib/teach/teacher/system-prompt'
import { createScopedChatTransport } from '@/lib/teach/teacher/scoped-chat-transport'
import { useLLMConfig } from '@/stores/llmConfig'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useAbortScope } from '@/features/teach/context/abort-scope'
import { runCangjieCode } from '@/lib/teach/feedback/run-cangjie'

type TeacherChatMessage = InferAgentUIMessage<TeacherAgent>

export interface TeacherChatRuntimeProps {
  /** UI language for the teacher system prompt and lesson authoring. */
  lang: string
}

function normalizeLang(lang: string): TeacherLang {
  return lang === 'en' ? 'en' : 'zh'
}

/**
 * The teacher chat surface: a single browser-side {@link TeacherAgent} bound to
 * the vendored assistant-ui {@link Thread}.
 *
 * The agent's tool set is built from the workspace collaborators in context
 * (repository, knowledge source, editor bridge, runner, retrieval store, clock),
 * so a teacher tool call reads/writes the very same documents the central views
 * render. The repository in context is already an observable repository
 * (wrapped once in {@link WorkspaceProvider}), so a teacher tool write bumps the
 * workspace revision and refreshes the central views without a reload — no extra
 * wrapping here. The agent runs as an AI SDK `ToolLoopAgent`; `useChatRuntime`
 * continues the loop after each complete tool-call turn
 * ({@link lastAssistantMessageIsCompleteWithToolCalls}).
 *
 * Every turn streams through a {@link createScopedChatTransport scoped transport}
 * bound to the workspace abort scope, so an in-flight request is cancelled when
 * the workspace unmounts. Tool calls themselves are hidden by the vendored Thread
 * (their effects show up in the central viewport, not as raw chat noise).
 */
export function TeacherChatRuntime({ lang }: TeacherChatRuntimeProps) {
  const config = useLLMConfig()
  const { repo, knowledge, editor, runner, retrievalStore, now } = useWorkspace()
  const scopeSignal = useAbortScope()

  const transport = useMemo(() => {
    // `repo` from context is already an observable repository (wrapped in
    // WorkspaceProvider), so a teacher tool write bumps the workspace revision
    // and refreshes the central views without a reload.
    const toolkit = createTeacherToolkit({
      repo,
      knowledge,
      editor,
      runner: runner ?? { run: runCangjieCode },
      retrievalStore,
      now,
    })
    const agent = createTeacherAgent(config, toolkit, normalizeLang(lang))
    return createScopedChatTransport<TeacherChatMessage>(agent, scopeSignal)
  }, [config, repo, knowledge, editor, runner, retrievalStore, now, lang, scopeSignal])

  const runtime = useChatRuntime<TeacherChatMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider delayDuration={250}>
        <Thread allowAttachments={false} />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
}
