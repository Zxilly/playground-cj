import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import type { LLMConfigBootstrapState } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import type { ClassroomSession, ExerciseInstance } from '@/lib/ai/classroom/types'
import { TourAIChat } from './TourAIChat'

const bootstrapState = vi.hoisted<{ current: LLMConfigBootstrapState }>(() => ({
  current: { status: 'ready' },
}))
const classroomState = vi.hoisted<{ activeExercise: ExerciseInstance | null }>(() => ({
  activeExercise: null,
}))
const bridgeState = vi.hoisted<{ lang: string }>(() => ({
  lang: 'zh',
}))

function mockUseLLMConfigBootstrap() {
  return bootstrapState.current
}

function mockUseAIClassroomBridge() {
  return {
    lang: bridgeState.lang,
    uiLang: bridgeState.lang,
    editor: { getEditor: () => null, setEditor: vi.fn() },
    classroom: classroomState.activeExercise
      ? {
          getSession: () => ({ currentExercise: classroomState.activeExercise }) as ClassroomSession,
          dispatch: vi.fn(),
          replaceChatAnnotations: vi.fn(),
          clearChatAnnotations: vi.fn(),
        }
      : undefined,
  }
}

function MockTourAIChatRuntime() {
  return <div data-testid="chat-runtime">runtime</div>
}

vi.mock('@/modules/llm-config/runtime/useLLMConfigBootstrap', () => ({
  useLLMConfigBootstrap: mockUseLLMConfigBootstrap,
}))

vi.mock('@/features/tour-ai/context/useAIClassroomBridge', () => ({
  useAIClassroomBridge: mockUseAIClassroomBridge,
}))

vi.mock('@/features/tour-ai/agent/tools', () => ({
  createClassroomChatToolkit: vi.fn(() => ({ tools: {} })),
}))

