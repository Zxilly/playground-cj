/* eslint-disable react/component-hook-factories */
import type { ReactNode } from 'react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassroomHeader } from './ClassroomHeader'
import { ClassroomSessionProvider } from '@/features/tour-ai/context/classroom-session-context'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { useLLMConfigStore } from '@/stores/llmConfig'

vi.mock('@/modules/llm-config/components/LLMConfigDialog', () => ({
  LLMConfigDialog: () => null,
}))

vi.mock('@/features/tour-ai/components/ClassroomConceptPanel', () => ({
  ClassroomConceptPanel: () => <button type="button">进度</button>,
}))

vi.mock('@/features/tour-ai/components/ClassroomThemeToggle', () => ({
  ClassroomThemeToggle: () => <button type="button" aria-label="主题：跟随系统" />,
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
  return ids
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

function createContentSession(): ClassroomSession {
  return classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
    skillId: 'cj.io.println.print-value',
    now: 1001,
  })
}

function createEnglishContentSession(): ClassroomSession {
  return classroomReducer(createInitialClassroomSession({ lang: 'en' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
    skillId: 'cj.io.println.print-value',
    now: 1001,
  })
}

function renderHeader({
  session = createContentSession(),
  dispatch = vi.fn(),
  activeView = 'live',
  previewOnly = false,
  onOpenChat = vi.fn(),
  onViewChange = vi.fn(),
  onReviewConcept = vi.fn(),
  onStartClassroom,
  activeConceptIdOverride,
  chatDisabledReason,
  wrapper: WrapperComponent = Wrapper,
}: {
  session?: ClassroomSession
  dispatch?: React.Dispatch<ClassroomAction>
  activeView?: 'live' | 'review'
  previewOnly?: boolean
  onOpenChat?: () => void
  onViewChange?: (view: 'live' | 'review') => void
  onReviewConcept?: (conceptId: string) => void
  onStartClassroom?: () => void
  activeConceptIdOverride?: string
  chatDisabledReason?: 'lesson_generation' | 'api_key' | 'shared_quota'
  wrapper?: typeof Wrapper
} = {}) {
  render(
    <WrapperComponent>
      <ClassroomSessionProvider value={{
        session,
        dispatch,
        hydrated: true,
        hydrationIssue: null,
        saveIssue: null,
        retrySave: () => {},
        resetSession: () => {},
        annotationState: createEditorAnnotationState(),
      }}
      >
        <ClassroomHeader
          onOpenChat={onOpenChat}
          chatDisabledReason={chatDisabledReason}
          activeView={activeView}
          onViewChange={onViewChange}
          onReviewConcept={onReviewConcept}
          previewOnly={previewOnly}
          onStartClassroom={onStartClassroom}
          activeConceptIdOverride={activeConceptIdOverride}
        />
      </ClassroomSessionProvider>
    </WrapperComponent>,
  )
}

describe('classroom header', () => {
  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().reset()
  })

  it('describes live global actions without changing their visible labels', () => {
    const onOpenChat = vi.fn()
    renderHeader({ onOpenChat })

    const liveTab = screen.getByRole('tab', { name: '课堂' })
    const reviewTab = screen.getByRole('tab', { name: '复习' })
    expect(screen.getByTestId('classroom-phase').className).toContain('shrink-0')
    expect(liveTab.getAttribute('aria-controls')).toBe('ai-classroom-live-panel')
    expect(reviewTab.getAttribute('aria-controls')).toBe('ai-classroom-review-panel')
    expect(liveTab.className).toContain('shrink-0')
    expect(reviewTab.className).toContain('shrink-0')
    expect(liveTab.getAttribute('tabindex')).toBe('0')
    expect(reviewTab.getAttribute('tabindex')).toBe('-1')
    expect(describedByText(liveTab)).toBe('切换到课堂视图，只查看当前课堂流；不会改变学习进度或排队新的 AI 请求。')
    expect(liveTab.getAttribute('title')).toBe('切换到课堂视图，只查看当前课堂流；不会改变学习进度或排队新的 AI 请求。')
    expect(describedByText(reviewTab)).toBe('切换到复习视图，查看概念掌握和保留练习；不会改变学习进度或排队新的 AI 请求。')
    expect(reviewTab.getAttribute('title')).toBe('切换到复习视图，查看概念掌握和保留练习；不会改变学习进度或排队新的 AI 请求。')

    const source = screen.getByRole('link', { name: '打开对应教程' })
    expect(source.getAttribute('href')).toBe('/zh/tour/welcome/1')
    expect(source.className).toContain('shrink-0')
    expect(describedByText(source)).toBe('打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。')
    expect(source.getAttribute('title')).toBe('打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。')
    expect(source.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(source.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')

    const settings = screen.getByRole('button', { name: 'AI 服务设置' })
    expect(settings.className).toContain('shrink-0')
    expect(settings.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(describedByText(settings)).toBe('打开 AI 服务设置，用于检查服务地址、API Key、模型和共享额度。')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置，用于检查服务地址、API Key、模型和共享额度。')
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)

    const chat = screen.getByRole('button', { name: '打开聊天' })
    expect(chat.className).toContain('shrink-0')
    expect(chat.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(describedByText(chat)).toBe('打开聊天；AI 会优先使用当前课堂概念作为上下文。')
    expect(chat.getAttribute('title')).toBe('打开聊天；AI 会优先使用当前课堂概念作为上下文。')
    fireEvent.click(chat)
    expect(onOpenChat).toHaveBeenCalledTimes(1)

    expect(screen.queryByRole('button', { name: '开始 AI 课堂' })).toBeNull()
  })

  it('uses compiled English copy for live global action guardrails', () => {
    const onOpenChat = vi.fn()
    renderHeader({
      session: createEnglishContentSession(),
      onOpenChat,
      wrapper: EnWrapper,
    })

    const liveTab = screen.getByRole('tab', { name: 'Live' })
    const reviewTab = screen.getByRole('tab', { name: 'Review' })
    expect(describedByText(liveTab)).toBe('Switch to Classroom to view only the current classroom stream. This will not change learning progress or queue a new AI request.')
    expect(liveTab.getAttribute('title')).toBe('Switch to Classroom to view only the current classroom stream. This will not change learning progress or queue a new AI request.')
    expect(describedByText(reviewTab)).toBe('Switch to Review to inspect concept mastery and retained practice. This will not change learning progress or queue a new AI request.')
    expect(reviewTab.getAttribute('title')).toBe('Switch to Review to inspect concept mastery and retained practice. This will not change learning progress or queue a new AI request.')

    const source = screen.getByRole('link', { name: 'Open matching tour' })
    expect(source.getAttribute('href')).toBe('/en/tour/welcome/1')
    expect(describedByText(source)).toBe('Open the static tutorial content for the current concept. This will not change AI Classroom progress.')

    const settings = screen.getByRole('button', { name: 'AI service settings' })
    expect(describedByText(settings)).toBe('Open AI service settings to check the service URL, API Key, model, and shared quota.')

    const chat = screen.getByRole('button', { name: 'Open chat' })
    expect(describedByText(chat)).toBe('Open chat. AI will prioritize the current classroom concept as context.')
    fireEvent.click(chat)

    expect(onOpenChat).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('切换到课堂视图，只查看当前课堂流；不会改变学习进度或排队新的 AI 请求。')).toBeNull()
  })

  it('disables the chat entry while the first classroom content is still preparing', () => {
    const onOpenChat = vi.fn()
    renderHeader({
      session: createInitialClassroomSession({ lang: 'zh' }),
      onOpenChat,
      chatDisabledReason: 'lesson_generation',
    })

    const chat = screen.getByRole('button', { name: '打开聊天' }) as HTMLButtonElement
    expect(chat.disabled).toBe(true)
    expect(describedByText(chat)).toBe('课堂正在准备内容；准备完成后再打开聊天，避免在没有课堂上下文时提问。')
    expect(chat.getAttribute('title')).toBe('课堂正在准备内容；准备完成后再打开聊天，避免在没有课堂上下文时提问。')

    fireEvent.click(chat)

    expect(onOpenChat).not.toHaveBeenCalled()
  })

  it('supports keyboard navigation across classroom view tabs', () => {
    const onViewChange = vi.fn()
    renderHeader({ onViewChange })

    fireEvent.keyDown(screen.getByRole('tab', { name: '课堂' }), { key: 'ArrowRight' })
    expect(onViewChange).toHaveBeenLastCalledWith('review')

    fireEvent.keyDown(screen.getByRole('tab', { name: '课堂' }), { key: 'End' })
    expect(onViewChange).toHaveBeenLastCalledWith('review')

    cleanup()
    const onReviewViewChange = vi.fn()
    renderHeader({ activeView: 'review', onViewChange: onReviewViewChange })
    const liveTab = screen.getByRole('tab', { name: '课堂' })
    const reviewTab = screen.getByRole('tab', { name: '复习' })
    expect(liveTab.getAttribute('tabindex')).toBe('-1')
    expect(reviewTab.getAttribute('tabindex')).toBe('0')

    fireEvent.keyDown(reviewTab, { key: 'ArrowLeft' })
    expect(onReviewViewChange).toHaveBeenLastCalledWith('live')

    fireEvent.keyDown(reviewTab, { key: 'Home' })
    expect(onReviewViewChange).toHaveBeenLastCalledWith('live')
  })

  it('uses an explicit active concept for preview source links', () => {
    renderHeader({
      activeView: 'review',
      previewOnly: true,
      activeConceptIdOverride: 'cj.var.immutable',
    })

    const source = screen.getByRole('link', { name: '打开对应教程' })
    expect(source.getAttribute('href')).toBe('/zh/tour/basics/1')
    expect(describedByText(source)).toBe('打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。')
  })

  it('describes preview start as the boundary between preview and live classroom', () => {
    const onStartClassroom = vi.fn()
    renderHeader({
      activeView: 'review',
      previewOnly: true,
      onStartClassroom,
    })

    const liveTab = screen.getByRole('tab', { name: '课堂' })
    expect(describedByText(liveTab)).toBe('当前处于课程预览；需要使用“开始课堂”按钮确认后才会启动 AI 课堂并准备下一步内容。')
    expect(liveTab.getAttribute('title')).toBe('当前处于课程预览；需要使用“开始课堂”按钮确认后才会启动 AI 课堂并准备下一步内容。')
    expect(liveTab.getAttribute('aria-disabled')).toBe('true')
    const reviewTab = screen.getByRole('tab', { name: '复习' })
    expect(describedByText(reviewTab)).toBe('切换到复习视图，查看课程预览和已保留的练习；不会开始 AI 课堂或记录学习进度。')
    expect(reviewTab.getAttribute('title')).toBe('切换到复习视图，查看课程预览和已保留的练习；不会开始 AI 课堂或记录学习进度。')
    fireEvent.click(liveTab)
    expect(onStartClassroom).not.toHaveBeenCalled()

    const start = screen.getByRole('button', { name: '开始 AI 课堂' })
    expect(start.className).toContain('shrink-0')
    expect(start.className).toContain('h-8')
    expect(start.className).toContain('w-8')
    expect(start.className).toContain('sm:w-auto')
    expect(start.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(describedByText(start)).toBe('开始 AI 课堂并准备下一步内容，预览内容仍可在复习页查看。')
    expect(start.getAttribute('title')).toBe('开始 AI 课堂并准备下一步内容，预览内容仍可在复习页查看。')
    const visibleLabel = screen.getByText('开始课堂')
    expect(visibleLabel.className).toContain('hidden')
    expect(visibleLabel.className).toContain('sm:inline')
    fireEvent.click(start)
    expect(onStartClassroom).toHaveBeenCalledTimes(1)

    expect(screen.queryByRole('button', { name: '打开聊天' })).toBeNull()
  })

  it('uses compiled English copy for preview start boundaries', () => {
    const onStartClassroom = vi.fn()
    renderHeader({
      session: createEnglishContentSession(),
      activeView: 'review',
      previewOnly: true,
      onStartClassroom,
      wrapper: EnWrapper,
    })

    const liveTab = screen.getByRole('tab', { name: 'Live' })
    expect(describedByText(liveTab)).toBe('You are previewing course content. Use the Start Classroom button to confirm before AI Classroom starts and prepares the next step.')
    expect(liveTab.getAttribute('aria-disabled')).toBe('true')

    const start = screen.getByRole('button', { name: 'Start AI Classroom' })
    expect(start.className).toContain('w-8')
    expect(start.className).toContain('sm:w-auto')
    expect(describedByText(start)).toBe('Start AI Classroom and prepare the next step; preview content remains available in Review.')
    expect(start.getAttribute('title')).toBe('Start AI Classroom and prepare the next step; preview content remains available in Review.')
    expect(screen.queryByText('开始课堂')).toBeNull()

    fireEvent.click(start)

    expect(onStartClassroom).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Open chat' })).toBeNull()
  })

  it('keeps the preview classroom tab from starting the live classroom path', () => {
    const onViewChange = vi.fn()
    renderHeader({
      activeView: 'review',
      previewOnly: true,
      onViewChange,
    })

    const liveTab = screen.getByRole('tab', { name: '课堂' })
    const reviewTab = screen.getByRole('tab', { name: '复习' })
    fireEvent.click(liveTab)

    expect(onViewChange).not.toHaveBeenCalled()
    expect(describedByText(liveTab)).toContain('需要使用“开始课堂”按钮确认')

    fireEvent.keyDown(reviewTab, { key: 'Home' })

    expect(onViewChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(liveTab)
  })
})
