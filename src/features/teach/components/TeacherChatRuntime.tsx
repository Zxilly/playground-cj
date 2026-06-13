'use client'

import { useEffect, useMemo } from 'react'
import { AssistantRuntimeProvider, useComposerRuntime } from '@assistant-ui/react'
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
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useAbortScope } from '@/features/teach/context/abort-scope'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
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
 * (repository, knowledge source, runner, retrieval store, active-editor bridge,
 * clock), so a teacher tool call reads/writes the very same documents the central
 * views render — and `read_editor_code` / `set_editor_code` target whichever
 * code_task the learner is currently working in. The repository in context is already an observable repository
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
  // Keep the shared key / quota fresh after entering the workspace: re-fetch an
  // automatic key if one is dropped and reset the shared config once an exhausted
  // quota window elapses. Errors are silent here — the landing gate already
  // surfaced config problems, and a transient refresh failure should not blank
  // the chat surface.
  useLLMConfigBootstrap({ reportErrors: false })
  const config = useLLMConfig()
  const { repo, knowledge, runner, retrievalStore, activeEditor, now } = useWorkspace()
  const scopeSignal = useAbortScope()

  const transport = useMemo(() => {
    // `repo` from context is already an observable repository (wrapped in
    // WorkspaceProvider), so a teacher tool write bumps the workspace revision
    // and refreshes the central views without a reload.
    const toolkit = createTeacherToolkit({
      repo,
      knowledge,
      runner: runner ?? { run: runCangjieCode },
      retrievalStore,
      // The active-editor registry resolves whichever code_task the learner is
      // currently working in, so set_editor_code / read_editor_code drive the
      // learner's live editor.
      editor: activeEditor,
      now,
    })
    const agent = createTeacherAgent(config, toolkit, normalizeLang(lang))
    return createScopedChatTransport<TeacherChatMessage>(agent, scopeSignal)
  }, [config, repo, knowledge, runner, retrievalStore, activeEditor, now, lang, scopeSignal])

  const runtime = useChatRuntime<TeacherChatMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerPrefillBridge />
      <TooltipProvider delayDuration={250}>
        <Thread allowAttachments={false} />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
}

/**
 * Bridges the workspace store's `pendingPrefill` signal into the assistant-ui
 * composer. When a navigation block ("和老师聊聊" on the mission-first gate, or
 * "问老师" on a `followup_prompt` block) queues a prompt, this seeds it into the
 * composer input (so the learner can review/edit before sending) and consumes
 * the signal so it fires exactly once.
 *
 * Renders nothing — it must live *inside* {@link AssistantRuntimeProvider} so
 * {@link useComposerRuntime} resolves the thread composer.
 */
function ComposerPrefillBridge() {
  const composer = useComposerRuntime()
  const pendingPrefill = useWorkspaceStore(s => s.pendingPrefill)
  const consumePrefill = useWorkspaceStore(s => s.consumePrefill)

  useEffect(() => {
    if (pendingPrefill === null)
      return
    const prompt = consumePrefill()
    if (prompt !== null)
      composer.setText(prompt)
  }, [pendingPrefill, consumePrefill, composer])

  return null
}
