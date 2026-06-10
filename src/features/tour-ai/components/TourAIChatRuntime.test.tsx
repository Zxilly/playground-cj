import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Toolkit } from '@assistant-ui/react'
import { TourAIChatRuntime } from './TourAIChatRuntime'

const runtimeMocks = vi.hoisted(() => ({
  buildTourAIChatSuggestions: vi.fn(() => []),
  createClassroomChat: vi.fn(() => ({ chat: true })),
  createScopedChatTransport: vi.fn(() => ({ transport: true })),
  useChatRuntime: vi.fn(() => ({ runtime: true })),
  useAui: vi.fn(() => ({ aui: true })),
  useClassroomAbortScope: vi.fn(() => ({ aborted: false })),
  useLLMConfig: vi.fn(() => ({ apiKey: 'test-key', model: 'test-model' })),
  tools: vi.fn(() => ({ tools: true })),
  suggestions: vi.fn(() => ({ suggestions: true })),
  sendAutomaticallyWhen: vi.fn(() => false),
}))

function MockAssistantRuntimeProvider({ children }: { children?: ReactNode }) {
  return <div data-testid="assistant-runtime-provider">{children}</div>
}

function MockTooltipProvider({ children }: { children?: ReactNode, delayDuration?: number }) {
  return <div data-testid="tooltip-provider">{children}</div>
}

function MockThread({ allowAttachments }: { allowAttachments?: boolean }) {
  return <div data-testid="thread" data-allow-attachments={String(allowAttachments)} />
}

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: MockAssistantRuntimeProvider,
  Suggestions: runtimeMocks.suggestions,
  Tools: runtimeMocks.tools,
  useAui: runtimeMocks.useAui,
}))

vi.mock('@assistant-ui/react-ai-sdk', () => ({
  useChatRuntime: runtimeMocks.useChatRuntime,
}))

vi.mock('ai', () => ({
  lastAssistantMessageIsCompleteWithToolCalls: runtimeMocks.sendAutomaticallyWhen,
}))

vi.mock('@/lib/ai/classroom/scoped-chat-transport', () => ({
  createScopedChatTransport: runtimeMocks.createScopedChatTransport,
}))

vi.mock('@/features/tour-ai/context/classroom-abort-scope', () => ({
  useClassroomAbortScope: runtimeMocks.useClassroomAbortScope,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: MockTooltipProvider,
}))

vi.mock('@/lib/ai/classroom-chat', () => ({
  createClassroomChat: runtimeMocks.createClassroomChat,
}))

vi.mock('@/features/tour-ai/agent/chat-suggestions', () => ({
  buildTourAIChatSuggestions: runtimeMocks.buildTourAIChatSuggestions,
}))

vi.mock('@/stores/llmConfig', () => ({
  useLLMConfig: runtimeMocks.useLLMConfig,
}))

vi.mock('@/modules/assistant-ui/chat/Thread', () => ({
  Thread: MockThread,
}))

describe('tourAIChatRuntime', () => {
  beforeEach(() => {
    for (const mock of Object.values(runtimeMocks))
      mock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('disables unsupported file attachments in the classroom chat thread', () => {
    const toolkit = { tools: {} } as unknown as Toolkit

    render(<TourAIChatRuntime toolkit={toolkit} lang="zh" />)

    expect(screen.getByTestId('thread').getAttribute('data-allow-attachments')).toBe('false')
    expect(runtimeMocks.createClassroomChat).toHaveBeenCalledWith(
      { apiKey: 'test-key', model: 'test-model' },
      toolkit,
      'zh',
    )
    expect(runtimeMocks.createScopedChatTransport).toHaveBeenCalledWith(
      { chat: true },
      { aborted: false },
    )
    expect(runtimeMocks.buildTourAIChatSuggestions).toHaveBeenCalledWith('zh')
    expect(runtimeMocks.useChatRuntime).toHaveBeenCalledWith(expect.objectContaining({
      sendAutomaticallyWhen: runtimeMocks.sendAutomaticallyWhen,
      transport: { transport: true },
    }))
  })
})
