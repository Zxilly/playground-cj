/* eslint-disable react/component-hook-factories */
import type { ReactNode } from 'react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TourAIClassroomShell } from './TourAIClassroomShell'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'

const clearChatAnnotations = vi.fn()
const replaceChatAnnotations = vi.fn()
const classroomDispatch = vi.fn()
const model = { id: 'model' }
const setModelMarkers = vi.fn()
const classroomStreamProps = vi.fn()
const classroomHeaderProps = vi.fn()
const classroomReviewProps = vi.fn()
const lessonRuntimeProps = vi.fn()
let lessonRuntimeOverrides: Record<string, unknown> = {}

vi.mock('next/font/local', () => ({
  default: () => ({ style: { fontFamily: 'MockFont' } }),
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  editor: {
    setModelMarkers: (...args: unknown[]) => setModelMarkers(...args),
  },
}))

vi.mock('@/features/tour-ai/context/useAIClassroomBridge', () => ({
  useAIClassroomBridge: () => ({
    editor: {
      getEditor: () => ({
        getModel: () => model,
      }),
      setEditor: vi.fn(),
    },
    lang: 'zh',
    uiLang: 'zh',
    classroom: {
      getSession: () => createInitialClassroomSession({ lang: 'zh' }),
      dispatch: classroomDispatch,
      replaceChatAnnotations,
      clearChatAnnotations,
    },
  }),
}))

vi.mock('@/features/tour-ai/runtime/useLessonGenerationRuntime', () => ({
  useLessonGenerationRuntime: (props: Record<string, unknown>) => {
    lessonRuntimeProps(props)
    return {
      generationProgress: { status: 'idle', expanded: false, text: '', items: [] },
      generationRecoveryReason: null,
      generationRunning: false,
      generationStalled: false,
      hasRetryableInitialGenerationError: false,
      retryQueuedGenerationEvent: vi.fn(),
      toggleGenerationProgress: vi.fn(),
      waitingForApiKey: false,
      waitingForSharedQuota: false,
      ...lessonRuntimeOverrides,
    }
  },
}))

vi.mock('@/features/tour-ai/components/ClassroomStream', () => ({
  ClassroomStream: (props: {
    footer?: ReactNode
    focusExerciseId?: string
    focusExerciseRequestKey?: number
    focusGenerationRequestKey?: number
    focusContinueRequestKey?: number
    onReviewConcept?: (conceptId: string) => void
  }) => {
    classroomStreamProps(props)
    return (
      <div data-testid="classroom-stream">
        <div data-testid="classroom-stream-focus-exercise">{props.focusExerciseId ?? ''}</div>
        <div data-testid="classroom-stream-focus-exercise-key">{props.focusExerciseRequestKey ?? ''}</div>
        <div data-testid="classroom-stream-focus-generation-key">{props.focusGenerationRequestKey ?? ''}</div>
        <div data-testid="classroom-stream-focus-continue-key">{props.focusContinueRequestKey ?? ''}</div>
        <button type="button" onClick={() => props.onReviewConcept?.('cj.io.println')}>查看复习进度</button>
        <div data-testid="classroom-stream-footer">{props.footer}</div>
      </div>
    )
  },
}))

vi.mock('@/features/tour-ai/components/ClassroomChatSidebar', () => ({
  ClassroomChatSidebar: ({
    activeConceptId,
    onClose,
    onUseCurrentExerciseContext,
  }: {
    activeConceptId?: string
    onClose: () => void
    onUseCurrentExerciseContext?: (conceptId: string) => void
  }) => (
    <div data-testid="classroom-chat-sidebar">
      <div data-testid="classroom-chat-scope">{activeConceptId ?? 'classroom'}</div>
      <button type="button" onClick={() => onUseCurrentExerciseContext?.('cj.io.println')}>改为当前练习</button>
      <button type="button" onClick={onClose}>关闭聊天</button>
    </div>
  ),
}))

