/* eslint-disable react/component-hook-factories */
import 'fake-indexeddb/auto'
import type { ComponentType, ReactNode } from 'react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TourAIApp, { ClassroomEntryLoading, ClassroomExperienceLoading } from './TourAIApp'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { requestRemoteAction } from '@/service/run'
import { runLessonGenerationStep } from '@/lib/ai/lesson-generation-runner'
import { LESSON_GENERATION_STALLED_AFTER_MS } from '@/features/tour-ai/runtime/useLessonGenerationRuntime'
import { clearClassroomSession, loadClassroomSession, saveClassroomSession } from '@/lib/ai/classroom/persistence'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useExerciseDraftStore } from '@/features/tour-ai/state/exercise-draft-store'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'
import { messages as enMessages } from '@/locales/en/messages.mjs'

vi.mock('next/font/local', () => ({
  default: () => ({ style: { fontFamily: 'MockFont' } }),
}))

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
    components,
  }: {
    data: unknown[]
    itemContent: (i: number, item: unknown) => ReactNode
    components?: { Footer?: ComponentType }
  }) => {
    const Footer = components?.Footer
    return (
      <div data-testid="virtuoso-mock">
        {data.map((item, i) => {
          const key = typeof item === 'object' && item !== null && 'id' in item
            ? String(item.id)
            : JSON.stringify(item)
          return <div key={key}>{itemContent(i, item)}</div>
        })}
        {Footer ? <Footer /> : null}
      </div>
    )
  },
}))

vi.mock('@/features/tour/components/TourEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    TourEditor: ({
      code,
      layout,
      enableLanguageClient,
      uriHint,
      onEditorReady,
    }: {
      code: string
      layout?: string
      enableLanguageClient?: boolean
      uriHint?: string
      onEditorReady?: (handle: {
        getEditor: () => {
          getModel: () => {
            getValue: () => string
            setValue: (value: string) => void
            onDidChangeContent: () => { dispose: () => void }
          }
          updateOptions: () => void
        }
        dispose: () => void
      }) => void
    }) => {
      const modelRef = React.useRef(code)
      React.useEffect(() => {
        modelRef.current = code
        onEditorReady?.({
          getEditor: () => ({
            getModel: () => ({
              getValue: () => modelRef.current,
              setValue: (value: string) => {
                modelRef.current = value
              },
              onDidChangeContent: () => ({ dispose: () => undefined }),
            }),
            updateOptions: () => undefined,
          }),
          dispose: () => undefined,
        })
      }, [code, onEditorReady])

      return (
        <div
          data-testid="tour-editor"
          data-layout={layout ?? 'full'}
          data-language-client={String(enableLanguageClient ?? true)}
          data-uri-hint={uriHint}
        >
          {code || 'empty editor'}
        </div>
      )
    },
  }
})

vi.mock('@/features/tour-ai/components/TourAIChat', () => ({
  TourAIChat: ({ activeConceptId }: { activeConceptId?: string }) => (
    <div data-testid="chat-panel">{activeConceptId ?? 'chat'}</div>
  ),
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
    if (event.type === 'classroom_opened')
      appendOpeningSlice(bridge)
  }),
}))

function appendOpeningSlice(bridge: AIClassroomBridgeValue) {
  bridge.classroom?.dispatch({
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
    skillId: 'cj.io.println.print-value',
    now: 1001,
  })
  bridge.classroom?.dispatch({
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '1',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '在 main 中用 println 输出 Cangjie。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'Selected from default pack.', difficulty: 1 },
    },
    now: 1002,
  })
}

function appendNextSlice(bridge: AIClassroomBridgeValue) {
  bridge.classroom?.dispatch({
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.var.immutable',
    blockIds: ['cj.var.immutable.heading'],
    skillId: 'cj.var.immutable.choose-let',
    now: 1003,
  })
  bridge.classroom?.dispatch({
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.var.immutable.choose-let.answer',
      templateVersion: '1',
      skillId: 'cj.var.immutable.choose-let',
      conceptIds: ['cj.var.immutable'],
      prompt: '用 let 声明 answer 为 42，并打印 answer。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: '42',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'Selected from default pack.', difficulty: 1 },
    },
    now: 1004,
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function EnWrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function renderApp() {
  return render(
    <Wrapper>
      <TourAIApp lang="zh" />
    </Wrapper>,
  )
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

const AI_RENDER_TIMEOUT = { timeout: 5000 }

async function enterClassroom(label: RegExp = /开始 AI 课堂|继续上次课堂/) {
  await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
  fireEvent.click(screen.getByRole('button', { name: label }))
}

async function waitForProgressPanelToClose() {
  await waitFor(() => {
    expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
  })
}

function clickWithPointerSequence(element: HTMLElement) {
  fireEvent.pointerDown(element, { button: 0 })
  fireEvent.mouseDown(element, { button: 0 })
  fireEvent.mouseUp(element, { button: 0 })
  fireEvent.click(element)
}

async function openProgressPanelNextStep(expectedTitle: string) {
  await waitForProgressPanelToClose()
  fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))
  const panel = await screen.findByTestId('classroom-concept-panel-content', undefined, AI_RENDER_TIMEOUT)
  const nextStep = await within(panel).findByTestId('concept-panel-next-step', undefined, AI_RENDER_TIMEOUT)
  expect(nextStep.textContent).toContain(expectedTitle)
  clickWithPointerSequence(within(nextStep).getByRole('button', { name: `打开下一步复习 ${expectedTitle}` }))
  await waitForProgressPanelToClose()
  await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
  await waitFor(() => {
    expect(screen.getByTestId('classroom-review-focus-notice').textContent).toContain(`已打开 ${expectedTitle} 的复习。`)
  })
}

function createCompletedPrintExerciseSession() {
  let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '1',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '在 main 中用 println 输出 Cangjie。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'Selected from default pack.', difficulty: 1 },
    },
    now: 1001,
  })
  session = classroomReducer(session, { type: 'EXERCISE_SUCCESS', now: 1002 })
  return session
}

