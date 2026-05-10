/* eslint-disable react/component-hook-factories */
import 'fake-indexeddb/auto'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TourAIApp from './TourAIApp'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { requestRemoteAction } from '@/service/run'
import { runLessonGenerationStep } from '@/lib/ai/lesson-generation-runner'
import { clearClassroomSession, loadClassroomSession, saveClassroomSession } from '@/lib/ai/classroom/persistence'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'

vi.mock('next/font/local', () => ({
  default: () => ({ style: { fontFamily: 'MockFont' } }),
}))

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: unknown[], itemContent: (i: number, item: unknown) => React.ReactNode }) => (
    <div data-testid="virtuoso-mock">
      {data.map((item, i) => <div key={i}>{itemContent(i, item)}</div>)}
    </div>
  ),
}))

vi.mock('@/features/tour/components/TourEditor', () => ({
  TourEditor: ({ code }: { code: string }) => (
    <div data-testid="tour-editor">{code || 'empty editor'}</div>
  ),
}))

vi.mock('@/features/tour-ai/components/TourAIChat', () => ({
  TourAIChat: () => <div data-testid="chat-panel">聊天</div>,
}))

vi.mock('@/service/run', () => ({
  requestRemoteAction: vi.fn(),
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  editor: {
    setModelMarkers: vi.fn(),
  },
  MarkerSeverity: {
    Hint: 1,
    Info: 2,
    Warning: 4,
    Error: 8,
  },
}))

vi.mock('@/lib/ai/lesson-generation-runner', () => ({
  runLessonGenerationStep: vi.fn(async ({ bridge, event }) => {
    if (event.type === 'classroom_opened') {
      bridge.classroom?.dispatch({
        type: 'APPEND_LESSON_CONTENT',
        blocks: [
          { type: 'heading', text: 'Let bindings', level: 2 },
          { type: 'paragraph', body: [{ text: 'Use let for immutable values.' }] },
        ],
        now: 1001,
      })
      bridge.classroom?.dispatch({
        type: 'SET_CURRENT_QUIZ',
        quiz: {
          type: 'quiz',
          conceptId: 'cj.bindings.let',
          prompt: [{ text: 'Print 3.' }],
          starterCode: 'main() {\n    println(0)\n}',
          expectedOutput: '3',
          matchMode: 'exact',
        },
        now: 1002,
      })
    }
  }),
}))

function appendFirstQuiz(bridge: Parameters<typeof runLessonGenerationStep>[0]['bridge']) {
  bridge.classroom?.dispatch({
    type: 'APPEND_LESSON_CONTENT',
    blocks: [
      { type: 'heading', text: 'Let bindings', level: 2 },
      { type: 'paragraph', body: [{ text: 'Use let for immutable values.' }] },
    ],
    now: 1001,
  })
  bridge.classroom?.dispatch({
    type: 'SET_CURRENT_QUIZ',
    quiz: {
      type: 'quiz',
      conceptId: 'cj.bindings.let',
      prompt: [{ text: 'Print 3.' }],
      starterCode: 'main() {\n    println(0)\n}',
      expectedOutput: '3',
      matchMode: 'exact',
    },
    now: 1002,
  })
}