vi.mock('@/features/tour-ai/components/ClassroomHeader', () => ({
  ClassroomHeader: ({ activeView, onViewChange, onOpenChat, chatDisabledReason, previewOnly, onStartClassroom, activeConceptIdOverride }: {
    activeView: 'live' | 'review'
    onViewChange: (view: 'live' | 'review') => void
    onOpenChat: () => void
    chatDisabledReason?: 'lesson_generation' | 'api_key' | 'shared_quota'
    previewOnly?: boolean
    onStartClassroom?: () => void
    activeConceptIdOverride?: string
  }) => {
    classroomHeaderProps({ activeView, chatDisabledReason, previewOnly, activeConceptIdOverride })
    return (
      <div data-testid="classroom-header">
        <div data-testid="classroom-header-active-concept">{activeConceptIdOverride ?? ''}</div>
        <button type="button" disabled={chatDisabledReason != null} onClick={onOpenChat}>打开聊天</button>
        <button type="button" aria-pressed={activeView === 'live'} onClick={() => onViewChange('live')}>课堂</button>
        <button type="button" aria-pressed={activeView === 'review'} onClick={() => onViewChange('review')}>复习</button>
        {previewOnly && <button type="button" onClick={onStartClassroom}>开始 AI 课堂</button>}
      </div>
    )
  },
}))

vi.mock('@/features/tour-ai/components/ClassroomLandingPage', () => ({
  ClassroomLandingPage: ({ onEnter, onPreview }: { onEnter: () => void, onPreview?: () => void }) => (
    <div data-testid="classroom-landing-page">
      <button type="button" onClick={onEnter}>继续上次课堂</button>
      {onPreview && <button type="button" onClick={onPreview}>先预览课程内容</button>}
    </div>
  ),
}))

vi.mock('@/features/tour-ai/components/ClassroomReviewView', () => ({
  ClassroomReviewView: ({ focusConceptId, focusRequestKey, lessonGenerationPending, onOpenChat, onActiveConceptChange, onReturnToLive }: {
    focusConceptId?: string
    focusRequestKey?: number
    lessonGenerationPending?: boolean
    onOpenChat?: (conceptId: string) => void
    onActiveConceptChange?: (conceptId: string | undefined) => void
    onReturnToLive?: (options?: { focus?: 'current_exercise' | 'generation' | 'continue', conceptId?: string }) => void
  }) => {
    classroomReviewProps({ focusConceptId, focusRequestKey, lessonGenerationPending })
    return (
      <div data-testid="classroom-review-view">
        <div data-testid="classroom-review-focus-concept">{focusConceptId ?? ''}</div>
        <div data-testid="classroom-review-focus-key">{focusRequestKey ?? ''}</div>
        <button type="button" onClick={() => onOpenChat?.('cj.program.main')}>围绕 main 聊天</button>
        <button type="button" onClick={() => onReturnToLive?.({ focus: 'continue' })}>返回课堂继续</button>
        <button type="button" onClick={() => onActiveConceptChange?.('cj.io.println')}>选中 println 预览概念</button>
        <button type="button" onClick={() => onReturnToLive?.({ focus: 'generation', conceptId: 'cj.io.println' })}>从预览概念开始</button>
      </div>
    )
  },
}))

vi.mock('@/features/tour-ai/components/ClassroomLiveChapterIndex', () => ({
  ClassroomLiveChapterIndex: () => <div data-testid="classroom-live-chapter-index" />,
}))

vi.mock('@/features/tour-ai/components/ClassroomScrollRail', () => ({
  ClassroomScrollRail: () => <div data-testid="classroom-scroll-rail" />,
}))

vi.mock('@/features/tour-ai/components/ClassroomScrollFollower', () => ({
  ClassroomScrollFollower: () => null,
}))

vi.mock('@/modules/llm-config/components/QuotaExhaustedDialog', () => ({
  QuotaExhaustedDialog: () => null,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

function sessionWithContent() {
  return classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading'],
    now: 1001,
  })
}

function sessionWithReadableGenerationFailure() {
  let session = sessionWithContent()
  session = classroomReducer(session, {
    type: 'EMIT_CHAT_INTENT',
    intent: 'go_deeper',
    summary: '继续解释 println',
    activeConceptId: 'cj.io.println',
    now: 1002,
  })
  return classroomReducer(session, {
    type: 'LESSON_GENERATION_FAILED',
    error: '模型超时，请稍后重试。',
    now: 1003,
  })
}

function sessionWithActiveExercise() {
  return classroomReducer(sessionWithContent(), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '1',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '输出 Hello。',
      starterCode: '// TODO: write main',
      expectedOutput: 'Hello',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'Selected from default pack.', difficulty: 1 },
    },
    now: 1002,
  })
}