function createCompletedReviewCheckSession() {
  let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
    skillId: 'cj.io.println.print-value',
    now: 1001,
  })
  session = classroomReducer(session, {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '1',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '再用 println 输出一次 Cangjie。',
      starterCode: 'main() {\n    println("Cangjie")\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'review_check',
      personalizationInputs: { summary: 'Review println.', difficulty: 1 },
    },
    now: 1002,
  })
  return classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
    attemptedCode: 'main() {\n    println("Cangjie")\n}',
    now: 1003,
  })
}

function createBlockedMainWithActivePrintSession() {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.program.main.entry-shape.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.program.main.define-entry',
      conceptIds: ['cj.program.main'],
      prompt: '写出 main 入口。',
      starterCode: 'println("missing main")',
      expectedOutput: 'ready',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 1001,
  })
  session = classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
    attemptedCode: 'println("wrong")',
    now: 1002,
  })
  session = classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'still wrong\n', stderr: '', exitCode: 0 },
    attemptedCode: 'println("still wrong")',
    now: 1003,
  })
  session = classroomReducer(session, { type: 'EXERCISE_SKIP', now: 1004 })
  session = classroomReducer(session, { type: 'CONSUME_EVENT', now: 1005 })
  session = classroomReducer(session, { type: 'CONSUME_EVENT', now: 1006 })
  return classroomReducer(session, {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
    skillId: 'cj.io.println.print-value',
    now: 1007,
  })
}

