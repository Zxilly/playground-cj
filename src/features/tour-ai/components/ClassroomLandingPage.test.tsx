import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { ClassroomLandingPage } from './ClassroomLandingPage'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { useKnownLanguagesStore } from '@/stores/knownLanguages'

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
  return ids
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

describe('classroomLandingPage', () => {
  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().reset()
    useLLMConfigStore.getState().setSettingsDialogOpen(false)
    useKnownLanguagesStore.setState({ knownLanguages: [] })
  })

  it('keeps header actions usable on narrow screens', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        sourceHref="/zh/tour/welcome/1"
        onEnter={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    const header = screen.getByTestId('classroom-landing-header')
    const page = screen.getByTestId('classroom-landing-page')
    const main = page.querySelector('main')
    const intro = main?.firstElementChild as HTMLElement | null
    expect(page.className).toContain('ai-classroom-viewport-root')
    expect(page.className).not.toContain('h-screen')
    expect(main?.className).toContain('overflow-y-auto')
    expect(intro?.className.split(/\s+/)).not.toContain('min-h-0')
    expect(intro?.className).toContain('lg:min-h-0')
    expect(header.className).toContain('flex-wrap')
    expect(header.className).toContain('sm:flex-nowrap')

    const actions = screen.getByRole('link', { name: '查看对应教程' }).parentElement
    expect(actions?.className).toContain('overflow-x-auto')
    const sourceLink = screen.getByRole('link', { name: '查看对应教程' })
    expect(sourceLink.className).toContain('shrink-0')
    expect(sourceLink.getAttribute('title')).toBe('打开对应静态教程；不会改变 AI 课堂进度。')
    expect(sourceLink.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    const settings = screen.getByRole('button', { name: '配置 AI 服务' })
    expect(settings.className).toContain('shrink-0')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂或排队新的 AI 请求。')
    expect(settings.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(describedByText(settings)).toContain('完成服务地址、API Key 和模型配置后即可开始。')
  })

  it('opens settings from the primary action when no API key is configured', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    const primary = screen.getByTestId('classroom-landing-primary')
    screen.getByRole('heading', { name: '从已验证课程开始学习' })
    expect(describedByText(primary)).toContain('完成服务地址、API Key 和模型配置后即可开始。')
    expect(primary.getAttribute('title')).toBe('打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂或排队新的 AI 请求。')

    fireEvent.click(primary)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('requires a complete AI service config before starting a new classroom', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })
    const onEnter = vi.fn()

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={onEnter}
      />,
      { wrapper: Wrapper },
    )

    const primary = screen.getByTestId('classroom-landing-primary')
    expect(describedByText(primary)).toContain('完成服务地址、API Key 和模型配置后即可开始。')
    expect(primary.getAttribute('title')).toBe('打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂或排队新的 AI 请求。')

    fireEvent.click(primary)

    expect(onEnter).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
    screen.getByText('完成服务地址、API Key 和模型配置后即可开始。')
  })

  it('lets configured learners preview the validated course before starting', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    const onPreview = vi.fn()

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={vi.fn()}
        onPreview={onPreview}
      />,
      { wrapper: Wrapper },
    )

    const preview = screen.getByTestId('classroom-landing-preview')
    expect(describedByText(preview)).toBe('预览只展示已验证课程内容，不会启动 AI 生成、聊天或记录学习进度。')
    expect(preview.getAttribute('title')).toBe('打开预览视图，只查看已验证课程内容；不会启动 AI 生成、聊天或记录学习进度。')
    screen.getByText('预览只展示已验证课程内容，不会启动 AI 生成、聊天或记录学习进度。')

    fireEvent.click(preview)

    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: '配置 AI 服务' })).toBeNull()
  })

  it('surfaces static tutorial language background before starting', () => {
    useKnownLanguagesStore.setState({ knownLanguages: ['python', 'java'] })
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={vi.fn()}
        onPreview={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    screen.getByText(/会参考你在教程里选择的对比语言：/)
    screen.getByText(/Python, Java/)
    screen.getByText(/不会直接记录为学习进度。/)
  })

  it('uses compiled English copy for landing preview and progress policy', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={vi.fn()}
        onPreview={vi.fn()}
      />,
      { wrapper: EnWrapper },
    )

    screen.getByRole('heading', { name: 'Start from validated course content' })

    const primary = screen.getByTestId('classroom-landing-primary')
    expect(primary.getAttribute('title')).toBe(
      'Start AI Classroom and prepare the first step. Learning progress, exercise results, and review content will be recorded afterward.',
    )

    const preview = screen.getByTestId('classroom-landing-preview')
    expect(describedByText(preview)).toBe(
      'Preview only shows validated course content. It will not start AI generation, chat, or learning progress recording.',
    )
    expect(preview.getAttribute('title')).toBe(
      'Open preview mode to view validated course content only. It will not start AI generation, chat, or learning progress recording.',
    )
    expect(screen.queryByText('预览只展示已验证课程内容，不会启动 AI 生成、聊天或记录学习进度。')).toBeNull()

    const progressCard = screen.getByText('Progress', { selector: 'span' }).closest('section')
    expect(progressCard).toBeTruthy()
    expect(progressCard?.textContent).toContain(
      'Progress comes from viewed content, exercise submissions, and review checks. Chat Q&A does not directly determine mastery.',
    )
    expect(progressCard?.textContent).not.toContain('进度来自已看内容')
  })

  it('keeps English landing actions mobile-safe with long topic text', () => {
    const longTopicTitle = 'very-long-english-topic-title-without-natural-breaks-ai-classroom-validated-course-preview'
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        topicTitle={longTopicTitle}
        onEnter={vi.fn()}
        onPreview={vi.fn()}
      />,
      { wrapper: EnWrapper },
    )

    const page = screen.getByTestId('classroom-landing-page')
    expect(page.className).toContain('ai-classroom-viewport-root')
    expect(page.className).not.toContain('h-screen')

    const topic = screen.getByText(longTopicTitle)
    expect(topic.className).toContain('break-words')
    expect(topic.parentElement?.className).toContain('max-w-full')

    const heading = screen.getByRole('heading', { name: 'Start learning from the current topic' })
    expect(heading.className).toContain('break-words')
    expect(screen.getByText(/AI Classroom uses validated tutorial content/).className).toContain('break-words')

    const primary = screen.getByTestId('classroom-landing-primary')
    expect(primary).toBe(screen.getByRole('button', { name: 'Start AI Classroom' }))
    expect(primary.className).toContain('max-w-full')
    expect(primary.querySelector('span')?.className).toContain('break-words')
    expect(primary.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')

    const preview = screen.getByTestId('classroom-landing-preview')
    expect(preview).toBe(screen.getByRole('button', { name: 'Preview course content first' }))
    expect(preview.className).toContain('max-w-full')
    expect(preview.querySelector('span')?.className).toContain('break-words')
    expect(preview.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(screen.getByText(/Preview only shows validated course content/).className).toContain('break-words')

    const progressCard = screen.getByText('Progress', { selector: 'span' }).closest('section')
    expect(progressCard?.className).toContain('min-w-0')
    expect(progressCard?.textContent).toContain('Chat Q&A does not directly determine mastery.')
  })

  it('wraps long landing content instead of forcing mobile overflow', () => {
    const longTopicTitle = 'very-long-topic-title-without-natural-breaks-cj-program-main-entrypoint-and-validated-course-pack'
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        topicTitle={longTopicTitle}
        topicUnavailable
        onEnter={vi.fn()}
        onPreview={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    const topic = screen.getByText(longTopicTitle)
    expect(topic.className).toContain('min-w-0')
    expect(topic.className).toContain('break-words')
    expect(topic.parentElement?.className).toContain('max-w-full')
    expect(topic.parentElement?.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')

    const heading = screen.getByRole('heading', { name: '从已验证课程开始学习' })
    expect(heading.className).toContain('break-words')
    expect(screen.getByText('链接里的主题不在已验证 AI 课堂内容中，已忽略该主题。').className).toContain('break-words')
    expect(screen.getByText(/AI 课堂会使用已验证的教程内容组织讲解/).className).toContain('break-words')

    const primary = screen.getByTestId('classroom-landing-primary')
    expect(primary.className).toContain('max-w-full')
    expect(primary.querySelector('span')?.className).toContain('break-words')
    expect(primary.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')

    const preview = screen.getByTestId('classroom-landing-preview')
    expect(preview.className).toContain('max-w-full')
    expect(preview.querySelector('span')?.className).toContain('break-words')
    expect(screen.getByText('预览只展示已验证课程内容，不会启动 AI 生成、聊天或记录学习进度。').className).toContain('break-words')

    expect(screen.getByText('学习').className).toContain('break-words')
    expect(screen.getByText('阅读当前主题的讲解，并按进度继续后续内容。').className).toContain('break-words')
  })

  it('states that progress is derived from classroom evidence before starting', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    const progressCard = screen.getByText('进度').closest('section')
    expect(progressCard).toBeTruthy()
    expect(progressCard?.textContent).toContain('进度来自已看内容、练习提交和复习检查；聊天答疑不会直接判定掌握。')
    expect(progressCard?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps new classroom entry on the landing page when shared quota is exhausted', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })
    const onEnter = vi.fn()
    const onPreview = vi.fn()

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        onEnter={onEnter}
        onPreview={onPreview}
      />,
      { wrapper: Wrapper },
    )

    screen.getByText(/今日共享额度已用完/)
    screen.getByText(/使用自己的 API Key 可立刻继续/)
    const primary = screen.getByTestId('classroom-landing-primary')
    expect(describedByText(primary)).toContain('今日共享额度已用完，暂时无法准备新的课堂内容。')
    expect(describedByText(primary)).toContain('使用自己的 API Key 可立刻继续。')
    expect(primary.getAttribute('title')).toContain('打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会进入课堂或排队新的 AI 请求。')
    expect(primary.getAttribute('title')).toContain('共享额度下次刷新：')
    for (const action of screen.getAllByRole('button', { name: '使用自己的 API Key' })) {
      expect(describedByText(action)).toContain('今日共享额度已用完，暂时无法准备新的课堂内容。')
      expect(action.getAttribute('title')).toContain('改用自己的 API Key 后可立刻继续')
    }

    fireEvent.click(primary)

    expect(onEnter).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)

    const preview = screen.getByTestId('classroom-landing-preview')
    expect(describedByText(preview)).toBe('预览只展示已验证课程内容，不会启动 AI 生成、聊天或记录学习进度。')
    expect(preview.getAttribute('title')).toBe('打开预览视图，只查看已验证课程内容；不会启动 AI 生成、聊天或记录学习进度。')
    fireEvent.click(preview)
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  it('keeps an existing classroom accessible while surfacing incomplete AI service recovery', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: '',
      model: 'test-model',
    })
    const onEnter = vi.fn()

    render(
      <ClassroomLandingPage
        hasClassroomSession
        onEnter={onEnter}
        onResetSession={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    screen.getByText('AI 服务配置未完成，已保存的课堂仍可查看。')
    screen.getByText('继续上次课堂可回看已有内容；聊天、生成下一步和复习检查需要先配置可用服务。')

    const primary = screen.getByTestId('classroom-landing-primary')
    expect(describedByText(primary)).toContain('已保存的课堂仍可查看')
    expect(primary.getAttribute('title')).toContain('继续打开已保存课堂；已有内容、复习内容和练习记录会保留。')
    expect(primary.getAttribute('title')).toContain('需要先完成 AI 服务配置')
    fireEvent.click(primary)
    expect(onEnter).toHaveBeenCalledTimes(1)

    const settings = screen.getByRole('button', { name: '配置 AI 服务' })
    expect(describedByText(settings)).toContain('聊天、生成下一步和复习检查需要先配置可用服务')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂或排队新的 AI 请求。')
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('keeps an existing classroom accessible while surfacing shared quota recovery', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })
    const onEnter = vi.fn()

    render(
      <ClassroomLandingPage
        hasClassroomSession
        onEnter={onEnter}
        onResetSession={vi.fn()}
      />,
      { wrapper: Wrapper },
    )

    screen.getByText('共享额度已用完，已保存的课堂仍可查看。')
    screen.getByText(/继续上次课堂可回看已有内容；聊天、生成下一步和复习检查需要等待额度刷新/)

    const primary = screen.getByTestId('classroom-landing-primary')
    expect(describedByText(primary)).toContain('已保存的课堂仍可查看')
    expect(primary.getAttribute('title')).toContain('继续打开已保存课堂；已有内容、复习内容和练习记录会保留。')
    expect(primary.getAttribute('title')).toContain('新的 AI 内容需要等待额度刷新或使用自己的 API Key')
    fireEvent.click(primary)
    expect(onEnter).toHaveBeenCalledTimes(1)

    const settings = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(describedByText(settings)).toContain('使用自己的 API Key')
    expect(settings.getAttribute('title')).toContain('打开 AI 服务设置，改用自己的 API Key 后可立刻继续')
    expect(settings.getAttribute('title')).toContain('不会进入课堂或排队新的 AI 请求')
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for saved classroom service recovery', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })
    const onEnter = vi.fn()

    render(
      <ClassroomLandingPage
        hasClassroomSession
        onEnter={onEnter}
        onResetSession={vi.fn()}
      />,
      { wrapper: EnWrapper },
    )

    screen.getByText('Shared quota is exhausted. Your saved classroom is still viewable.')
    screen.getByText(/Continue your previous classroom to review existing content; chat, next-step generation, and review checks need to wait for quota refresh/)
    const primary = screen.getByTestId('classroom-landing-primary')
    expect(describedByText(primary)).toContain('Your saved classroom is still viewable')
    expect(primary.getAttribute('title')).toBe('Continue opening the saved classroom. Existing content, review content, and practice records will be kept. New AI content must wait for quota refresh or use your own API Key.')
    fireEvent.click(primary)
    expect(onEnter).toHaveBeenCalledTimes(1)

    const settings = screen.getByRole('button', { name: 'Use your own API Key' })
    expect(settings.getAttribute('title')).toContain('Open AI service settings and switch to your own API Key to continue immediately.')
    expect(settings.getAttribute('title')).toContain('This will not enter the classroom or queue a new AI request.')
    expect(document.body.textContent).not.toContain('共享额度已用完')
  })

  it('confirms before clearing an existing classroom session', () => {
    const onResetSession = vi.fn()
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession
        onEnter={vi.fn()}
        onResetSession={onResetSession}
      />,
      { wrapper: Wrapper },
    )

    const resetButton = screen.getByRole('button', { name: '重新开始' })
    expect(resetButton.getAttribute('title')).toBe('打开重新开始确认框；确认前不会删除本机保存的 AI 课堂进度、复习内容或练习记录。')
    fireEvent.click(resetButton)

    expect(onResetSession).not.toHaveBeenCalled()
    const confirmation = screen.getByRole('group', { name: '清除上次课堂并重新开始？' })
    expect(confirmation).toBe(screen.getByTestId('classroom-reset-confirmation'))
    expect(confirmation.getAttribute('aria-describedby')).toBeTruthy()
    expect(describedByText(confirmation)).toBe('这会删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。')
    screen.getByText('清除上次课堂并重新开始？')
    screen.getByText('这会删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。')

    const keepRecord = screen.getByRole('button', { name: '保留记录' })
    expect(document.activeElement).toBe(keepRecord)
    expect(keepRecord.getAttribute('title')).toBe('关闭确认框并保留上次课堂记录。')
    expect(describedByText(keepRecord)).toBe('这会删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。')

    fireEvent.click(keepRecord)

    expect(screen.queryByTestId('classroom-reset-confirmation')).toBeNull()
    expect(document.activeElement).toBe(resetButton)
    expect(onResetSession).not.toHaveBeenCalled()

    fireEvent.click(resetButton)
    const confirmReset = screen.getByRole('button', { name: '确认重新开始' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '保留记录' }))
    expect(confirmReset.getAttribute('title')).toBe('确认删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。')
    expect(describedByText(confirmReset)).toBe('这会删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。')
    fireEvent.click(confirmReset)

    expect(onResetSession).toHaveBeenCalledTimes(1)
  })

  it('cancels the reset confirmation with Escape and restores focus', () => {
    const onResetSession = vi.fn()
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })

    render(
      <ClassroomLandingPage
        hasClassroomSession
        onEnter={vi.fn()}
        onResetSession={onResetSession}
      />,
      { wrapper: Wrapper },
    )

    const resetButton = screen.getByRole('button', { name: '重新开始' })
    fireEvent.click(resetButton)
    const confirmation = screen.getByRole('group', { name: '清除上次课堂并重新开始？' })

    fireEvent.keyDown(confirmation, { key: 'Escape' })

    expect(screen.queryByTestId('classroom-reset-confirmation')).toBeNull()
    expect(document.activeElement).toBe(resetButton)
    expect(onResetSession).not.toHaveBeenCalled()
  })

  it('surfaces save/reset failures on the landing page and lets learners retry', async () => {
    const retry = createDeferred()
    const onRetrySave = vi.fn(() => retry.promise)

    render(
      <ClassroomLandingPage
        hasClassroomSession={false}
        saveIssue="failed"
        onEnter={vi.fn()}
        onRetrySave={onRetrySave}
      />,
      { wrapper: Wrapper },
    )

    screen.getByText('当前学习进度暂时无法保存。')
    screen.getByText('你可以继续学习；刷新或关闭页面前，请先重新尝试保存。')

    fireEvent.click(screen.getByRole('button', { name: '重新尝试保存' }))

    expect(onRetrySave).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: '正在保存...' }) as HTMLButtonElement).disabled).toBe(true)

    retry.resolve()
    await waitFor(() => {
      expect((screen.getByRole('button', { name: '重新尝试保存' }) as HTMLButtonElement).disabled).toBe(false)
    })
  })
})
