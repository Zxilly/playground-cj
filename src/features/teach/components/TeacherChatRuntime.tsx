'use client'

import { useEffect, useMemo, useRef } from 'react'
import { AssistantRuntimeProvider, useAuiState, useComposerRuntime } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import type { InferAgentUIMessage } from 'ai'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import { createTeacherToolkit } from '@/lib/teach/teacher/toolkit'
import { createTourSource } from '@/lib/teach/knowledge/tour-source'
import { createTeacherAgent } from '@/lib/teach/teacher/agent'
import type { TeacherAgent } from '@/lib/teach/teacher/agent'
import type { TeacherLang } from '@/lib/teach/teacher/system-prompt'
import { createScopedChatTransport } from '@/lib/teach/teacher/scoped-chat-transport'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { probeExhaustedQuota } from '@/modules/llm-config/runtime/auto-quota'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useAbortScope } from '@/features/teach/context/abort-scope'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { defaultRunner } from '@/lib/teach/feedback/run-cangjie'

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
 * wrapping here. The agent runs as an AI SDK `ToolLoopAgent`, which loops
 * (model → tool → model → … → answer) internally inside a single `sendMessages`,
 * so the runtime needs no `sendAutomaticallyWhen` continuation — one turn is one
 * request.
 *
 * Every turn streams through a {@link createScopedChatTransport scoped transport}
 * bound to the workspace abort scope, so an in-flight request is cancelled when
 * the workspace unmounts — and the composer's stop button aborts the current turn
 * (the scope signal is merged with the per-request abort signal). Tool calls and
 * reasoning render under a collapsible "思考过程" disclosure in the thread.
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
    const teacherLang = normalizeLang(lang)
    // `repo` from context is already an observable repository (wrapped in
    // WorkspaceProvider), so a teacher tool write bumps the workspace revision
    // and refreshes the central views without a reload.
    const toolkit = createTeacherToolkit({
      repo,
      knowledge,
      // The curated tour content (preferred grounding) reaches the browser teacher
      // through the same-origin /api/teach/tour route; the source degrades to an
      // empty outline / null step when the route is unavailable.
      tour: createTourSource(),
      runner: runner ?? defaultRunner,
      retrievalStore,
      // The active-editor registry resolves whichever code_task the learner is
      // currently working in, so set_editor_code / read_editor_code drive the
      // learner's live editor.
      editor: activeEditor,
      lang: teacherLang,
      now,
    })
    const agent = createTeacherAgent(config, toolkit, teacherLang)
    return createScopedChatTransport<TeacherChatMessage>(agent, scopeSignal)
  }, [config, repo, knowledge, runner, retrievalStore, activeEditor, now, lang, scopeSignal])

  // No `sendAutomaticallyWhen`: the teacher is a ToolLoopAgent whose whole
  // tool loop (model → tool → model → … → answer) runs inside one
  // `sendMessages` via the DirectChatTransport. Adding the runtime-driven
  // continuation (meant for client-side tool execution) would auto-fire another
  // turn after every tool-using turn — wasting tokens and making the agent feel
  // unstoppable (the stop button flickers as turns auto-chain). One turn = one
  // abortable request.
  const runtime = useChatRuntime<TeacherChatMessage>({ transport })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerPrefillBridge />
      <AutoQuotaWatcher />
      <TooltipProvider delayDuration={250}>
        <Thread allowAttachments={false} />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
}

/**
 * Watches for the shared quota running out mid-session. The bootstrap only
 * probes the quota while no key is set, so once the shared key is applied the
 * exhausted flag goes stale; here we re-probe usage each time a teacher turn
 * finishes (running → idle) and flip `autoQuota.exhausted`, which surfaces the
 * {@link QuotaExhaustedDialog} mounted alongside the workspace. Only runs on the
 * shared key and stops once exhaustion is recorded.
 *
 * Renders nothing — it must live *inside* {@link AssistantRuntimeProvider} so
 * {@link useAuiState} resolves the thread's run state.
 */
function AutoQuotaWatcher() {
  const isRunning = useAuiState(s => s.thread.isRunning)
  const wasRunningRef = useRef(false)
  const keySource = useLLMConfigStore(s => s.keySource)
  const apiKey = useLLMConfig().apiKey
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const setAutoQuota = useLLMConfigStore(s => s.setAutoQuota)

  useEffect(() => {
    const justFinished = wasRunningRef.current && !isRunning
    wasRunningRef.current = isRunning
    if (!justFinished || keySource !== 'auto' || !apiKey || autoQuota?.exhausted)
      return
    let cancelled = false
    void probeExhaustedQuota(apiKey, autoQuota, Date.now()).then((next) => {
      if (!cancelled && next)
        setAutoQuota(next)
    })
    return () => {
      cancelled = true
    }
  }, [isRunning, keySource, apiKey, autoQuota, setAutoQuota])

  return null
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