describe('tour ai app classroom flow', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    useExerciseDraftStore.setState({ drafts: {} })
    useCodeSuggestionStore.setState({ suggestion: null, appliedAssistanceByExerciseId: {} })
    useScrollWatermarkStore.setState({ watermarks: {} })
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
        appendOpeningSlice(bridge)
      if (event.type === 'exercise_success')
        appendNextSlice(bridge)
    })
  })

  afterEach(async () => {
    vi.useRealTimers()
    cleanup()
    window.localStorage.clear()
    useExerciseDraftStore.setState({ drafts: {} })
    useCodeSuggestionStore.setState({ suggestion: null, appliedAssistanceByExerciseId: {} })
    useScrollWatermarkStore.setState({ watermarks: {} })
    await clearClassroomSession('zh')
    useLLMConfigStore.getState().reset()
  })

  it('labels the unhydrated classroom entry loading state', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/zh/tour/ai?topic=cj.program.main')
    render(<ClassroomEntryLoading />, { wrapper: Wrapper })

    const status = screen.getByRole('status', { name: '正在加载课堂内容' })
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.getAttribute('aria-describedby')).toBeTruthy()
    expect(describedByText(status)).toBe('正在读取你的课堂记录，并准备进入学习入口。')
    const description = screen.getByText('正在读取你的课堂记录，并准备进入学习入口。')
    expect(description.className).not.toContain('sr-only')
    expect(screen.queryByRole('link', { name: '刷新页面' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    screen.getByText('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    const reload = screen.getByRole('link', { name: '刷新页面' })
    expect(reload.getAttribute('href')).toBe('/zh/tour/ai?topic=cj.program.main')
    expect(describedByText(reload)).toBe('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    const source = screen.getByRole('link', { name: '查看对应教程' })
    expect(source.getAttribute('href')).toBe('/zh/tour/welcome/1')
    expect(describedByText(source)).toBe('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    expect(source.getAttribute('title')).toBeNull()
    expect(describedByText(status)).toContain('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
  })

  it('labels the dynamic classroom experience loading state', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/zh/tour/ai')
    render(<ClassroomExperienceLoading />, { wrapper: Wrapper })

    const status = screen.getByRole('status', { name: '正在准备课堂' })
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.getAttribute('aria-describedby')).toBeTruthy()
    expect(describedByText(status)).toBe('正在加载课堂运行环境和当前课堂内容。')
    const description = screen.getByText('正在加载课堂运行环境和当前课堂内容。')
    expect(description.className).not.toContain('sr-only')
    expect(screen.queryByRole('link', { name: '刷新页面' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    screen.getByText('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
    expect(screen.getByRole('link', { name: '刷新页面' }).getAttribute('href')).toBe('/zh/tour/ai')
    expect(screen.queryByRole('link', { name: '查看对应教程' })).toBeNull()
    expect(describedByText(status)).toContain('如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。')
  })

  it('uses compiled English copy for entry loading recovery', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/en/tour/ai?topic=cj.program.main#practice')
    render(<ClassroomEntryLoading />, { wrapper: EnWrapper })

    const status = screen.getByRole('status', { name: 'Loading classroom content' })
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(describedByText(status)).toBe('Reading your classroom record and preparing the learning entrance.')
    expect(screen.queryByRole('link', { name: 'Refresh page' })).toBeNull()
    expect(screen.queryByText('正在加载课堂内容')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    screen.getByText('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    const reload = screen.getByRole('link', { name: 'Refresh page' })
    expect(reload.getAttribute('href')).toBe('/en/tour/ai?topic=cj.program.main#practice')
    expect(describedByText(reload)).toBe('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    const source = screen.getByRole('link', { name: 'View matching tour' })
    expect(source.getAttribute('href')).toBe('/en/tour/welcome/1')
    expect(describedByText(source)).toBe('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
    expect(source.getAttribute('title')).toBeNull()
    expect(describedByText(status)).toContain('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
  })

  it('uses compiled English copy for dynamic classroom loading recovery', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/en/tour/ai')
    render(<ClassroomExperienceLoading />, { wrapper: EnWrapper })

    const status = screen.getByRole('status', { name: 'Preparing classroom' })
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(describedByText(status)).toBe('Loading the classroom runtime and current classroom content.')
    expect(screen.queryByRole('link', { name: 'Refresh page' })).toBeNull()
    expect(screen.queryByText('正在准备课堂')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    const reload = screen.getByRole('link', { name: 'Refresh page' })
    expect(reload.getAttribute('href')).toBe('/en/tour/ai')
    expect(screen.queryByRole('link', { name: 'View matching tour' })).toBeNull()
    expect(describedByText(status)).toContain('If you are still stuck here, refresh the page or return to the related tutorial before entering AI Classroom again.')
  })

  it('keeps the landing page until the learner enters AI Classroom', async () => {
    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('heading', { name: '从已验证课程开始学习' })
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('resets document scroll when entering AI Classroom from the landing page', async () => {
    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    document.documentElement.scrollTop = 80
    document.documentElement.scrollLeft = 10
    document.body.scrollTop = 40
    document.body.scrollLeft = 5

    fireEvent.click(screen.getByRole('button', { name: /开始 AI 课堂|继续上次课堂/ }))

    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(document.body.scrollLeft).toBe(0)
  })

  it('lets configured learners preview validated course content before starting generation', async () => {
    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getAllByRole('heading', { name: '程序入口与 main' }).length).toBeGreaterThan(0)
    const liveTab = screen.getByRole('tab', { name: '课堂' })
    const reviewTab = screen.getByRole('tab', { name: /复习/ })
    expect(liveTab.getAttribute('aria-selected')).toBe('false')
    expect(liveTab.getAttribute('aria-controls')).toBe('ai-classroom-live-panel')
    expect(liveTab.getAttribute('aria-disabled')).toBe('true')
    expect(describedByText(liveTab)).toContain('当前处于课程预览；需要使用“开始课堂”按钮确认后才会启动 AI 课堂并准备下一步内容。')
    expect(reviewTab.getAttribute('aria-selected')).toBe('true')
    expect(reviewTab.getAttribute('aria-controls')).toBe('ai-classroom-review-panel')
    expect(document.getElementById('ai-classroom-review-panel')?.getAttribute('role')).toBe('tabpanel')
    expect(document.getElementById('ai-classroom-review-panel')?.getAttribute('aria-labelledby')).toBe('ai-classroom-review-tab')
    fireEvent.click(liveTab)
    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('keeps preview-only AI actions as start-classroom entry points', async () => {
    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。')
    expect(screen.queryByRole('button', { name: '开始练习验证' })).toBeNull()
    expect(screen.queryByRole('button', { name: '打开聊天' })).toBeNull()
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    const startButtons = screen.getAllByRole('button', { name: '开始 AI 课堂' })
    expect(startButtons.length).toBeGreaterThan(0)
    fireEvent.click(startButtons[startButtons.length - 1])

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ type: 'classroom_opened' }),
    }))
  })

  it('keeps the preview progress panel read-only before the classroom starts', async () => {
    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    await screen.findByTestId('classroom-concept-panel-content', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('开始第一节课后，这里会展示已看内容、练习提交和复习检查证据。')
    expect(screen.queryByTestId('concept-panel-next-step')).toBeNull()
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
    screen.getByText('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。')
  })

  it('starts the live classroom when configured learners explicitly leave preview mode', async () => {
    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: '课堂' }))

    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    {
      const startButtons = screen.getAllByRole('button', { name: '开始 AI 课堂' })
      fireEvent.click(startButtons[startButtons.length - 1])
    }

    fireEvent.click(screen.getByRole('tab', { name: '课堂' }))

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('在 main 中用 println 输出 Cangjie。')
    const liveTab = screen.getByRole('tab', { name: /课堂/ })
    expect(liveTab.getAttribute('aria-selected')).toBe('true')
    expect(describedByText(liveTab)).toBe('切换到课堂视图，只查看当前课堂流；不会改变学习进度或排队新的 AI 请求。')
    expect(liveTab.getAttribute('title')).toBe('切换到课堂视图，只查看当前课堂流；不会改变学习进度或排队新的 AI 请求。')
    expect(liveTab.getAttribute('aria-controls')).toBe('ai-classroom-live-panel')
    expect(document.getElementById('ai-classroom-live-panel')?.getAttribute('role')).toBe('tabpanel')
    expect(document.getElementById('ai-classroom-live-panel')?.getAttribute('aria-labelledby')).toBe('ai-classroom-live-tab')
    expect(runLessonGenerationStep).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ type: 'classroom_opened' }),
    }))
  })

  it('explains shared quota blockage when preview learners explicitly start the live classroom', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
      settingsDialogOpen: false,
    })

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(await screen.findByRole('button', { name: '我知道了' }, AI_RENDER_TIMEOUT))
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(await screen.findByRole('button', { name: '我知道了' }, AI_RENDER_TIMEOUT))

    {
      const startButtons = screen.getAllByRole('button', { name: '开始 AI 课堂' })
      fireEvent.click(startButtons[startButtons.length - 1])
    }

    const welcomeCard = await screen.findByTestId('classroom-welcome-card', undefined, AI_RENDER_TIMEOUT)
    expect(welcomeCard.textContent).toContain('共享额度已用完')
    expect(welcomeCard.textContent).toContain('刷新后会自动开始准备课堂')
    expect(welcomeCard.textContent).not.toContain('正在准备课堂')
    const useOwnKey = within(welcomeCard).getByRole('button', { name: '使用自己的 API Key' })
    expect(describedByText(useOwnKey)).toContain('使用自己的 API Key 可立刻继续')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    fireEvent.click(useOwnKey)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
    act(() => {
      useLLMConfigStore.getState().setSettingsDialogOpen(false)
    })
  })

  it('lets learners preview validated course content before configuring an API key', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })
    window.history.replaceState(null, '', '/zh/tour/ai?topic=cj.var.immutable')

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getAllByRole('heading', { name: '不可变绑定 let' }).length).toBeGreaterThan(0)
    screen.getByText('已验证教程内容')
    expect(screen.getByText(/内容版本/).textContent).toContain('2026-05-28')
    expect(screen.getAllByRole('link', { name: /打开来源教程/ }).some(link => link.getAttribute('href') === '/zh/tour/basics/1')).toBe(true)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('keeps preview navigation read-only until learners explicitly start the classroom', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })
    window.history.replaceState(null, '', '/zh/tour/ai?topic=cj.var.immutable')

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('tab', { name: '课堂' }))

    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    {
      const startButtons = screen.getAllByRole('button', { name: '开始 AI 课堂' })
      fireEvent.click(startButtons[startButtons.length - 1])
    }

    await screen.findByTestId('classroom-welcome-card', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('button', { name: '配置 AI 服务开始' })
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('starts classroom generation after a previewing learner completes AI service config', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: '课堂' }))

    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    {
      const startButtons = screen.getAllByRole('button', { name: '开始 AI 课堂' })
      fireEvent.click(startButtons[startButtons.length - 1])
    }

    await screen.findByTestId('classroom-welcome-card', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('button', { name: '配置 AI 服务开始' })
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    act(() => {
      useLLMConfigStore.getState().setConfig({
        provider: 'openai-compatible',
        baseURL: 'https://api.example.test/v1',
        apiKey: 'test-key',
        model: 'test-model',
      })
    })

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('在 main 中用 println 输出 Cangjie。')
    expect(runLessonGenerationStep).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ type: 'classroom_opened' }),
    }))
  })

  it('ignores unavailable topic links in preview mode and falls back to validated course content', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })
    window.history.replaceState(null, '', '/zh/tour/ai?topic=missing.topic')

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('heading', { name: '从已验证课程开始学习' })
    screen.getByText('链接里的主题不在已验证 AI 课堂内容中，已忽略该主题。')
    expect(screen.queryByText('missing.topic')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getAllByRole('heading', { name: '程序入口与 main' }).length).toBeGreaterThan(0)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('does not send unavailable topic ids to lesson generation', async () => {
    window.history.replaceState(null, '', '/zh/tour/ai?topic=missing.topic')

    renderApp()
    await enterClassroom(/开始 AI 课堂/)

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    const openingEvent = vi.mocked(runLessonGenerationStep).mock.calls.find(([args]) => args.event.type === 'classroom_opened')?.[0].event

    expect(openingEvent).toMatchObject({
      type: 'classroom_opened',
      summary: 'Classroom opened.',
    })
    expect(openingEvent).not.toHaveProperty('requestedConceptId')
  })

  it('renders reusable core content references and a template-backed exercise', async () => {
    renderApp()
    await enterClassroom()

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getAllByTestId('ai-classroom-root')).toHaveLength(1)
    expect(screen.getByTestId('ai-classroom-root').className).toContain('ai-classroom-viewport-root')
    expect(screen.getByTestId('ai-classroom-root').className).not.toContain('h-screen')
    const experienceRoot = screen.getByTestId('ai-classroom-experience-root')
    expect(experienceRoot.className).toContain('ai-classroom-viewport-root')
    expect(experienceRoot.className).not.toContain('h-screen')
    screen.getByText(/AI 课堂里的练习主要通过标准输出判断代码行为/)
    screen.getByText('在 main 中用 println 输出 Cangjie。')
    expect(screen.getByRole('link', { name: '打开对应教程' }).getAttribute('href')).toBe('/zh/tour/welcome/1')
    expect(screen.getByTestId('tour-editor').getAttribute('data-layout')).toBe('editorOnly')
    expect(screen.getByTestId('tour-editor').getAttribute('data-language-client')).toBe('true')
  })

  it('shows preparation progress while the initial classroom is still empty', async () => {
    let resolveGeneration: (() => void) | undefined
    vi.mocked(runLessonGenerationStep).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveGeneration = resolve
    }))

    renderApp()
    await enterClassroom()

    await screen.findByTestId('lesson-generation-progress-panel', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('正在连接课堂内容和练习规划，通常需要几秒。若长时间没有变化，请检查网络或 API 设置。')

    resolveGeneration?.()
  })

  it('explains that the empty first classroom is waiting for AI service setup', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })

    renderApp()
    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByTestId('classroom-landing-preview'))
    await screen.findByTestId('ai-classroom-header', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(within(screen.getByTestId('ai-classroom-header')).getByRole('button', { name: '开始 AI 课堂' }))

    const chat = await screen.findByRole('button', { name: '打开聊天' }, AI_RENDER_TIMEOUT) as HTMLButtonElement
    expect(chat.disabled).toBe(true)
    expect(chat.getAttribute('title')).toBe('请先完成 AI 服务配置；课堂准备完成后再打开聊天。')
    expect(describedByText(chat)).toBe('请先完成 AI 服务配置；课堂准备完成后再打开聊天。')
    screen.getByTestId('classroom-welcome-card')
    screen.getByText('配置 AI 服务开始')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('surfaces a recoverable waiting state when classroom preparation stalls', async () => {
    let resolveGeneration: (() => void) | undefined
    vi.mocked(runLessonGenerationStep).mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveGeneration = resolve
    }))

    renderApp()
    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /开始 AI 课堂/ }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    screen.getByTestId('lesson-generation-progress-panel')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LESSON_GENERATION_STALLED_AFTER_MS)
    })

    screen.getByText('等待 AI 响应')
    screen.getByText('AI 响应时间比预期更久。已生成内容不会丢失，你可以继续等待，或检查网络和 AI 设置。')

    resolveGeneration?.()
  })

  it('lets learners retry the first classroom preparation after it fails', async () => {
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(async ({ bridge, event }) => {
        if (event.type === 'classroom_opened')
          appendOpeningSlice(bridge)
      })

    renderApp()
    await enterClassroom()

    await screen.findByText('课堂准备失败', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('可以重试；如果持续失败，请检查网络、模型和 API Key 设置。')
    screen.getByRole('button', { name: '检查 AI 设置' })
    const intentBar = screen.getByTestId('classroom-intent-bar')
    screen.getByText('课堂准备失败。请先重试，或检查 AI 设置。')
    expect((within(intentBar).getByRole('button', { name: '继续下一步' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '重试准备课堂' }))

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
  })

  it('keeps initial topic entry from replacing the first preparation retry after failure', async () => {
    window.history.replaceState(null, '', '/zh/tour/ai?topic=cj.var.immutable')
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(async ({ bridge, event }) => {
        if (event.type === 'classroom_opened' && event.requestedConceptId === 'cj.var.immutable')
          appendNextSlice(bridge)
      })

    renderApp()
    await enterClassroom()

    await screen.findByRole('alert', { name: '课堂准备失败' }, AI_RENDER_TIMEOUT)
    const retryContext = screen.getByTestId('lesson-generation-retry-context')
    expect(retryContext.textContent).toContain('首次课堂准备')
    expect(retryContext.textContent).not.toContain('切换主题')

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '重试准备课堂' }))

    await screen.findByText('不可变绑定 let', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
    expect(vi.mocked(runLessonGenerationStep).mock.calls[1]?.[0].event).toMatchObject({
      type: 'classroom_opened',
      requestedConceptId: 'cj.var.immutable',
    })
  })

  it('clears the first classroom failure after a successful no-op retry', async () => {
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)

    renderApp()
    await enterClassroom()

    await screen.findByRole('alert', { name: '课堂准备失败' }, AI_RENDER_TIMEOUT)
    screen.getByTestId('classroom-stream-generation-error')

    fireEvent.click(screen.getByRole('button', { name: '重试准备课堂' }))

    await waitFor(() => {
      expect(screen.queryByRole('alert', { name: '课堂准备失败' })).toBeNull()
      expect(screen.queryByTestId('classroom-stream-generation-error')).toBeNull()
    }, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
  })

  it('does not keep the stale failure alert visible while a classroom retry is running', async () => {
    let resolveRetry: (() => void) | undefined
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(({ bridge, event }) => new Promise<void>((resolve) => {
        resolveRetry = () => {
          if (event.type === 'classroom_opened')
            appendOpeningSlice(bridge)
          resolve()
        }
      }))

    renderApp()
    await enterClassroom()

    await screen.findByRole('alert', { name: '课堂准备失败' }, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '重试准备课堂' }))

    await screen.findByText('正在准备课堂', undefined, AI_RENDER_TIMEOUT)
    expect(screen.queryByRole('alert', { name: '课堂准备失败' })).toBeNull()
    expect(screen.queryByTestId('classroom-stream-generation-error')).toBeNull()
    expect(screen.getByTestId('lesson-generation-progress-panel').textContent).toContain('正在准备课堂')

    await act(async () => {
      resolveRetry?.()
    })

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    expect(screen.queryByTestId('classroom-stream-generation-error')).toBeNull()
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
  })

  it('blocks retrying the first classroom preparation until AI service config is complete', async () => {
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(async ({ bridge, event }) => {
        if (event.type === 'classroom_opened')
          appendOpeningSlice(bridge)
      })

    renderApp()
    await enterClassroom()

    await screen.findByText('课堂准备失败', undefined, AI_RENDER_TIMEOUT)

    act(() => {
      useLLMConfigStore.getState().setConfig({
        provider: 'openai-compatible',
        baseURL: 'https://api.example.test/v1',
        apiKey: 'user-key',
        model: '',
      })
    })

    await screen.findByText('等待 AI 服务配置', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('完成 AI 服务配置后再重试。')
    let retry = screen.getByRole('button', { name: '重试准备课堂' }) as HTMLButtonElement
    expect(retry.disabled).toBe(true)

    fireEvent.click(retry)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)

    act(() => {
      useLLMConfigStore.getState().setConfig({
        provider: 'openai-compatible',
        baseURL: 'https://api.example.test/v1',
        apiKey: 'user-key',
        model: 'test-model',
      })
    })

    await waitFor(() => {
      retry = screen.getByRole('button', { name: '重试准备课堂' }) as HTMLButtonElement
      expect(retry.disabled).toBe(false)
    })

    fireEvent.click(retry)

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
  })

  it('blocks retrying the first classroom preparation while shared quota is exhausted', async () => {
    vi.mocked(runLessonGenerationStep).mockRejectedValueOnce(new Error('network'))

    renderApp()
    await enterClassroom()

    await screen.findByText('课堂准备失败', undefined, AI_RENDER_TIMEOUT)

    act(() => {
      useLLMConfigStore.setState({
        config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
        keySource: 'auto',
        autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
        settingsDialogOpen: false,
      })
    })

    await screen.findByText('等待共享额度', undefined, AI_RENDER_TIMEOUT)
    screen.getByText(/刷新后再重试，或改用自己的 API Key 立刻继续。/)
    fireEvent.click(screen.getByRole('button', { name: '我知道了' }))
    const retry = screen.getByRole('button', { name: '重试准备课堂' }) as HTMLButtonElement
    expect(retry.disabled).toBe(true)

    fireEvent.click(retry)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
  })

  it('automatically resumes the first classroom preparation after shared quota recovers', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: null,
      settingsDialogOpen: false,
    })
    let finishGeneration: (() => void) | undefined
    const generationRestarted = new Promise<void>((resolveRestarted) => {
      vi.mocked(runLessonGenerationStep)
        .mockRejectedValueOnce(new Error('insufficient_user_quota'))
        .mockImplementationOnce(async ({ bridge, event }) => {
          if (event.type === 'classroom_opened')
            appendOpeningSlice(bridge)
          resolveRestarted()
          await new Promise<void>((resolve) => {
            finishGeneration = resolve
          })
        })
    })

    renderApp()
    await enterClassroom()

    await screen.findByText('等待共享额度', undefined, AI_RENDER_TIMEOUT)
    screen.getByText(/刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。/)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)

    await act(async () => {
      useLLMConfigStore.getState().setAutoQuota({
        exhausted: false,
        nextResetAt: Date.now() + 60_000,
      })
    })

    await generationRestarted
    await screen.findByText('共享额度已恢复，课堂正在继续准备 AI 内容。', undefined, AI_RENDER_TIMEOUT)

    await act(async () => {
      finishGeneration?.()
    })

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    expect(screen.queryByRole('alert', { name: '课堂准备失败' })).toBeNull()
    expect(screen.queryByTestId('classroom-stream-generation-error')).toBeNull()
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
    expect(vi.mocked(runLessonGenerationStep).mock.calls[1]?.[0].event).toMatchObject({
      type: 'classroom_opened',
    })
  })

  it('does not start initial lesson generation when shared quota is already exhausted', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
      settingsDialogOpen: false,
    })

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    screen.getByText(/今日共享额度已用完/)
    screen.getByText(/使用自己的 API Key 可立刻继续/)
    fireEvent.click(screen.getByTestId('classroom-landing-primary'))

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
    expect(screen.queryByTestId('classroom-quota-banner')).toBeNull()
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('does not interrupt an existing classroom landing with the exhausted shared quota dialog', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
      settingsDialogOpen: false,
    })

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('button', { name: /继续上次课堂/ })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('今日 AI 额度已用完')).toBeNull()
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('keeps an existing classroom readable after entering with shared quota exhausted', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
      settingsDialogOpen: false,
    })

    renderApp()

    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByTestId('ai-classroom-content', undefined, AI_RENDER_TIMEOUT)
    screen.getByTestId('classroom-quota-banner')
    screen.getByText(/刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。/)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('今日 AI 额度已用完')).toBeNull()
  })

  it('opens the AI service settings dialog from the lightweight landing page', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByTestId('classroom-landing-primary'))

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
    await screen.findByRole('dialog', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('heading', { name: 'AI 服务设置' })
    screen.getByLabelText('API Key')
  })

  it('returns from AI service settings to a startable landing state after saving config', async () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: '',
    })

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByTestId('classroom-landing-primary'))

    await screen.findByRole('dialog', undefined, AI_RENDER_TIMEOUT)
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://api.example.test/v1' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'user-key' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'test-model' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    screen.getByRole('button', { name: /开始 AI 课堂/ })
    expect(screen.queryByRole('button', { name: /配置 AI 服务开始/ })).toBeNull()
  })

  it('keeps queued lesson generation waiting for a user key when shared quota is exhausted', async () => {
    const persisted = createCompletedPrintExerciseSession()
    await saveClassroomSession(persisted)
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
      settingsDialogOpen: false,
    })

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('等待共享额度', undefined, AI_RENDER_TIMEOUT)
    screen.getByText(/刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。/)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    act(() => {
      useLLMConfigStore.getState().setConfig({
        ...DEFAULT_LLM_CONFIG,
        apiKey: 'user-key',
        model: 'test-model',
      })
    })

    await screen.findByText('不可变绑定 let', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
  })

  it('announces automatic continuation after shared quota recovers for queued generation', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 60_000 },
      settingsDialogOpen: false,
    })
    let finishGeneration: (() => void) | undefined
    const generationStarted = new Promise<void>((resolve) => {
      vi.mocked(runLessonGenerationStep).mockImplementation(async () => {
        await new Promise<void>((finish) => {
          finishGeneration = finish
          resolve()
        })
      })
    })

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('等待共享额度', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    await act(async () => {
      useLLMConfigStore.getState().setAutoQuota({
        exhausted: false,
        nextResetAt: Date.now() + 60_000,
      })
    })

    await generationStarted
    await screen.findByText('共享额度已恢复，课堂正在继续准备 AI 内容。', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishGeneration?.()
    })
  })

  it('continues queued lesson generation after shared quota fails mid-run and the learner switches to a user key', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: null,
      settingsDialogOpen: false,
    })
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('insufficient_user_quota'))
      .mockImplementationOnce(async ({ bridge, event }) => {
        if (event.type === 'exercise_success')
          appendNextSlice(bridge)
      })

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('等待共享额度', undefined, AI_RENDER_TIMEOUT)
    screen.getByText(/刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。/)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('今日 AI 额度已用完')).toBeNull()

    act(() => {
      useLLMConfigStore.getState().setConfig({
        ...DEFAULT_LLM_CONFIG,
        apiKey: 'user-key',
        model: 'test-model',
      })
    })

    await screen.findByText('不可变绑定 let', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
    await waitFor(async () => {
      const saved = await loadClassroomSession('zh')
      expect(saved?.eventQueue).toEqual([])
    })
  })

  it('does not repeatedly auto-retry queued lesson generation after a regular failure', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    vi.mocked(runLessonGenerationStep).mockRejectedValue(new Error('network'))

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('这次 AI 生成失败', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('现有课堂内容仍可阅读；可以重试这次任务，或先继续复习已生成内容。')
    fireEvent.click(screen.getByRole('button', { name: '去复习已生成内容' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('heading', { name: '标准输出 println' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '查看准备进度' }))

    await screen.findByTestId('classroom-generation-focus-notice', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('已回到课堂准备状态。可以继续等待、重试或检查 AI 设置。')
    expect(screen.getByRole('tab', { name: /课堂/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('classroom-stream-footer').textContent).toContain('这次 AI 生成失败')
    const intentStatus = screen.getByTestId('classroom-intent-external-status')
    expect(intentStatus.textContent).toBe('练习已记录，但下一步准备失败。请先重试这次任务。')
    expect(intentStatus.textContent).not.toContain('正在处理上一条请求')
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
  })

  it('clears failure recovery UI and shows the next step after manually retrying a queued generation', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    vi.mocked(runLessonGenerationStep)
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(async ({ bridge, event }) => {
        if (event.type === 'exercise_success')
          appendNextSlice(bridge)
      })

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('这次 AI 生成失败', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('button', { name: '重试这次任务' }))

    await screen.findByText('不可变绑定 let', undefined, AI_RENDER_TIMEOUT)
    expect(screen.queryByText('这次 AI 生成失败')).toBeNull()
    expect(screen.queryByTestId('classroom-stream-generation-error')).toBeNull()
    expect(screen.queryByTestId('classroom-intent-external-status')).toBeNull()
    expect(screen.getByTestId('classroom-stream-footer').contains(screen.getByTestId('classroom-intent-bar'))).toBe(true)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(2)
    await waitFor(async () => {
      const saved = await loadClassroomSession('zh')
      expect(saved?.eventQueue).toEqual([])
    })
  })

  it('keeps queued lesson generation waiting until the AI service config is complete', async () => {
    const persisted = createCompletedPrintExerciseSession()
    await saveClassroomSession(persisted)
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'user-key',
      model: '',
    })

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('等待 AI 服务配置', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('请先完成 AI 服务配置后继续准备下一步。')
    expect(runLessonGenerationStep).not.toHaveBeenCalled()

    act(() => {
      useLLMConfigStore.getState().setConfig({
        provider: 'openai-compatible',
        baseURL: 'https://api.example.test/v1',
        apiKey: 'user-key',
        model: 'test-model',
      })
    })

    await screen.findByText('不可变绑定 let', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).toHaveBeenCalledTimes(1)
  })

  it('submitting a successful exercise records evidence and advances via queued orchestration', async () => {
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: '',
      compiler_code: 0,
      bin_output: 'Cangjie\n',
      bin_code: 0,
    })
    renderApp()
    await enterClassroom()
    await screen.findByText('在 main 中用 println 输出 Cangjie。', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await screen.findByText('提交结果：正确', undefined, AI_RENDER_TIMEOUT)
    await screen.findByText('练习完成已记录', undefined, AI_RENDER_TIMEOUT)
    await screen.findByText('不可变绑定 let', undefined, AI_RENDER_TIMEOUT)
    const footer = screen.getByTestId('classroom-stream-footer')
    expect(footer.contains(screen.getByTestId('classroom-intent-bar'))).toBe(true)
    await waitFor(() => expect(runLessonGenerationStep).toHaveBeenCalledTimes(2))
    await waitFor(async () => {
      const saved = await loadClassroomSession('zh')
      expect(saved?.eventQueue).toEqual([])
      expect(saved?.learner.evidence[0]).toMatchObject({
        outcome: 'success',
        skillId: 'cj.io.println.print-value',
      })
    })
  })

  it('shows visible AI feedback preparation after a failed submit', async () => {
    let resolveFailureGeneration: (() => void) | undefined
    const failureGenerationStarted = new Promise<void>((resolve) => {
      vi.mocked(runLessonGenerationStep).mockImplementation(async ({ bridge, event }) => {
        if (event.type === 'classroom_opened') {
          appendOpeningSlice(bridge)
          return
        }
        if (event.type === 'exercise_failure') {
          resolve()
          await new Promise<void>((finish) => {
            resolveFailureGeneration = finish
          })
        }
      })
    })
    vi.mocked(requestRemoteAction).mockResolvedValueOnce({
      compiler_output: '',
      compiler_code: 0,
      bin_output: 'wrong\n',
      bin_code: 0,
    })

    renderApp()
    await enterClassroom()
    await screen.findByText('在 main 中用 println 输出 Cangjie。', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await screen.findByText('提交结果：错误', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('这次提交未通过，已记录为练习证据。AI 会准备针对性提示；你也可以先修改代码后重新提交。')
    await failureGenerationStarted
    const status = await screen.findByTestId('classroom-intent-external-status', undefined, AI_RENDER_TIMEOUT)
    expect(status.textContent).toBe('这次提交已记录，AI 正在准备针对性提示；你可以先继续修改代码。')
    expect(screen.getByTestId('classroom-stream-footer').textContent).toContain('课堂准备进度')
    expect(runLessonGenerationStep).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        type: 'exercise_failure',
        exerciseIntent: 'mainline',
      }),
    }))

    resolveFailureGeneration?.()
  })

  it('opens review view without duplicating raw chat into progress state', async () => {
    renderApp()
    await enterClassroom()
    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('tab', { name: /复习/ }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('个人笔记')
    expect(screen.getAllByText('标准输出 println').length).toBeGreaterThan(0)
    expect(screen.queryByText(/raw chat/i)).toBeNull()
  })

  it('opens concept-scoped chat from review view', async () => {
    renderApp()
    await enterClassroom()
    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('tab', { name: /复习/ }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    const chatTrigger = screen.getByRole('button', { name: /围绕此概念聊天/ })
    chatTrigger.focus()
    fireEvent.click(chatTrigger)

    expect((await screen.findByTestId('chat-panel', undefined, AI_RENDER_TIMEOUT)).textContent).toBe('cj.io.println')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭聊天' }))

    fireEvent.click(screen.getByRole('button', { name: '关闭聊天' }))

    await waitFor(() => expect(document.activeElement).toBe(chatTrigger))
  })

  it('returns from Review View to the active exercise with a visible recovery target', async () => {
    renderApp()
    await enterClassroom()
    await screen.findByText('在 main 中用 println 输出 Cangjie。', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('tab', { name: /复习/ }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)

    screen.getByText('先完成、跳过或提交当前练习，再使用复习页操作。')
    fireEvent.click(screen.getByRole('button', { name: '查看当前练习' }))

    await screen.findByTestId('exercise-focus-notice', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('已回到当前练习。完成、跳过或提交后再继续复习。')
    expect(screen.getByRole('tab', { name: /课堂/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('classroom-review-view')).toBeNull()
  })

  it('returns from the progress panel next step to the active exercise instead of review', async () => {
    renderApp()
    await enterClassroom()
    await screen.findByText('在 main 中用 println 输出 Cangjie。', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))
    const panel = await screen.findByTestId('classroom-concept-panel-content', undefined, AI_RENDER_TIMEOUT)
    const nextStep = await within(panel).findByTestId('concept-panel-next-step', undefined, AI_RENDER_TIMEOUT)
    expect(nextStep.textContent).toContain('标准输出 println')
    expect(nextStep.textContent).toContain('继续当前练习')
    expect(within(nextStep).queryByRole('button', { name: '打开下一步复习 标准输出 println' })).toBeNull()

    fireEvent.click(within(nextStep).getByRole('button', { name: '回到当前练习 标准输出 println' }))

    await screen.findByTestId('exercise-focus-notice', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('已回到当前练习。完成、跳过或提交后再继续复习。')
    expect(screen.getByRole('tab', { name: /课堂/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('classroom-review-view')).toBeNull()
    await waitForProgressPanelToClose()
  })

  it('returns from a ready review concept to the live continue controls', async () => {
    await saveClassroomSession(createCompletedPrintExerciseSession())
    vi.mocked(runLessonGenerationStep).mockImplementation(async () => undefined)

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByTestId('classroom-intent-bar', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('tab', { name: /复习/ }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('button', { name: '返回课堂继续' }))

    await screen.findByTestId('classroom-continue-focus-notice', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('已回到课堂。可以用下方操作继续下一步、放慢节奏或提问。')
    expect(screen.getByRole('tab', { name: /课堂/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('classroom-review-view')).toBeNull()
    expect(screen.getByTestId('classroom-stream-footer').textContent).toContain('继续下一步')
  })

  it('returns from a recorded review check card to the focused review concept', async () => {
    await saveClassroomSession(createCompletedReviewCheckSession())
    vi.mocked(runLessonGenerationStep).mockImplementation(async () => undefined)

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByTestId('exercise-review-return', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('复习检查已记录')
    fireEvent.click(screen.getByRole('button', { name: '查看复习进度' }))

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('exercise-review-return')).toBeNull()
    expect(screen.getAllByRole('heading', { name: '标准输出 println' }).length).toBeGreaterThan(0)
    expect(screen.getByTestId('classroom-review-focus-notice').textContent).toContain('已打开 标准输出 println 的复习。')
    screen.getByText('最近一次复习检查独立通过，已作为掌握证据记录。')
    screen.getByText('可以继续下一步')
    const reviewHeading = screen.getByRole('main', { name: '标准输出 println' }).querySelector('h2')
    await waitFor(() => expect(document.activeElement).toBe(reviewHeading))

    fireEvent.click(screen.getByRole('button', { name: '返回课堂继续' }))

    await screen.findByTestId('classroom-continue-focus-notice', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('已回到课堂。可以用下方操作继续下一步、放慢节奏或提问。')
    expect(screen.getByRole('tab', { name: /课堂/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('classroom-review-view')).toBeNull()
    expect(screen.getByTestId('classroom-stream-footer').textContent).toContain('继续下一步')
  })

  it('focuses classroom preparation after starting a review action from Review View', async () => {
    await saveClassroomSession(createBlockedMainWithActivePrintSession())
    let resolveGeneration: (() => void) | undefined
    const generationStarted = new Promise<void>((resolve) => {
      vi.mocked(runLessonGenerationStep).mockImplementation(async () => {
        resolve()
        await new Promise<void>((finish) => {
          resolveGeneration = finish
        })
      })
    })

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    fireEvent.click(screen.getByRole('tab', { name: /复习/ }))
    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)

    fireEvent.click(screen.getByRole('button', { name: /程序入口与 main/ }))
    screen.getByText('先查看提示，再重新提交')
    fireEvent.click(screen.getByRole('button', { name: '请求针对性提示' }))

    await generationStarted
    await screen.findByTestId('classroom-generation-focus-notice', undefined, AI_RENDER_TIMEOUT)
    screen.getByText('已回到课堂准备状态。可以继续等待、重试或检查 AI 设置。')
    expect(screen.getByRole('tab', { name: /课堂/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('classroom-review-view')).toBeNull()
    expect(screen.getByTestId('classroom-stream-footer').textContent).toContain('课堂准备进度')
    expect(runLessonGenerationStep).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        type: 'chat_intent',
        intent: 'explain_error',
      }),
    }))

    resolveGeneration?.()
  })

  it('opens the focused review concept from the progress panel next step', async () => {
    await saveClassroomSession(createBlockedMainWithActivePrintSession())

    renderApp()
    fireEvent.click(await screen.findByTestId('classroom-landing-primary', undefined, AI_RENDER_TIMEOUT))

    await screen.findByText('标准输出 println', undefined, AI_RENDER_TIMEOUT)
    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.textContent).toContain('待处理')

    await openProgressPanelNextStep('程序入口与 main')

    await screen.findByTestId('classroom-review-view', undefined, AI_RENDER_TIMEOUT)
    expect(screen.getByRole('tab', { name: /复习/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('heading', { name: '程序入口与 main' }).length).toBeGreaterThan(0)
    expect(screen.getByTestId('classroom-review-focus-notice').textContent).toContain('已打开 程序入口与 main 的复习。')
    const reviewHeading = screen.getByRole('main', { name: '程序入口与 main' }).querySelector('h2')
    await waitFor(() => expect(document.activeElement).toBe(reviewHeading))
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
    })
  })

  it('hydrates persisted classroom state before deciding whether to run classroom_opened', async () => {
    const persisted = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading'],
      now: 901,
    })
    await saveClassroomSession(persisted)
    useExerciseDraftStore.getState().setDraft('exercise:stale', 'old draft')
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:stale',
      code: 'old suggestion',
      explanation: 'stale',
      createdAt: 1,
    })
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:stale', 2)
    useScrollWatermarkStore.getState().setWatermark('zh', 4)
    useScrollWatermarkStore.getState().setWatermark('en', 2)

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /继续上次课堂/ }))
    await screen.findByText('程序入口与 main', undefined, AI_RENDER_TIMEOUT)
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
  })

  it('lets learners reset a persisted classroom from the landing page before entering', async () => {
    const persisted = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading'],
      now: 901,
    })
    await saveClassroomSession(persisted)

    renderApp()

    await screen.findByTestId('classroom-landing-page', undefined, AI_RENDER_TIMEOUT)
    screen.getByRole('button', { name: /继续上次课堂/ })

    fireEvent.click(screen.getByRole('button', { name: '重新开始' }))

    screen.getByText('清除上次课堂并重新开始？')
    fireEvent.click(screen.getByRole('button', { name: '确认重新开始' }))

    await screen.findByRole('button', { name: /开始 AI 课堂/ }, AI_RENDER_TIMEOUT)
    expect(screen.queryByRole('button', { name: /继续上次课堂/ })).toBeNull()
    expect(runLessonGenerationStep).not.toHaveBeenCalled()
    expect(useExerciseDraftStore.getState().drafts).toEqual({})
    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
    expect(useCodeSuggestionStore.getState().appliedAssistanceByExerciseId).toEqual({})
    expect(useScrollWatermarkStore.getState().watermarks).toEqual({})

    await waitFor(async () => {
      await expect(loadClassroomSession('zh')).resolves.toBeNull()
    })
  })
})
