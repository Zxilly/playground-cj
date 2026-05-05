/* eslint-disable react/component-hook-factories */
import 'fake-indexeddb/auto'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TourAIApp from '@/features/tour-ai/components/TourAIApp'
import { LessonAuthorProgressPanel } from '@/features/tour-ai/components/LessonAuthorProgressPanel'
import type { FlatSection } from '@/tour/types'
import { clearClassroomSession } from '@/lib/ai/classroom/persistence'
import { useLLMConfigStore } from '@/stores/llmConfig'

vi.mock('next/font/local', () => ({
  default: () => ({ style: { fontFamily: 'MockFont' } }),
}))

vi.mock('@/features/tour/components/TourEditor', () => ({
  TourEditor: ({ code }: { code: string }) => (
    <div data-testid="tour-editor">{code || 'empty editor'}</div>
  ),
}))

vi.mock('@/features/tour-ai/components/TourAIChat', () => ({
  TourAIChat: () => <div data-testid="chat-agent">ChatAgent</div>,
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

vi.mock('@/lib/ai/lesson-author-runner', () => ({
  runLessonAuthorStep: vi.fn(async ({ bridge, event }) => {
    if (event.type !== 'page_opened')
      return
    bridge.classroom?.dispatch({
      type: 'APPEND_LESSON_CONTENT',
      blocks: [{ type: 'heading', text: 'Unified classroom', level: 2 }],
      now: 1001,
    })
    bridge.classroom?.dispatch({
      type: 'SET_CURRENT_QUIZ',
      quiz: {
        type: 'quiz',
        conceptId: 'cj.design.quiz',
        prompt: [{ text: 'Print 3.' }],
        starterCode: 'main() {\n    println(0)\n}',
        expectedOutput: '3',
        matchMode: 'exact',
      },
      now: 1002,
    })
  }),
}))

const flatSection: FlatSection = {
  chapterId: '02-basics',
  chapterSlug: 'basics',
  chapterStep: '1',
  chapterName: { zh: '基础', en: 'Basics' },
  subChapterId: '01-bindings',
  subChapterName: { zh: '变量绑定', en: 'Bindings' },
  sectionId: '01',
  sectionName: { zh: 'let 与 var', en: 'let and var' },
  markdown: {
    zh: '# let 与 var',
    en: '# let and var',
  },
  code: {
    zh: 'main() {\n    println(0)\n}',
    en: 'main() {\n    println(0)\n}',
  },
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

describe('aiClassroomDesign', () => {
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
  })

  afterEach(async () => {
    cleanup()
    await clearClassroomSession('zh')
    useLLMConfigStore.getState().reset()
  })

  it('renders classroom surfaces with shared ai-classroom design classes', async () => {
    render(
      <Wrapper>
        <TourAIApp lang="zh" allSections={[flatSection]} />
      </Wrapper>,
    )

    await screen.findByText('Unified classroom')
    expect(screen.getByTestId('ai-classroom-root').className).toContain('ai-classroom-root')
    expect(screen.getByTestId('ai-classroom-header').className).toContain('ai-classroom-header')
    expect(screen.getByTestId('quiz-practice-card').className).toContain('ai-classroom-surface-accent')
  })

  it('renders author progress with the same design system surface language', () => {
    render(
      <LessonAuthorProgressPanel
        visible
        progress={{ status: 'running', expanded: true, text: '生成课程' }}
        onToggle={() => {}}
      />,
    )

    expect(screen.getByTestId('lesson-author-progress-panel').className).toContain('ai-classroom-surface')
    expect(screen.getByRole('button', { name: /LessonAuthor 编写进度/ }).className).toContain('ai-classroom-disclosure')
  })
})