function appendSecondQuiz(bridge: Parameters<typeof runLessonGenerationStep>[0]['bridge']) {
  bridge.classroom?.dispatch({
    type: 'APPEND_LESSON_CONTENT',
    blocks: [{ type: 'paragraph', body: [{ text: 'Next practice.' }] }],
    now: 1003,
  })
  bridge.classroom?.dispatch({
    type: 'SET_CURRENT_QUIZ',
    quiz: {
      type: 'quiz',
      conceptId: 'cj.bindings.var',
      prompt: [{ text: 'Print 4.' }],
      starterCode: 'main() {\n    println(0)\n}',
      expectedOutput: '4',
      matchMode: 'exact',
    },
    now: 1004,
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function renderApp() {
  return render(
    <Wrapper>
      <TourAIApp lang="zh" />
    </Wrapper>,
  )
}

describe('tourAIApp classroom flow', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearClassroomSession('zh')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    useLLMConfigStore.getState().reset()
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    vi.mocked(requestRemoteAction).mockReset()
    vi.mocked(runLessonGenerationStep).mockReset()
    vi.mocked(runLessonGenerationStep).mockImplementation(async ({ bridge, event }) => {
      if (event.type === 'classroom_opened')
        appendFirstQuiz(bridge)
    })
  })

  afterEach(async () => {
    cleanup()
    window.localStorage.clear()
    await clearClassroomSession('zh')
    useLLMConfigStore.getState().reset()
  })

  it('renders one continuous classroom stream authored by lesson generation', async () => {
    renderApp()

    await screen.findByText('Let bindings')
    screen.getByText('Use let for immutable values.')
    screen.getByText('Print 3.')
    expect(screen.getByTestId('tour-editor').textContent).toContain('println')
  })

  it('streams lesson generation progress in an expanded panel and collapses it after commit', async () => {
    let finishAuthor: (() => void) | undefined
    vi.mocked(runLessonGenerationStep).mockImplementationOnce(async (options) => {
      const progressOptions = options as typeof options & { onProgress?: (chunk: string) => void }
      progressOptions.onProgress?.('读取课堂状态')
      await new Promise<void>((resolve) => {
        finishAuthor = resolve
        options.abortSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
      if (!options.abortSignal?.aborted)
        appendFirstQuiz(options.bridge)
    })

    renderApp()

    await screen.findByText('读取课堂状态')
    expect(screen.getByRole('button', { name: /课程生成进度/ }).getAttribute('aria-expanded')).toBe('true')

    finishAuthor?.()
    await screen.findByText('Let bindings')
    await waitFor(() => expect(screen.getByRole('button', { name: /课程生成进度/ }).getAttribute('aria-expanded')).toBe('false'))
    expect(screen.queryByText('读取课堂状态')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /课程生成进度/ }))
    screen.getByText('读取课堂状态')
  })

  it('retries classroom_opened after the automatic key resolves', async () => {
    useLLMConfigStore.getState().reset()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        provider: 'openai-compatible',
        baseURL: 'https://api.example.test/v1',
        apiKey: 'auto-key',
        model: 'test-model',
      }),
    })))

    renderApp()

    await screen.findByText('Let bindings')
    expect(runLessonGenerationStep).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ type: 'classroom_opened' }),
    }))
    vi.unstubAllGlobals()
  })

  it('opens and closes the chat sidebar without changing classroom phase', async () => {
    renderApp()
    await screen.findByText('Let bindings')

    expect(screen.getByTestId('classroom-phase').textContent).toContain('练习')
    fireEvent.click(screen.getByRole('button', { name: '打开聊天' }))
    screen.getByTestId('chat-panel')
    expect(screen.getByTestId('classroom-phase').textContent).toContain('练习')
    fireEvent.click(screen.getByRole('button', { name: '关闭聊天' }))

    await waitFor(() => expect(screen.queryByTestId('chat-panel')).toBeNull())
    expect(screen.getByTestId('classroom-phase').textContent).toContain('练习')
  })

  it('failed quiz run appends run result only and keeps quiz active', async () => {
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: '',
      compiler_code: 0,
      bin_output: '2\n',
      bin_code: 0,
    })
    renderApp()
    await screen.findByText('Print 3.')

    fireEvent.click(screen.getByRole('button', { name: '运行检查' }))

    await screen.findByText(/输出：2/)
    expect(screen.getAllByText('Quiz active').length).toBeGreaterThan(0)
    expect(screen.queryByText(/已记录：success/)).toBeNull()
  })

  it('records a failed quiz run and keeps the quiz active when the runner request rejects', async () => {
    vi.mocked(requestRemoteAction).mockRejectedValueOnce(new Error('network down'))
    renderApp()
    await screen.findByText('Print 3.')

    const runButton = screen.getByRole('button', { name: '运行检查' }) as HTMLButtonElement
    fireEvent.click(runButton)

    await waitFor(() => expect(runButton.disabled).toBe(false))
    await screen.findByText('运行结果')
    expect(screen.getAllByText('Quiz active').length).toBeGreaterThan(0)
    expect(screen.queryByText(/已记录：success/)).toBeNull()
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
    await waitFor(async () => {
      const saved = await loadClassroomSession('zh')
      expect(saved?.lastRun).toEqual(expect.objectContaining({ ok: false }))
      expect(saved?.currentQuiz).toEqual(expect.objectContaining({ status: 'active' }))
    })
  })

  it('successful quiz run writes progress and triggers lesson generation automatically', async () => {
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: '',
      compiler_code: 0,
      bin_output: '3\n',
      bin_code: 0,
    })
    renderApp()
    await screen.findByText('Print 3.')

    fireEvent.click(screen.getByRole('button', { name: '运行检查' }))

    await screen.findByText(/已记录：success/)
    expect(screen.getAllByText('Quiz success').length).toBeGreaterThan(0)
    await waitFor(() => expect(runLessonGenerationStep).toHaveBeenCalledTimes(2))
  })

  it('does not complete a quiz when a non-zero run prints the expected output', async () => {
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: 'runtime failure',
      compiler_code: 0,
      bin_output: '3\n',
      bin_code: 1,
    })
    renderApp()
    await screen.findByText('Print 3.')

    fireEvent.click(screen.getByRole('button', { name: '运行检查' }))

    await screen.findByText(/输出：3/)
    expect(screen.getAllByText('Quiz active').length).toBeGreaterThan(0)
    expect(screen.queryByText(/已记录：success/)).toBeNull()
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
  })

  it('keeps older quiz cards immutable after lesson generation sets the next quiz', async () => {
    vi.mocked(runLessonGenerationStep)
      .mockImplementationOnce(async ({ bridge }) => appendFirstQuiz(bridge))
      .mockImplementationOnce(async ({ bridge }) => appendSecondQuiz(bridge))
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: '',
      compiler_code: 0,
      bin_output: '3\n',
      bin_code: 0,
    })

    renderApp()
    await screen.findByText('Print 3.')
    fireEvent.click(screen.getByRole('button', { name: '运行检查' }))

    await screen.findByText('Print 4.')
    screen.getByText('Print 3.')
  })

  it('retains queued events when lesson generation fails and allows retry', async () => {
    vi.mocked(runLessonGenerationStep)
      .mockImplementationOnce(async ({ bridge }) => appendFirstQuiz(bridge))
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(async ({ bridge }) => appendSecondQuiz(bridge))
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: '',
      compiler_code: 0,
      bin_output: '3\n',
      bin_code: 0,
    })

    renderApp()
    await screen.findByText('Print 3.')
    fireEvent.click(screen.getByRole('button', { name: '运行检查' }))

    expect(await screen.findAllByText(/课程生成失败：network/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '重试课程生成' }))

    await screen.findByText('Print 4.')
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(3)
  })

  it('does not render partial lesson generation writes when the author fails mid-run', async () => {
    vi.mocked(runLessonGenerationStep).mockImplementationOnce(async ({ bridge }) => {
      appendFirstQuiz(bridge)
      throw new Error('network')
    })

    renderApp()

    await screen.findByText(/课程生成失败：network/)
    expect(screen.queryByText('Let bindings')).toBeNull()
    expect(screen.queryByText('Print 3.')).toBeNull()
  })

  it('hydrates persisted classroom state before deciding whether to run classroom_opened', async () => {
    const persisted = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Persisted lesson', level: 2 }],
      now: 901,
    })
    await saveClassroomSession(persisted)

    renderApp()

    await screen.findByText('Persisted lesson')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })
})
