'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Code2, ListChecks, RotateCcw, Sparkles } from 'lucide-react'
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
import { useAIBridge } from '@/components/tour/EditorBridgeContext'
import { useLLMConfig } from '@/contexts/LLMConfigContext'
import { createBuiltinToolkit, loadMcpToolkit } from '@/components/tour/ai/tools'
import { ProgressPanel } from '@/components/tour/ai/ProgressPanel'
import { QuizBanner } from '@/components/tour/ai/QuizBanner'
import { clearThread, globalThreadKey, loadThread, saveThread } from '@/lib/ai/persistence'
import { clearLearner } from '@/lib/ai/learner-model'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

interface SuggestionDef {
  title: string
  label: string
  prompt: string
}

function buildSuggestions(lang: string): SuggestionDef[] {
  if (lang === 'en') {
    return [
      { title: 'Continue the lesson', label: 'next step', prompt: 'Continue from where we left off — pick the next concept and show me a runnable example.' },
      { title: 'Switch topics', label: 'something new', prompt: 'I want to learn something different. Pick another Cangjie topic and teach it.' },
      { title: 'Give me a quiz', label: 'oj-style', prompt: 'Set up a small OJ-style quiz with expected output for the concept we just covered. Add a stub I should complete in the editor.' },
      { title: 'Make it harder', label: 'level up', prompt: 'Make the current example more advanced — show me a more idiomatic or challenging variation.' },
    ]
  }
  return [
    { title: t`继续教学`, label: t`下一步`, prompt: t`继续上次的进度——挑选下一个知识点并给出一个可运行的示例。` },
    { title: t`换个主题`, label: t`新内容`, prompt: t`我想换个主题学习。挑一个其他的仓颉概念来讲讲。` },
    { title: t`出一道小测`, label: t`OJ 模式`, prompt: t`基于刚讲的概念设置一个带期望输出的小测验，并在编辑器里留一个待完成的骨架代码。` },
    { title: t`加点难度`, label: t`进阶`, prompt: t`把当前例子改得更进阶——给我一个更地道或更有挑战的版本。` },
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
  const bridge = useAIBridge()
  const { config } = useLLMConfig()

  const sk = globalThreadKey(bridge.lang)
  const system = useMemo(() => buildSystemPrompt(bridge.lang), [bridge.lang])
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

  const handleClearAll = useCallback(() => {
    clearThread(sk)
    clearLearner()
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
          <span className="text-[10px] text-muted-foreground truncate">
            <Trans>自主教学模式</Trans>
          </span>
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
        <ProgressPanel
          onClearAll={handleClearAll}
          trigger={(
            <button
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tour-teal/40"
              aria-label={t`查看学习进度`}
              title={t`查看学习进度`}
            >
              <ListChecks className="size-3" />
              <span className="hidden sm:inline"><Trans>进度</Trans></span>
            </button>
          )}
        />
        <button
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tour-teal/40"
          aria-label={t`清空对话与进度`}
          title={t`清空对话与进度`}
        >
          <RotateCcw className="size-3" />
          <span className="hidden sm:inline"><Trans>清空</Trans></span>
        </button>
      </div>
      <QuizBanner />
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
