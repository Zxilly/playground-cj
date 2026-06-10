import type { ReactNode } from 'react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession, ExerciseIntent } from '@/lib/ai/classroom/types'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { ClassroomIntentBar } from './ClassroomIntentBar'

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

function classroomWithContent(lang: 'zh' | 'en' = 'zh'): ClassroomSession {
  return classroomReducer(createInitialClassroomSession({ lang }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading'],
    now: 1,
  })
}

function describedByText(element: HTMLElement): string {
  const describedBy = element.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  const description = document.getElementById(describedBy!)
  expect(description).toBeTruthy()
  return description?.textContent ?? ''
}

describe('classroomIntentBar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useLLMConfigStore.getState().reset()
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    useLLMConfigStore.getState().reset()
  })

  it('wraps intent controls inside the viewport on small screens', () => {
    render(<ClassroomIntentBar session={classroomWithContent()} dispatch={vi.fn()} disabled={false} />, { wrapper: Wrapper })

    const bar = screen.getByTestId('classroom-intent-bar')
    const group = screen.getByRole('group', { name: '告诉 AI 你的下一步' })
    expect(bar.className).toContain('justify-center')
    expect(bar.className).not.toContain('overflow-x-auto')
    expect(group.className).toContain('w-full')
    expect(group.className).toContain('max-w-full')
    expect(group.className).toContain('flex-wrap')
    expect(group.className).not.toContain('min-w-max')
    expect(group.className).not.toContain('flex-nowrap')
    const advance = screen.getByTestId('classroom-intent-advance')
    expect(advance.className).toContain('shrink-0')
    expect(advance.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(advance.getAttribute('title')).toBe('请求 AI 准备下一步课堂内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    expect(describedByText(advance)).toBe('请求 AI 准备下一步课堂内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    const deeper = screen.getByTestId('classroom-intent-go_deeper')
    expect(deeper.getAttribute('title')).toBe('请求 AI 围绕当前内容深入讲解；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    expect(describedByText(deeper)).toBe('请求 AI 围绕当前内容深入讲解；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    const slower = screen.getByTestId('classroom-intent-slow_down')
    expect(slower.getAttribute('title')).toBe('请求 AI 放慢节奏重新讲解当前内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    expect(describedByText(slower)).toBe('请求 AI 放慢节奏重新讲解当前内容；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    const explainError = screen.getByTestId('classroom-intent-explain_error')
    expect(explainError.getAttribute('title')).toBe('请求 AI 分析最近的错误或代码问题；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
    expect(describedByText(explainError)).toBe('请求 AI 分析最近的错误或代码问题；会进入等待状态，不会提交代码、运行代码或清除学习记录。')
  })

  it('confirms a queued intent immediately and locally locks duplicate clicks', () => {
    const dispatch = vi.fn()
    render(<ClassroomIntentBar session={classroomWithContent()} dispatch={dispatch} disabled={false} />, { wrapper: Wrapper })

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    fireEvent.click(advance)

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'advance',
      activeConceptId: 'cj.io.println',
    }))
    const status = screen.getByTestId('classroom-intent-queued-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toBe('已收到：继续下一步（标准输出 println）。正在准备下一步。')
    expect(status.className).toContain('max-w-[min(82vw,24rem)]')
    expect(status.className).toContain('whitespace-normal')
    expect(status.className).toContain('break-words')
    expect(status.querySelector('span')?.className).toContain('min-w-0')
    expect(status.querySelector('span')?.className).toContain('break-words')
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(status.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(advance.disabled).toBe(true)

    fireEvent.click(advance)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('uses compiled English copy for queued intent confirmation and action boundaries', () => {
    const dispatch = vi.fn()
    render(<ClassroomIntentBar session={classroomWithContent('en')} dispatch={dispatch} disabled={false} />, { wrapper: EnWrapper })

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.getAttribute('title')).toBe('Ask AI to prepare the next classroom step. It will enter a waiting state and will not submit code, run code, or clear learning records.')
    expect(describedByText(advance)).toBe('Ask AI to prepare the next classroom step. It will enter a waiting state and will not submit code, run code, or clear learning records.')
    const deeper = screen.getByTestId('classroom-intent-go_deeper')
    expect(deeper.getAttribute('title')).toBe('Ask AI for a deeper explanation of the current content. It will enter a waiting state and will not submit code, run code, or clear learning records.')

    fireEvent.click(advance)

    const status = screen.getByTestId('classroom-intent-queued-status')
    expect(status.textContent).toBe('Received: Continue (Standard output println). Preparing the next step.')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).not.toContain('已收到')
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('clears local intent confirmation after the external generation state settles', () => {
    const dispatch = vi.fn()
    const initialSession = classroomWithContent()
    const queuedSession = classroomReducer(initialSession, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'advance',
      summary: 'Learner is comfortable with the current content and wants to advance to the next teaching step.',
      now: 2,
    })
    const { rerender } = render(
      <ClassroomIntentBar session={initialSession} dispatch={dispatch} disabled={false} />,
      { wrapper: Wrapper },
    )

    fireEvent.click(screen.getByTestId('classroom-intent-advance'))
    screen.getByTestId('classroom-intent-queued-status')

    rerender(<ClassroomIntentBar session={queuedSession} dispatch={dispatch} disabled />)
    screen.getByTestId('classroom-intent-queued-status')

    rerender(<ClassroomIntentBar session={initialSession} dispatch={dispatch} disabled={false} />)
    expect(screen.queryByTestId('classroom-intent-queued-status')).toBeNull()
    expect((screen.getByTestId('classroom-intent-advance') as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps advance disabled while the current exercise is active', () => {
    const withExercise = classroomWithActiveExercise()

    render(<ClassroomIntentBar session={withExercise} dispatch={vi.fn()} disabled={false} />, { wrapper: Wrapper })

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.disabled).toBe(true)
    expect(advance.getAttribute('title')).toBe('先完成、跳过或提交当前练习后再继续')
    expect(describedByText(advance)).toBe('先完成、跳过或提交当前练习后再继续')
    expect((screen.getByTestId('classroom-intent-go_deeper') as HTMLButtonElement).disabled).toBe(false)
    const status = screen.getByTestId('classroom-intent-active-exercise-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('先提交或跳过当前练习，再继续下一步。运行只会看结果，不会记录进度。')
    expect(status.className).toContain('break-words')
  })

  it('explains disabled advance against an active review check', () => {
    render(<ClassroomIntentBar session={classroomWithActiveExercise('review_check')} dispatch={vi.fn()} disabled={false} />, { wrapper: Wrapper })

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.disabled).toBe(true)
    expect(advance.getAttribute('title')).toBe('先完成、跳过或提交当前复习检查后再继续')
    expect(describedByText(advance)).toBe('先完成、跳过或提交当前复习检查后再继续')
    expect(screen.getByTestId('classroom-intent-active-exercise-status').textContent).toBe('先提交或跳过当前复习检查，再继续下一步。运行只会看结果，不会记录进度。')
  })

  function classroomWithActiveExercise(intent: ExerciseIntent = 'mainline', lang: 'zh' | 'en' = 'zh'): ClassroomSession {
    return classroomReducer(classroomWithContent(lang), {
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
        intent,
        personalizationInputs: { summary: 'Selected from default pack.', difficulty: 1 },
      },
      now: 2,
    })
  }

  it('explains classroom-level disabled states on intent actions', () => {
    render(
      <ClassroomIntentBar
        session={classroomWithContent()}
        dispatch={vi.fn()}
        disabled
        disabledReason="lesson_generation"
      />,
      { wrapper: Wrapper },
    )

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.disabled).toBe(true)
    expect(advance.getAttribute('title')).toBe('课堂正在准备下一步，请稍候')
    expect(describedByText(advance)).toBe('课堂正在准备下一步，请稍候')
  })

  it('shows a visible waiting status while AI prepares feedback for a failed submit', () => {
    const failedSubmit = classroomReducer(classroomWithActiveExercise(), {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong', stderr: '', exitCode: 0 },
      attemptedCode: 'main() {}',
      now: 3,
    })

    render(
      <ClassroomIntentBar
        session={failedSubmit}
        dispatch={vi.fn()}
        disabled
        disabledReason="lesson_generation"
      />,
      { wrapper: Wrapper },
    )

    const status = screen.getByTestId('classroom-intent-external-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toBe('这次提交已记录，AI 正在准备针对性提示；你可以先继续修改代码。')
    expect(status.className).toContain('max-w-[min(82vw,28rem)]')
    expect(status.className).toContain('whitespace-normal')
    expect(status.className).toContain('break-words')
    expect(status.className).toContain('text-left')
    expect(status.querySelector('span')?.className).toContain('min-w-0')
    expect(status.querySelector('span')?.className).toContain('break-words')
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(status.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(screen.queryByTestId('classroom-intent-queued-status')).toBeNull()
    expect((screen.getByTestId('classroom-intent-go_deeper') as HTMLButtonElement).disabled).toBe(true)
  })

  it('uses compiled English copy while AI prepares and fails queued feedback', () => {
    const failedSubmit = classroomReducer(classroomWithActiveExercise('mainline', 'en'), {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong', stderr: '', exitCode: 0 },
      attemptedCode: 'main() {}',
      now: 3,
    })

    const { rerender } = render(
      <ClassroomIntentBar
        session={failedSubmit}
        dispatch={vi.fn()}
        disabled
        disabledReason="lesson_generation"
      />,
      { wrapper: EnWrapper },
    )

    const waitingStatus = screen.getByTestId('classroom-intent-external-status')
    expect(waitingStatus.textContent).toBe('This submission was recorded; AI is preparing a targeted hint. You can keep editing code.')
    expect(waitingStatus.getAttribute('aria-busy')).toBe('true')
    expect(waitingStatus.textContent).not.toContain('正在准备')

    rerender(
      <ClassroomIntentBar
        session={failedSubmit}
        dispatch={vi.fn()}
        disabled
        disabledReason="lesson_generation"
        generationFailed
      />,
    )

    const failedStatus = screen.getByTestId('classroom-intent-external-status')
    expect(failedStatus.textContent).toBe('This submission was recorded, but AI hint preparation failed. Retry this task first; you can keep editing code.')
    expect(failedStatus.getAttribute('aria-busy')).toBeNull()
    expect(failedStatus.querySelector('svg')).toBeNull()
  })

  it('uses recovery copy after queued feedback generation fails', () => {
    const failedSubmit = classroomReducer(classroomWithActiveExercise(), {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong', stderr: '', exitCode: 0 },
      attemptedCode: 'main() {}',
      now: 3,
    })

    render(
      <ClassroomIntentBar
        session={failedSubmit}
        dispatch={vi.fn()}
        disabled
        disabledReason="lesson_generation"
        generationFailed
      />,
      { wrapper: Wrapper },
    )

    const status = screen.getByTestId('classroom-intent-external-status')
    expect(status.textContent).toBe('这次提交已记录，但 AI 提示准备失败。请先重试这次任务；你可以继续修改代码。')
    expect(status.textContent).not.toContain('正在准备')
    expect(status.getAttribute('aria-busy')).toBeNull()
    expect(status.querySelector('svg')).toBeNull()
  })

  it('uses recovery copy after a queued chat intent generation fails', () => {
    const queuedChat = classroomReducer(classroomWithContent(), {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner wants a deeper explanation.',
      now: 2,
    })

    render(
      <ClassroomIntentBar
        session={queuedChat}
        dispatch={vi.fn()}
        disabled
        disabledReason="lesson_generation"
        generationFailed
      />,
      { wrapper: Wrapper },
    )

    const status = screen.getByTestId('classroom-intent-external-status')
    expect(status.textContent).toBe('上一条 AI 请求准备失败。请先重试这次任务，或先复习已生成内容。')
    expect(status.textContent).not.toContain('正在处理')
    expect(status.getAttribute('aria-busy')).toBeNull()
    expect(status.querySelector('svg')).toBeNull()
  })

  it('opens settings from intent actions when shared quota is exhausted', () => {
    useLLMConfigStore.setState({
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
    })
    const dispatch = vi.fn()

    render(
      <ClassroomIntentBar
        session={classroomWithContent()}
        dispatch={dispatch}
        disabled
        disabledReason="shared_quota"
      />,
      { wrapper: Wrapper },
    )

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.disabled).toBe(false)
    expect(advance.getAttribute('title')).toContain('下次刷新')
    expect(advance.getAttribute('title')).toContain('点击会打开设置')
    expect(advance.getAttribute('title')).toContain('不会排队新的 AI 请求')
    expect(describedByText(advance)).toContain('点击会打开设置')
    const status = screen.getByTestId('classroom-intent-shared-quota-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toContain('共享额度已用完。下次刷新：')
    expect(status.textContent).toContain('点击操作会打开设置')
    expect(status.textContent).toContain('不会排队新的 AI 请求')
    expect(status.className).toContain('max-w-[min(82vw,30rem)]')
    expect(status.className).toContain('whitespace-normal')
    expect(status.className).toContain('break-words')
    expect(status.className).toContain('classroom-warning')

    fireEvent.click(advance)

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for shared quota intent recovery', () => {
    const dispatch = vi.fn()

    render(
      <ClassroomIntentBar
        session={classroomWithContent('en')}
        dispatch={dispatch}
        disabled
        disabledReason="shared_quota"
      />,
      { wrapper: EnWrapper },
    )

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.disabled).toBe(false)
    expect(advance.getAttribute('title')).toBe('Shared quota is exhausted. It will recover after refresh; click to open settings and switch to your own API Key. No new AI request will be queued.')
    expect(describedByText(advance)).toBe('Shared quota is exhausted. It will recover after refresh; click to open settings and switch to your own API Key. No new AI request will be queued.')
    const status = screen.getByTestId('classroom-intent-shared-quota-status')
    expect(status.textContent).toBe('Shared quota is exhausted. Click an action to open settings and switch to your own API Key. No new AI request will be queued.')
    expect(status.textContent).not.toContain('共享额度')

    fireEvent.click(advance)

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('opens settings instead of queuing an intent when the AI service config is incomplete', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })
    const dispatch = vi.fn()

    render(<ClassroomIntentBar session={classroomWithContent()} dispatch={dispatch} disabled={false} />, { wrapper: Wrapper })

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.disabled).toBe(false)
    expect(advance.getAttribute('title')).toBe('需要先完成 AI 服务配置。点击会打开设置，不会排队新的 AI 请求。')
    expect(describedByText(advance)).toBe('需要先完成 AI 服务配置。点击会打开设置，不会排队新的 AI 请求。')
    const status = screen.getByTestId('classroom-intent-config-status')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('AI 服务还没配置。点击任一 AI 操作会打开设置，不会排队新的请求。')
    expect(status.className).toContain('max-w-[min(82vw,30rem)]')
    expect(status.className).toContain('whitespace-normal')
    expect(status.className).toContain('break-words')
    expect(status.className).toContain('classroom-warning')
    expect(status.querySelector('span')?.className).toContain('min-w-0')
    expect(status.querySelector('span')?.className).toContain('break-words')
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(advance)

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy when AI service config is incomplete', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })
    const dispatch = vi.fn()

    render(<ClassroomIntentBar session={classroomWithContent('en')} dispatch={dispatch} disabled={false} />, { wrapper: EnWrapper })

    const advance = screen.getByTestId('classroom-intent-advance') as HTMLButtonElement
    expect(advance.getAttribute('title')).toBe('Complete AI service setup first. Clicking will open settings and will not queue a new AI request.')
    expect(describedByText(advance)).toBe('Complete AI service setup first. Clicking will open settings and will not queue a new AI request.')
    const status = screen.getByTestId('classroom-intent-config-status')
    expect(status.textContent).toBe('AI service is not configured yet. Clicking any AI action will open settings and will not queue a new request.')

    fireEvent.click(advance)

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })
})
