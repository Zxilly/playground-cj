'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Code2, RotateCcw, Sparkles } from 'lucide-react'
import {
  AssistantRuntimeProvider,
  Suggestions,
  Tools,
  useAui,
} from '@assistant-ui/react'
import type { Toolkit } from '@assistant-ui/react'
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { UIMessage } from 'ai'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/components/thread'
import { useEditorBridge } from '@/components/tour/EditorBridgeContext'
import { useLLMConfig } from '@/contexts/LLMConfigContext'
import { createBuiltinToolkit, describeSectionPath, loadMcpToolkit } from '@/components/tour/ai/tools'
import { clearThread, loadThread, saveThread, sectionKey } from '@/lib/ai/persistence'

function buildSystemPrompt(sectionPath: string, lang: string): string {
  const langLabel = lang === 'en' ? 'English' : 'Simplified Chinese'
  return [
    `You are an interactive Cangjie programming tutor inside the playground "tour" application.`,
    `Current section: ${sectionPath}.`,
    `Always respond in ${langLabel}.`,
    `You have tools to read the current tutorial markdown, read/write the Monaco editor code, run code, and look up Cangjie reference docs through MCP tools (mcp_*).`,
    `Editing rules:`,
    `- Prefer edit_editor_code for small targeted changes; the oldString must include enough context to be unique.`,
    `- Use replace_editor_code only for full rewrites.`,
    `- After any code change, call run_code to confirm it compiles. If compilation fails, call get_diagnostics and fix issues.`,
    `Be concise; never invent Cangjie syntax — verify with mcp_* docs tools when uncertain.`,
  ].join('\n')
}

interface SuggestionDef {
  title: string
  label: string
  prompt: string
}

function buildSuggestions(lang: string): SuggestionDef[] {
  if (lang === 'en') {
    return [
      { title: 'Explain this section', label: 'in 3 bullets', prompt: 'Read the current tutorial and summarize the key idea in 3 bullets.' },
      { title: 'Refactor the example', label: 'idiomatic Cangjie', prompt: 'Read the editor code and rewrite it in a more idiomatic Cangjie style. Then run it.' },
      { title: 'Run and fix errors', label: 'auto-debug', prompt: 'Run the current code; if it fails, read diagnostics and fix the issues.' },
      { title: 'Walk through the code', label: 'line-by-line', prompt: 'Walk me through the example line-by-line, highlighting Cangjie-specific behavior.' },
    ]
  }
  return [
    { title: t`简要解释这一节`, label: t`3 条要点`, prompt: t`读取当前教程，用 3 条要点概括核心思想。` },
    { title: t`改写当前示例`, label: t`更地道的写法`, prompt: t`读取编辑器代码，用更地道的仓颉写法重写，然后运行验证。` },
    { title: t`运行并修复错误`, label: t`自动调试`, prompt: t`运行当前代码；若失败，读取诊断并修复。` },
    { title: t`逐行讲解`, label: t`仓颉特有行为`, prompt: t`逐行讲解当前编辑器中的代码，重点标注仓颉特有的行为。` },
  ]
}

interface InnerProps {
  initialMessages: UIMessage[]
  toolkit: Toolkit
  suggestions: SuggestionDef[]
  system: string
  baseURL: string
  apiKey: string
  model: string
  onMessagesChange: (messages: UIMessage[]) => void
}

function ChatInner({ initialMessages, toolkit, suggestions, system, baseURL, apiKey, model, onMessagesChange }: InnerProps) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: '/api/ai/chat',
        headers: () => ({
          'x-llm-base-url': baseURL,
          'x-llm-api-key': apiKey,
          'x-llm-model': model,
        }),
      }),
    [baseURL, apiKey, model],
  )

  // Stabilise onFinish across re-renders so useChatRuntime doesn't tear down
  // and rebuild the chat (which would clear the composer mid-keystroke).
  const onMessagesChangeRef = useRef(onMessagesChange)
  useEffect(() => {
    onMessagesChangeRef.current = onMessagesChange
  })
  const onFinish = useCallback(
    (event: { messages: UIMessage[] }) => onMessagesChangeRef.current(event.messages),
    [],
  )

  const runtime = useChatRuntime({
    transport,
    messages: initialMessages,
    system,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish,
  } as any)

  // Memoise the Tools/Suggestions resources. Calling them inline every render
  // hands `useAui` fresh references, which causes the assistant store (and
  // with it the composer state) to reset on every keystroke.
  const auiConfig = useMemo(
    () => ({
      tools: Tools({ toolkit }),
      suggestions: Suggestions(suggestions),
    }),
    [toolkit, suggestions],
  )
  const aui = useAui(auiConfig)

  return (
    <AssistantRuntimeProvider aui={aui as any} runtime={runtime as any}>
      <TooltipProvider delayDuration={250}>
        <Thread />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
}

export function TourAIChat() {
  const bridge = useEditorBridge()
  const { config } = useLLMConfig()

  const sk = sectionKey(bridge.lang, bridge.section.chapterId, bridge.section.subChapterId, bridge.section.sectionId)
  const sectionPath = describeSectionPath(bridge)
  const system = useMemo(() => buildSystemPrompt(sectionPath, bridge.lang), [sectionPath, bridge.lang])
  const suggestions = useMemo(() => buildSuggestions(bridge.lang), [bridge.lang])

  const builtinToolkit = useMemo(() => createBuiltinToolkit(bridge), [bridge])
  const [mcpToolkit, setMcpToolkit] = useState<Toolkit>({})
  const [resetCounter, setResetCounter] = useState(0)

  useEffect(() => {
    let cancelled = false
    void loadMcpToolkit().then((tk) => {
      if (!cancelled)
        setMcpToolkit(tk)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const initialMessages = useMemo(
    () => loadThread(sk),
    // eslint-disable-next-line react/exhaustive-deps
    [sk, resetCounter],
  )

  const toolkit = useMemo<Toolkit>(() => ({ ...builtinToolkit, ...mcpToolkit }), [builtinToolkit, mcpToolkit])

  const handleMessagesChange = useCallback((messages: UIMessage[]) => {
    saveThread(sk, messages)
  }, [sk])

  const handleClear = useCallback(() => {
    clearThread(sk)
    setResetCounter(c => c + 1)
  }, [sk])

  const mcpCount = Object.keys(mcpToolkit).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-tour-border/60 bg-gradient-to-r from-tour-bg/60 to-tour-bg/20 px-3 py-2 text-xs">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tour-teal/15 text-tour-teal">
          <Sparkles className="size-3" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-semibold text-foreground/90 truncate">
            <Trans>AI 助教</Trans>
          </span>
          <span className="text-[10px] text-muted-foreground truncate">{sectionPath}</span>
        </div>
        {mcpCount > 0 && (
          <span
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-tour-border/60 bg-tour-bg/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            title={t`已连接 MCP 工具`}
          >
            <Code2 className="size-2.5 text-tour-teal" />
            {`MCP · ${mcpCount}`}
          </span>
        )}
        <button
          onClick={handleClear}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tour-teal/40"
          aria-label={t`清空对话`}
          title={t`清空对话`}
        >
          <RotateCcw className="size-3" />
          <span className="hidden sm:inline"><Trans>清空</Trans></span>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ChatInner
          key={`${sk}:${resetCounter}`}
          initialMessages={initialMessages}
          toolkit={toolkit}
          suggestions={suggestions}
          system={system}
          baseURL={config.baseURL}
          apiKey={config.apiKey}
          model={config.model}
          onMessagesChange={handleMessagesChange}
        />
      </div>
    </div>
  )
}