vi.mock('@/features/tour-ai/components/TourAIChatRuntime', () => ({
  TourAIChatRuntime: MockTourAIChatRuntime,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function EnWrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  globalI18n.load({ en: enMessages })
  globalI18n.activate('en')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  expect(ids.length).toBeGreaterThan(0)
  return ids
    .map((id) => {
      const description = document.getElementById(id)
      expect(description).toBeTruthy()
      return description?.textContent ?? ''
    })
    .join(' ')
}

function expectPoliteStatus(element: HTMLElement, text?: string) {
  expect(element.getAttribute('role')).toBe('status')
  expect(element.getAttribute('aria-live')).toBe('polite')
  expect(element.getAttribute('aria-atomic')).toBe('true')
  if (text != null)
    expect(element.textContent).toBe(text)
}

function expectChatSettingsButtonMobileSafe(button: HTMLElement) {
  expect(button.className).toContain('max-w-full')
  expect(button.className).toContain('justify-center')
  expect(button.className).toContain('text-left')
  expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(button.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
  expect(button.querySelector('span')?.className).toContain('break-words')
}

describe('tourAIChat', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useLLMConfigStore.getState().reset()
    useLLMConfigStore.getState().setSettingsDialogOpen(false)
    bootstrapState.current = { status: 'ready' }
    classroomState.activeExercise = null
    bridgeState.lang = 'zh'
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    useLLMConfigStore.getState().reset()
  })

  it('opens AI settings from the incomplete-config chat empty state', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })

    render(<TourAIChat />, { wrapper: Wrapper })

    const region = screen.getByRole('region', { name: '请先完成 AI 服务配置后开始聊天。' })
    const alert = screen.getByRole('alert', { name: '请先完成 AI 服务配置后开始聊天。' })
    expect(region.getAttribute('aria-describedby')).toBe(alert.getAttribute('aria-describedby'))
    expect(alert.getAttribute('aria-describedby')).toBeTruthy()
    screen.getByText('请先完成 AI 服务配置后开始聊天。')
    screen.getByText('需要服务地址、API Key 和模型。')
    const settings = screen.getByRole('button', { name: '配置 AI 服务' })
    expect(region.contains(settings)).toBe(true)
    expect(alert.contains(settings)).toBe(false)
    expect(describedByText(settings)).toBe('需要服务地址、API Key 和模型。')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置；不会发送聊天消息、排队 AI 请求或改变学习进度。')
    expectChatSettingsButtonMobileSafe(settings)

    fireEvent.click(settings)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for incomplete-config chat boundaries', () => {
    bridgeState.lang = 'en'
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })

    render(<TourAIChat />, { wrapper: EnWrapper })

    const region = screen.getByRole('region', { name: 'Complete the AI service configuration before starting chat.' })
    screen.getByText('Endpoint, API key, and model are required.')
    const settings = screen.getByRole('button', { name: 'Configure AI service' })
    expect(region.contains(settings)).toBe(true)
    expect(describedByText(settings)).toBe('Endpoint, API key, and model are required.')
    expect(settings.getAttribute('title')).toBe(
      'Open AI service settings. This will not send a chat message, queue an AI request, or change learning progress.',
    )
    expect(screen.queryByText('请先完成 AI 服务配置后开始聊天。')).toBeNull()
  })

  it('does not render chat runtime when the model is missing', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })

    render(<TourAIChat />, { wrapper: Wrapper })

    screen.getByText('请先完成 AI 服务配置后开始聊天。')
    expect(screen.queryByTestId('chat-runtime')).toBeNull()
  })

  it('opens AI settings when automatic quota bootstrap fails', () => {
    bootstrapState.current = { status: 'error', error: 'network' }

    render(<TourAIChat />, { wrapper: Wrapper })

    const region = screen.getByRole('region', { name: '无法获取 AI 配额，请在设置里填写自己的 API Key。' })
    const alert = screen.getByRole('alert', { name: '无法获取 AI 配额，请在设置里填写自己的 API Key。' })
    expect(region.getAttribute('aria-describedby')).toBe(alert.getAttribute('aria-describedby'))
    expect(alert.getAttribute('aria-describedby')).toBeTruthy()
    screen.getByText('无法获取 AI 配额，请在设置里填写自己的 API Key。')
    const settings = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(region.contains(settings)).toBe(true)
    expect(alert.contains(settings)).toBe(false)
    expect(describedByText(settings)).toBe(
      '打开 AI 服务设置，填写自己的 API Key 后可继续聊天；如果只是网络异常，也可以稍后重试。',
    )
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置；不会发送聊天消息、排队 AI 请求或改变学习进度。')
    expectChatSettingsButtonMobileSafe(settings)
    fireEvent.click(settings)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('announces chat bootstrap as a polite waiting state', () => {
    bootstrapState.current = { status: 'loading' }

    render(<TourAIChat />, { wrapper: Wrapper })

    const status = screen.getByRole('status', { name: '正在准备聊天' })
    expect(status.getAttribute('aria-describedby')).toBeTruthy()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toContain('正在准备聊天')
    expect(describedByText(status)).toBe('准备完成后会显示课堂聊天输入框。')
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders the runtime when chat is ready', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(<TourAIChat />, { wrapper: Wrapper })

    const panel = screen.getByRole('region', { name: '聊天' })
    expect(describedByText(panel)).toContain('围绕当前课堂提问')
    expect(describedByText(panel)).toContain('聊天回答不会直接改变学习进度')
    expect(panel.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    screen.getByText('围绕当前课堂提问')
    screen.getByTestId('chat-runtime')
  })

  it('shows the active concept scope when review chat is concept-scoped', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(<TourAIChat activeConceptId="cj.io.println" />, { wrapper: Wrapper })

    const scope = screen.getByText('围绕 标准输出 println 提问')
    expect(scope.getAttribute('title')).toBe('围绕 标准输出 println 提问')
    expect(scope.className).toContain('line-clamp-2')
    expect(scope.className).toContain('break-words')
    expect(scope.className).not.toContain('truncate')
    screen.getByTestId('chat-runtime')
  })

  it('surfaces active exercise context in the chat panel', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    classroomState.activeExercise = activeExercise({ prompt: '补全一个最小程序，让它输出 Hello。' })

    render(<TourAIChat activeConceptId="cj.io.println" />, { wrapper: Wrapper })

    const panel = screen.getByRole('region', { name: '聊天' })
    expect(describedByText(panel)).toContain('当前练习')
    expect(describedByText(panel)).toContain('补全一个最小程序，让它输出 Hello。')
    const context = screen.getByTestId('chat-active-exercise-context')
    expectPoliteStatus(context)
    expect(context.textContent).toContain('当前练习')
    expect(context.textContent).toContain('补全一个最小程序，让它输出 Hello。')
    expect(context.textContent).toContain('会结合当前编辑器代码回答；聊天本身不会记录练习进度。')
    expect(context.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the active exercise prompt readable in narrow chat panels', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    classroomState.activeExercise = activeExercise({
      prompt: '请补全一个带有 main 入口的最小程序，先声明一个不可变绑定，再用 println 输出这段较长的提示文本。',
    })

    render(<TourAIChat activeConceptId="cj.program.main" />, { wrapper: Wrapper })

    const context = screen.getByTestId('chat-active-exercise-context')
    const prompt = screen.getByText('请补全一个带有 main 入口的最小程序，先声明一个不可变绑定，再用 println 输出这段较长的提示文本。')

    expect(context.textContent).toContain('聊天本身不会记录练习进度。')
    expect(prompt.className).toContain('line-clamp-2')
    expect(prompt.className).toContain('break-words')
    expect(prompt.className).not.toContain('truncate')
  })

  it('flags stale concept scope when the open chat differs from the current exercise', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    classroomState.activeExercise = activeExercise({
      conceptIds: ['cj.program.main'],
      prompt: '写出 main 入口。',
    })
    const onUseCurrentExerciseContext = vi.fn()

    render(
      <TourAIChat activeConceptId="cj.io.println" onUseCurrentExerciseContext={onUseCurrentExerciseContext} />,
      { wrapper: Wrapper },
    )

    const panel = screen.getByRole('region', { name: '聊天' })
    expect(describedByText(panel)).toContain('聊天仍围绕 标准输出 println；当前练习属于 程序入口与 main。')
    const mismatch = screen.getByTestId('chat-context-mismatch')
    expect(mismatch.getAttribute('role')).toBeNull()
    const mismatchStatus = screen.getByText('聊天仍围绕 标准输出 println；当前练习属于 程序入口与 main。')
    expectPoliteStatus(mismatchStatus)
    const switchScope = screen.getByRole('button', { name: '改为当前练习' })
    expect(describedByText(switchScope)).toBe('聊天仍围绕 标准输出 println；当前练习属于 程序入口与 main。')
    expect(switchScope.getAttribute('title')).toBe('将聊天范围切换到 程序入口与 main；不会修改当前代码、提交练习或改变已记录进度。')
    expect(switchScope.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(switchScope)

    expect(onUseCurrentExerciseContext).toHaveBeenCalledWith('cj.program.main')
  })

  it('uses compiled English copy for active exercise context mismatch recovery', () => {
    bridgeState.lang = 'en'
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    classroomState.activeExercise = activeExercise({
      conceptIds: ['cj.program.main'],
      prompt: 'Write the main entry.',
    })
    const onUseCurrentExerciseContext = vi.fn()

    render(
      <TourAIChat activeConceptId="cj.io.println" onUseCurrentExerciseContext={onUseCurrentExerciseContext} />,
      { wrapper: EnWrapper },
    )

    const panel = screen.getByRole('region', { name: 'Chat' })
    expect(describedByText(panel)).toContain('Ask about Standard output println')
    expect(describedByText(panel)).toContain('Chat replies do not directly change learning progress')
    expect(describedByText(panel)).toContain('Current exercise')
    expect(describedByText(panel)).toContain('Write the main entry.')
    const context = screen.getByTestId('chat-active-exercise-context')
    expect(context.textContent).toContain('Answers will use the current editor code. Chat itself does not record practice progress.')
    const mismatchStatus = screen.getByText('Chat is still scoped to Standard output println; the current exercise belongs to Program entry and main.')
    expectPoliteStatus(mismatchStatus)
    const switchScope = screen.getByRole('button', { name: 'Use current exercise' })
    expect(describedByText(switchScope)).toBe('Chat is still scoped to Standard output println; the current exercise belongs to Program entry and main.')
    expect(switchScope.getAttribute('title')).toBe(
      'Switch chat scope to Program entry and main. This will not modify current code, submit the exercise, or change recorded progress.',
    )
    fireEvent.click(switchScope)
    expect(onUseCurrentExerciseContext).toHaveBeenCalledWith('cj.program.main')
    expect(screen.queryByText('改为当前练习')).toBeNull()
  })

  it('uses review-check copy for active review exercise context', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    classroomState.activeExercise = activeExercise({
      intent: 'review_check',
      prompt: '重新写一个 println 复习检查。',
    })

    render(<TourAIChat activeConceptId="cj.io.println" />, { wrapper: Wrapper })

    const context = screen.getByTestId('chat-active-exercise-context')
    expect(context.textContent).toContain('当前复习检查')
    expect(context.textContent).toContain('重新写一个 println 复习检查。')
  })

  it('falls back to a generic concept scope when the concept is unknown', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(<TourAIChat activeConceptId="missing.concept" />, { wrapper: Wrapper })

    screen.getByText('围绕当前概念提问')
    screen.getByTestId('chat-runtime')
  })

  it('blocks chat runtime when shared quota is exhausted', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(<TourAIChat />, { wrapper: Wrapper })

    const region = screen.getByRole('region', { name: '共享额度已用完，暂时无法开始新的 AI 聊天。' })
    const alert = screen.getByRole('alert', { name: '共享额度已用完，暂时无法开始新的 AI 聊天。' })
    expect(region.getAttribute('aria-describedby')).toBe(alert.getAttribute('aria-describedby'))
    expect(alert.getAttribute('aria-describedby')).toBeTruthy()
    screen.getByText('共享额度已用完，暂时无法开始新的 AI 聊天。')
    expect(screen.queryByTestId('chat-runtime')).toBeNull()

    const settings = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(region.contains(settings)).toBe(true)
    expect(alert.contains(settings)).toBe(false)
    expect(describedByText(settings)).toContain('使用自己的 API Key 可立刻继续')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置；不会发送聊天消息、排队 AI 请求或改变学习进度。')
    expectChatSettingsButtonMobileSafe(settings)
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })
})

function activeExercise(overrides: Partial<ExerciseInstance> = {}): ExerciseInstance {
  return {
    id: 'exercise:1',
    templateId: 'cj.io.println.print-value.cangjie',
    templateVersion: '2026-05-28',
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    prompt: '补全一个最小程序。',
    starterCode: 'main() {\n    // TODO\n}',
    expectedOutput: 'Hello',
    matchMode: 'exact',
    status: 'active',
    intent: 'mainline',
    personalizationInputs: { summary: 'test' },
    createdAt: 1,
    ...overrides,
  }
}