describe('tourAIClassroomShell stale chat annotations', () => {
  afterEach(() => {
    cleanup()
    clearChatAnnotations.mockClear()
    replaceChatAnnotations.mockClear()
    classroomDispatch.mockClear()
    setModelMarkers.mockClear()
    classroomStreamProps.mockClear()
    classroomHeaderProps.mockClear()
    classroomReviewProps.mockClear()
    lessonRuntimeProps.mockClear()
    lessonRuntimeOverrides = {}
  })

  it('lets learners clear stale chat code markers from the classroom footer', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState([
          {
            namespace: 'chat',
            kind: 'highlight',
            startLine: 2,
            endLine: 2,
            label: 'old',
            modelVersionId: 1,
            targetSnippet: 'println(old)',
            stale: true,
          },
          {
            namespace: 'compiler',
            kind: 'underline',
            startLine: 1,
            endLine: 1,
            modelVersionId: 1,
            targetSnippet: 'compile error',
            stale: false,
          },
        ])}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    screen.getByText('聊天里的代码提示可能不是最新的。')
    screen.getByText('代码已变化，1 个聊天标记不再匹配当前位置。清除后可让聊天重新标注。')

    fireEvent.click(screen.getByRole('button', { name: '清除旧标记' }))

    expect(clearChatAnnotations).toHaveBeenCalledTimes(1)
    expect(setModelMarkers).toHaveBeenCalledWith(model, 'chat', [])
  })

  it('focuses the current active exercise when resuming from the landing page', () => {
    const onTemporarySessionUse = vi.fn()
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithActiveExercise()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={onTemporarySessionUse}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
      />,
      { wrapper: Wrapper },
    )

    document.documentElement.scrollTop = 96
    document.documentElement.scrollLeft = 12
    document.body.scrollTop = 48
    document.body.scrollLeft = 6

    fireEvent.click(screen.getByRole('button', { name: '继续上次课堂' }))

    expect(onTemporarySessionUse).toHaveBeenCalledTimes(1)
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(document.body.scrollLeft).toBe(0)
    expect(screen.getByTestId('classroom-stream-focus-exercise').textContent).toMatch(/^exercise:/)
    expect(screen.getByTestId('classroom-stream-focus-exercise-key').textContent).toBe('1')
    expect(screen.getByTestId('classroom-stream-focus-generation-key').textContent).toBe('')
    expect(screen.getByTestId('classroom-stream-focus-continue-key').textContent).toBe('')
    expect(classroomStreamProps).toHaveBeenLastCalledWith(expect.objectContaining({
      focusExerciseRequestKey: 1,
      focusGenerationRequestKey: undefined,
      focusContinueRequestKey: undefined,
    }))
  })

  it('keeps preview-to-live behind an explicit start action', () => {
    const onTemporarySessionUse = vi.fn()
    render(
      <TourAIClassroomShell
        lang="zh"
        session={createInitialClassroomSession({ lang: 'zh' })}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={onTemporarySessionUse}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
      />,
      { wrapper: Wrapper },
    )

    document.documentElement.scrollTop = 72
    document.body.scrollTop = 36
    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))

    expect(onTemporarySessionUse).not.toHaveBeenCalled()
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(screen.getByTestId('classroom-review-view')).not.toBeNull()
    expect(screen.queryByTestId('classroom-stream')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '课堂' }))

    expect(screen.getByTestId('classroom-review-view')).not.toBeNull()
    expect(screen.queryByTestId('classroom-stream')).toBeNull()

    document.documentElement.scrollTop = 84
    document.body.scrollTop = 42
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 课堂' }))

    expect(screen.getByTestId('classroom-stream')).not.toBeNull()
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(onTemporarySessionUse).toHaveBeenCalledTimes(1)
  })

  it('uses the preview-selected review concept when starting from the header', () => {
    const onTemporarySessionUse = vi.fn()
    render(
      <TourAIClassroomShell
        lang="zh"
        session={createInitialClassroomSession({ lang: 'zh' })}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={onTemporarySessionUse}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))
    expect(screen.getByTestId('classroom-review-view')).not.toBeNull()
    expect(onTemporarySessionUse).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '选中 println 预览概念' }))
    expect(screen.getByTestId('classroom-header-active-concept').textContent).toBe('cj.io.println')
    expect(classroomHeaderProps).toHaveBeenLastCalledWith(expect.objectContaining({
      activeConceptIdOverride: 'cj.io.println',
      previewOnly: true,
    }))
    fireEvent.click(screen.getByRole('button', { name: '开始 AI 课堂' }))

    expect(screen.getByTestId('classroom-stream')).not.toBeNull()
    expect(onTemporarySessionUse).toHaveBeenCalledTimes(1)
    expect(lessonRuntimeProps).toHaveBeenLastCalledWith(expect.objectContaining({
      enabled: true,
      initialTopic: 'cj.io.println',
    }))
  })

  it('marks the temporary session only when starting live mode from a preview action', () => {
    const onTemporarySessionUse = vi.fn()
    render(
      <TourAIClassroomShell
        lang="zh"
        session={createInitialClassroomSession({ lang: 'zh' })}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={onTemporarySessionUse}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '先预览课程内容' }))
    expect(onTemporarySessionUse).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '从预览概念开始' }))

    expect(onTemporarySessionUse).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('classroom-stream')).not.toBeNull()
    expect(lessonRuntimeProps).toHaveBeenLastCalledWith(expect.objectContaining({
      enabled: true,
      initialTopic: 'cj.io.println',
    }))
  })

  it('resets the classroom viewport when learners switch into review', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    const viewport = screen.getByTestId('ai-classroom-content').parentElement?.parentElement as HTMLDivElement | null
    expect(viewport).not.toBeNull()
    viewport!.scrollTop = 320
    viewport!.scrollLeft = 24

    fireEvent.click(screen.getByRole('button', { name: '复习' }))

    expect(screen.getByTestId('classroom-review-view')).not.toBeNull()
    expect(viewport!.scrollTop).toBe(0)
    expect(viewport!.scrollLeft).toBe(0)
  })

  it('marks review actions as pending while lesson generation is running', () => {
    lessonRuntimeOverrides = { generationRunning: true }

    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '复习' }))

    expect(classroomReviewProps).toHaveBeenLastCalledWith(expect.objectContaining({
      lessonGenerationPending: true,
    }))
  })

  it('keeps header chat closed while the first classroom content is preparing', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={createInitialClassroomSession({ lang: 'zh' })}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    const chatTrigger = screen.getByRole('button', { name: '打开聊天' }) as HTMLButtonElement
    expect(chatTrigger.disabled).toBe(true)
    fireEvent.click(chatTrigger)

    expect(screen.queryByTestId('classroom-chat-sidebar')).toBeNull()
    expect(classroomHeaderProps).toHaveBeenLastCalledWith(expect.objectContaining({
      chatDisabledReason: 'lesson_generation',
    }))
  })

  it('resets document scroll after the accepted classroom shell mounts', () => {
    document.documentElement.scrollTop = 80
    document.documentElement.scrollLeft = 14
    document.body.scrollTop = 40
    document.body.scrollLeft = 7

    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(document.body.scrollLeft).toBe(0)
  })

  it('passes a focused review concept request when returning from a completed review check', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '查看复习进度' }))

    expect(screen.getByTestId('classroom-review-view')).not.toBeNull()
    expect(screen.getByTestId('classroom-review-focus-concept').textContent).toBe('cj.io.println')
    expect(screen.getByTestId('classroom-review-focus-key').textContent).toBe('1')
  })

  it('restores focus to the chat trigger after the chat sidebar closes', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    const chatTrigger = screen.getByRole('button', { name: '打开聊天' })
    chatTrigger.focus()
    fireEvent.click(chatTrigger)

    expect(screen.getByTestId('classroom-chat-sidebar')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '关闭聊天' }))

    expect(screen.queryByTestId('classroom-chat-sidebar')).toBeNull()
    expect(document.activeElement).toBe(chatTrigger)
  })

  it('focuses the live continue controls when returning from a ready review concept', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithContent()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '复习' }))
    fireEvent.click(screen.getByRole('button', { name: '返回课堂继续' }))

    expect(screen.getByTestId('classroom-stream')).not.toBeNull()
    expect(screen.getByTestId('classroom-stream-focus-exercise').textContent).toBe('')
    expect(screen.getByTestId('classroom-stream-focus-generation-key').textContent).toBe('')
    expect(screen.getByTestId('classroom-stream-focus-continue-key').textContent).toBe('1')
    expect(classroomStreamProps).toHaveBeenLastCalledWith(expect.objectContaining({
      focusExerciseRequestKey: 0,
      focusGenerationRequestKey: undefined,
      focusContinueRequestKey: 1,
    }))
  })

  it('opens review from readable failure recovery without retrying generation', () => {
    const retryQueuedGenerationEvent = vi.fn()
    lessonRuntimeOverrides = {
      generationProgress: { status: 'failed', expanded: true, text: 'failed', items: [] },
      retryQueuedGenerationEvent,
    }

    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithReadableGenerationFailure()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    screen.getByText('这次 AI 生成失败')
    screen.getByText('现有课堂内容仍可阅读；可以重试这次任务，或先继续复习已生成内容。')
    const review = screen.getByRole('button', { name: '去复习已生成内容' })
    expect(describedByText(review)).toBe('打开复习视图查看已经生成的课堂内容，不会重试失败的 AI 任务。')

    fireEvent.click(review)

    expect(retryQueuedGenerationEvent).not.toHaveBeenCalled()
    expect(screen.getByTestId('classroom-review-view')).not.toBeNull()
    expect(screen.queryByTestId('classroom-stream')).toBeNull()
    expect(classroomHeaderProps).toHaveBeenLastCalledWith(expect.objectContaining({
      activeView: 'review',
    }))
  })

  it('lets an open review-scoped chat switch back to the current exercise context', () => {
    render(
      <TourAIClassroomShell
        lang="zh"
        session={sessionWithActiveExercise()}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '复习' }))
    fireEvent.click(screen.getByRole('button', { name: '围绕 main 聊天' }))

    expect(screen.getByTestId('classroom-chat-scope').textContent).toBe('cj.program.main')

    fireEvent.click(screen.getByRole('button', { name: '改为当前练习' }))

    expect(screen.getByTestId('classroom-chat-scope').textContent).toBe('cj.io.println')
  })

  it('clears stale continue focus once classroom preparation starts', () => {
    const baseSession = sessionWithContent()
    const queuedSession = classroomReducer(baseSession, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'advance',
      summary: 'Continue after review.',
      now: 1002,
    })
    const { rerender } = render(
      <TourAIClassroomShell
        lang="zh"
        session={baseSession}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: '复习' }))
    fireEvent.click(screen.getByRole('button', { name: '返回课堂继续' }))
    expect(screen.getByTestId('classroom-stream-focus-continue-key').textContent).toBe('1')

    rerender(
      <TourAIClassroomShell
        lang="zh"
        session={queuedSession}
        dispatch={vi.fn()}
        hydrated
        hydrationIssue={null}
        saveIssue={null}
        onTemporarySessionUse={vi.fn()}
        onRetrySave={vi.fn()}
        onResetSession={vi.fn()}
        annotationState={createEditorAnnotationState()}
        initialLandingAccepted
      />,
    )

    expect(screen.getByTestId('classroom-stream-focus-continue-key').textContent).toBe('')
    expect(classroomStreamProps).toHaveBeenLastCalledWith(expect.objectContaining({
      focusContinueRequestKey: undefined,
    }))
  })
})
