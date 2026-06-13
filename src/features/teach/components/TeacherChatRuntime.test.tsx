import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { TeacherChatRuntime } from './TeacherChatRuntime'

const runtimeMocks = vi.hoisted(() => ({
  createTeacherToolkit: vi.fn(() => ({ tools: true })),
  createTeacherAgent: vi.fn(() => ({ agent: true })),
  createScopedChatTransport: vi.fn(() => ({ transport: true })),
  useChatRuntime: vi.fn(() => ({ runtime: true })),
  useAbortScope: vi.fn(() => ({ aborted: false })),
  useLLMConfig: vi.fn(() => ({ apiKey: 'test-key', model: 'test-model' })),
  useLLMConfigBootstrap: vi.fn(() => ({ status: 'ready' as const })),
  sendAutomaticallyWhen: vi.fn(() => false),
  setText: vi.fn(),
  useComposerRuntime: vi.fn(),
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
  useComposerRuntime: runtimeMocks.useComposerRuntime,
}))

vi.mock('@assistant-ui/react-ai-sdk', () => ({
  useChatRuntime: runtimeMocks.useChatRuntime,
}))

vi.mock('ai', () => ({
  lastAssistantMessageIsCompleteWithToolCalls: runtimeMocks.sendAutomaticallyWhen,
}))

vi.mock('@/lib/teach/teacher/toolkit', () => ({
  createTeacherToolkit: runtimeMocks.createTeacherToolkit,
}))

vi.mock('@/lib/teach/teacher/agent', () => ({
  createTeacherAgent: runtimeMocks.createTeacherAgent,
}))

vi.mock('@/lib/teach/teacher/scoped-chat-transport', () => ({
  createScopedChatTransport: runtimeMocks.createScopedChatTransport,
}))

vi.mock('@/features/teach/context/abort-scope', () => ({
  useAbortScope: runtimeMocks.useAbortScope,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: MockTooltipProvider,
}))

vi.mock('@/stores/llmConfig', () => ({
  useLLMConfig: runtimeMocks.useLLMConfig,
}))

vi.mock('@/modules/llm-config/runtime/useLLMConfigBootstrap', () => ({
  useLLMConfigBootstrap: runtimeMocks.useLLMConfigBootstrap,
}))

vi.mock('@/modules/assistant-ui/chat/Thread', () => ({
  Thread: MockThread,
}))

function makeContext(): WorkspaceContextValue {
  return {
    repo: { id: 'repo' } as unknown as WorkspaceContextValue['repo'],
    retrievalStore: { list: vi.fn(async () => []), save: vi.fn() },
    knowledge: { id: 'cangjie-mcp', search: vi.fn(async () => []) },
    runner: { run: vi.fn(async () => ({ ok: true, stdout: '', stderr: '', exitCode: 0 })) },
    now: () => 123,
  }
}

function renderRuntime(lang = 'zh') {
  return render(
    <WorkspaceContext value={makeContext()}>
      <TeacherChatRuntime lang={lang} />
    </WorkspaceContext>,
  )
}

describe('teacherChatRuntime', () => {
  beforeEach(() => {
    for (const mock of Object.values(runtimeMocks))
      mock.mockClear()
    runtimeMocks.useComposerRuntime.mockReturnValue({ setText: runtimeMocks.setText })
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  })

  it('renders the vendored chat thread with attachments disabled', () => {
    renderRuntime()
    expect(screen.getByTestId('thread')).toBeTruthy()
    expect(screen.getByTestId('thread').getAttribute('data-allow-attachments')).toBe('false')
  })

  it('runs the LLM config bootstrap without surfacing errors so the key/quota stays fresh', () => {
    renderRuntime()
    expect(runtimeMocks.useLLMConfigBootstrap).toHaveBeenCalledWith({ reportErrors: false })
  })

  it('builds the teacher toolkit from the workspace collaborators', () => {
    renderRuntime()
    expect(runtimeMocks.createTeacherToolkit).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledge: expect.objectContaining({ id: 'cangjie-mcp' }),
        runner: expect.objectContaining({ run: expect.any(Function) }),
        retrievalStore: expect.objectContaining({ list: expect.any(Function) }),
        now: expect.any(Function),
      }),
    )
  })

  it('assembles the teacher agent from the resolved llm config, toolkit, and language', () => {
    renderRuntime('en')
    expect(runtimeMocks.createTeacherAgent).toHaveBeenCalledWith(
      { apiKey: 'test-key', model: 'test-model' },
      { tools: true },
      'en',
    )
  })

  it('wraps the agent in a scoped transport bound to the abort scope', () => {
    renderRuntime()
    expect(runtimeMocks.createScopedChatTransport).toHaveBeenCalledWith(
      { agent: true },
      { aborted: false },
    )
  })

  it('drives the chat runtime with the scoped transport and tool-loop continuation', () => {
    renderRuntime()
    expect(runtimeMocks.useChatRuntime).toHaveBeenCalledWith(expect.objectContaining({
      transport: { transport: true },
      sendAutomaticallyWhen: runtimeMocks.sendAutomaticallyWhen,
    }))
  })

  it('seeds the composer with a pending prefill prompt and clears the signal', async () => {
    useWorkspaceStore.getState().setPendingPrefill('帮我定下学习目标')
    renderRuntime()
    await waitFor(() => expect(runtimeMocks.setText).toHaveBeenCalledWith('帮我定下学习目标'))
    // The signal is consumed once so re-renders don't re-seed it.
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
  })

  it('does not touch the composer when no prefill is pending', () => {
    renderRuntime()
    expect(runtimeMocks.setText).not.toHaveBeenCalled()
  })

  it('seeds a prefill queued after mount', async () => {
    renderRuntime()
    expect(runtimeMocks.setText).not.toHaveBeenCalled()
    useWorkspaceStore.getState().setPendingPrefill('问老师这个问题')
    await waitFor(() => expect(runtimeMocks.setText).toHaveBeenCalledWith('问老师这个问题'))
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
  })
})
