import type { ReactNode } from 'react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LessonGenerationErrorRetry } from './LessonGenerationErrorRetry'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { useLLMConfigStore } from '@/stores/llmConfig'

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

function renderRetry(
  session: ClassroomSession,
  options: {
    retryableInitialFailure?: boolean
    retryBlockedReason?: 'running' | 'api_key' | 'shared_quota'
    readableContentAvailable?: boolean
    onRetry?: () => void
    onOpenReview?: () => void
    wrapper?: typeof Wrapper
  } = {},
) {
  const onRetry = options.onRetry ?? vi.fn()
  const onOpenReview = options.onOpenReview ?? vi.fn()
  const WrapperComponent = options.wrapper ?? Wrapper
  render(
    <WrapperComponent>
      <LessonGenerationErrorRetry
        session={session}
        retryableInitialFailure={options.retryableInitialFailure}
        retryBlockedReason={options.retryBlockedReason}
        readableContentAvailable={options.readableContentAvailable}
        onRetry={onRetry}
        onOpenReview={onOpenReview}
      />
    </WrapperComponent>,
  )
  return { onRetry, onOpenReview }
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

function createQueuedErrorSession(error = '模型超时，请稍后重试。') {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'EMIT_CHAT_INTENT',
    intent: 'go_deeper',
    summary: '继续解释 println',
    now: 1,
  })
  return classroomReducer(session, {
    type: 'LESSON_GENERATION_FAILED',
    error,
    now: 2,
  })
}

describe('lesson generation error retry', () => {
  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().setSettingsDialogOpen(false)
    useLLMConfigStore.getState().reset()
  })

  it('shows the lesson generation failure reason and recovery actions', () => {
    const session = createQueuedErrorSession()
    const { onRetry } = renderRetry(session)

    const region = screen.getByRole('region', { name: '下一步准备失败' })
    const alert = screen.getByRole('alert', { name: '下一步准备失败' })
    expect(region.contains(alert)).toBe(true)
    expect(region.getAttribute('aria-describedby')).toBe(alert.getAttribute('aria-describedby'))
    expect(alert.textContent).toContain('下一步准备失败')
    screen.getByText('可以重试；如果持续失败，请检查网络、模型和 API Key 设置。')
    const retryContext = screen.getByTestId('lesson-generation-retry-context')
    screen.getByText('将重试：深入讲解')
    const retrySafety = screen.getByTestId('lesson-generation-retry-safety')
    expect(retrySafety.textContent).toBe('恢复范围：重试只会重新准备失败的 AI 任务；不会清除已有课堂记录。')
    screen.getByText('失败原因：模型超时，请稍后重试。')
    expect(alert.getAttribute('aria-describedby')?.split(' ')).toContain(retryContext.id)
    expect(alert.getAttribute('aria-describedby')?.split(' ')).toContain(retrySafety.id)

    const retry = screen.getByRole('button', { name: '重试准备下一步' })
    expect(retry.getAttribute('aria-describedby')?.split(' ')).toContain(retryContext.id)
    expect(retry.getAttribute('aria-describedby')?.split(' ')).toContain(retrySafety.id)
    expect(retry.getAttribute('title')).toContain('将重试：深入讲解')
    expect(retry.getAttribute('title')).toContain('恢复范围：重试只会重新准备失败的 AI 任务；不会清除已有课堂记录。')
    expect(describedByText(retry)).toContain('重试只会重新准备失败的 AI 任务')
    expect(retry.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(retry.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')

    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
    const requestedStatus = screen.getByTestId('lesson-generation-retry-requested-status')
    expect(requestedStatus.getAttribute('role')).toBe('status')
    expect(requestedStatus.getAttribute('aria-live')).toBe('polite')
    expect(requestedStatus.getAttribute('aria-atomic')).toBe('true')
    expect(requestedStatus.textContent).toBe('已收到重试请求，正在准备课堂内容。')
    const runningRetry = screen.getByRole('button', { name: '正在重试...' })
    expect((runningRetry as HTMLButtonElement).disabled).toBe(true)
    expect(runningRetry.getAttribute('aria-describedby')?.split(' ')).toContain(requestedStatus.id)
    expect(runningRetry.getAttribute('title')).toContain('已收到重试请求，正在准备课堂内容。')
    expect(runningRetry.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(runningRetry.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    fireEvent.click(runningRetry)
    expect(onRetry).toHaveBeenCalledTimes(1)

    const settings = screen.getByRole('button', { name: '检查 AI 设置' })
    expect(region.contains(settings)).toBe(true)
    expect(alert.contains(settings)).toBe(false)
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置检查服务地址、API Key、模型和额度，不会立即重试。')
    expect(describedByText(settings)).toBe('打开 AI 服务设置检查服务地址、API Key、模型和额度，不会立即重试。')
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('caps long raw failure details while preserving the full title for inspection', () => {
    const rawError = `<html><body>${'模型服务返回很长的错误。'.repeat(40)}</body></html>`
    renderRetry(createQueuedErrorSession(rawError))

    const error = screen.getByText(/^失败原因：/)
    expect(error.textContent).not.toContain('<html>')
    expect(error.textContent?.length).toBeLessThanOrEqual(230)
    expect(error.textContent).toContain('...')
    expect(error.getAttribute('title')).toBe(rawError)
    expect(error.className).toContain('max-w-full')
    expect(error.className).toContain('overflow-x-auto')
    expect(error.className).toContain('break-words')
  })

  it('re-enables retry when a new failure replaces the current retry target', () => {
    const onRetry = vi.fn()
    const firstSession = createQueuedErrorSession()
    const secondSession = classroomReducer(firstSession, {
      type: 'LESSON_GENERATION_FAILED',
      error: '模型仍然超时。',
      now: 3,
    })
    const { rerender } = render(
      <Wrapper>
        <LessonGenerationErrorRetry session={firstSession} onRetry={onRetry} />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '重试准备下一步' }))
    expect((screen.getByRole('button', { name: '正在重试...' }) as HTMLButtonElement).disabled).toBe(true)

    rerender(
      <Wrapper>
        <LessonGenerationErrorRetry session={secondSession} onRetry={onRetry} />
      </Wrapper>,
    )

    expect(screen.queryByTestId('lesson-generation-retry-requested-status')).toBeNull()
    expect((screen.getByRole('button', { name: '重试准备下一步' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('re-enables retry after a running retry fails with the same reason again', () => {
    const onRetry = vi.fn()
    const firstSession = createQueuedErrorSession()
    const repeatedFailureSession = classroomReducer(firstSession, {
      type: 'LESSON_GENERATION_FAILED',
      error: '模型超时，请稍后重试。',
      now: 3,
    })
    const { rerender } = render(
      <Wrapper>
        <LessonGenerationErrorRetry session={firstSession} onRetry={onRetry} />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '重试准备下一步' }))
    expect((screen.getByRole('button', { name: '正在重试...' }) as HTMLButtonElement).disabled).toBe(true)

    rerender(
      <Wrapper>
        <LessonGenerationErrorRetry session={firstSession} retryBlockedReason="running" onRetry={onRetry} />
      </Wrapper>,
    )

    expect(screen.getByTestId('lesson-generation-retry-blocked-hint').textContent).toBe('正在重试课堂准备，请稍候。')

    rerender(
      <Wrapper>
        <LessonGenerationErrorRetry session={repeatedFailureSession} onRetry={onRetry} />
      </Wrapper>,
    )

    expect(screen.queryByTestId('lesson-generation-retry-requested-status')).toBeNull()
    expect((screen.getByRole('button', { name: '重试准备下一步' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('makes follow-up failures non-destructive when readable classroom content remains', () => {
    let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: '继续解释 println',
      now: 2,
    })
    session = classroomReducer(session, {
      type: 'LESSON_GENERATION_FAILED',
      error: '模型超时，请稍后重试。',
      now: 3,
    })
    const { onRetry, onOpenReview } = renderRetry(session, { readableContentAvailable: true })

    const region = screen.getByRole('region', { name: '这次 AI 生成失败' })
    const alert = screen.getByRole('alert', { name: '这次 AI 生成失败' })
    screen.getByText('这次 AI 生成失败')
    screen.getByText('现有课堂内容仍可阅读；可以重试这次任务，或先继续复习已生成内容。')
    screen.getByText('将重试：深入讲解')
    const retrySafety = screen.getByTestId('lesson-generation-retry-safety')
    expect(retrySafety.textContent).toBe('恢复范围：重试只会重新准备失败的 AI 任务；已生成内容、练习结果和复习笔记会保留。')
    const review = screen.getByRole('button', { name: '去复习已生成内容' })
    expect(region.contains(review)).toBe(true)
    expect(alert.contains(review)).toBe(false)
    expect(review.className).toContain('w-full')
    expect(review.className).toContain('sm:w-auto')
    expect(review.getAttribute('title')).toBe('打开复习视图查看已经生成的课堂内容，不会重试失败的 AI 任务。')
    expect(describedByText(review)).toBe('打开复习视图查看已经生成的课堂内容，不会重试失败的 AI 任务。')
    expect(review.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    const retry = screen.getByRole('button', { name: '重试这次任务' })
    expect(retry.getAttribute('title')).toContain('已生成内容、练习结果和复习笔记会保留')
    expect(describedByText(retry)).toContain('已生成内容、练习结果和复习笔记会保留')
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.click(review)
    expect(onOpenReview).toHaveBeenCalledTimes(1)
  })

  it('uses compiled English copy for readable shared-quota recovery', () => {
    let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: '继续解释 println',
      now: 2,
    })
    session = classroomReducer(session, {
      type: 'LESSON_GENERATION_FAILED',
      error: '模型超时，请稍后重试。',
      now: 3,
    })
    const { onRetry, onOpenReview } = renderRetry(session, {
      readableContentAvailable: true,
      retryBlockedReason: 'shared_quota',
      wrapper: EnWrapper,
    })

    const region = screen.getByRole('region', { name: 'This AI generation failed' })
    const alert = screen.getByRole('alert', { name: 'This AI generation failed' })
    expect(region.contains(alert)).toBe(true)
    screen.getByText('Existing classroom content remains readable. Retry this task or review the generated content first.')
    screen.getByText('Will retry: deeper explanation')
    const retrySafety = screen.getByTestId('lesson-generation-retry-safety')
    expect(retrySafety.textContent).toBe('Recovery scope: retry only prepares the failed AI task again; generated content, exercise results, and review notes will be kept.')
    const blockedHint = screen.getByTestId('lesson-generation-retry-blocked-hint')
    expect(blockedHint.textContent).toBe('Retry after shared quota refreshes, or switch to your own API Key to continue immediately.')

    const retry = screen.getByRole('button', { name: 'Retry this task' })
    expect((retry as HTMLButtonElement).disabled).toBe(true)
    expect(retry.getAttribute('aria-describedby')?.split(' ')).toContain(blockedHint.id)
    expect(retry.getAttribute('title')).toContain('Retry after shared quota refreshes, or switch to your own API Key to continue immediately.')
    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()

    const review = screen.getByRole('button', { name: 'Review generated content' })
    expect(review.getAttribute('title')).toBe('Open Review to inspect generated classroom content. This will not retry the failed AI task.')
    expect(describedByText(review)).toBe('Open Review to inspect generated classroom content. This will not retry the failed AI task.')
    fireEvent.click(review)
    expect(onOpenReview).toHaveBeenCalledTimes(1)

    const settings = screen.getByRole('button', { name: 'Use your own API Key' })
    expect(settings.getAttribute('title')).toBe('Open AI service settings and switch to your own API Key to continue immediately. This will not retry right away.')
    expect(describedByText(settings)).toBe('Open AI service settings and switch to your own API Key to continue immediately. This will not retry right away.')
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)

    expect(region.textContent).not.toContain('这次 AI 生成失败')
    expect(region.textContent).not.toContain('共享额度刷新后再重试')
    expect(region.textContent).not.toContain('打开 AI 服务设置')
  })

  it('does not offer review navigation for empty initial failures', () => {
    renderRetry(createInitialClassroomSession({ lang: 'zh' }), { retryableInitialFailure: true })

    expect(screen.queryByRole('button', { name: '去复习已生成内容' })).toBeNull()
  })

  it('keeps a retry entry point for initial failures even when no stream error was recorded', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    const { onRetry } = renderRetry(session, { retryableInitialFailure: true })

    screen.getByText('课堂准备失败')
    screen.getByText('将重试：首次课堂准备')
    expect(screen.queryByText(/^失败原因：/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '重试准备课堂' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables retry while a retry is already preparing content', () => {
    const session = createQueuedErrorSession()
    const { onRetry } = renderRetry(session, { retryBlockedReason: 'running' })

    screen.getByText('正在重试课堂准备，请稍候。')
    const blockedHint = screen.getByTestId('lesson-generation-retry-blocked-hint')
    expect(screen.getByRole('status')).toBe(blockedHint)
    expect(blockedHint.getAttribute('aria-live')).toBe('polite')
    expect(blockedHint.getAttribute('aria-atomic')).toBe('true')
    const retry = screen.getByRole('button', { name: '正在重试...' })
    expect((retry as HTMLButtonElement).disabled).toBe(true)
    expect(retry.getAttribute('aria-describedby')?.split(' ')).toContain(blockedHint.id)
    expect(retry.getAttribute('title')).toContain('正在重试课堂准备，请稍候。')
    expect(retry.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(retry.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')

    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('points learners to settings when retry is blocked by API configuration', () => {
    const session = createQueuedErrorSession()
    const { onRetry } = renderRetry(session, { retryBlockedReason: 'api_key' })

    screen.getByText('完成 AI 服务配置后再重试。')
    const blockedHint = screen.getByTestId('lesson-generation-retry-blocked-hint')
    const retry = screen.getByRole('button', { name: '重试准备下一步' })
    expect((retry as HTMLButtonElement).disabled).toBe(true)
    expect(retry.getAttribute('aria-describedby')?.split(' ')).toContain(blockedHint.id)
    expect(retry.getAttribute('title')).toContain('完成 AI 服务配置后再重试。')
    expect(screen.getByRole('alert', { name: '下一步准备失败' }).getAttribute('aria-describedby')?.split(' ')).toContain(blockedHint.id)

    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()

    const settings = screen.getByRole('button', { name: '检查 AI 设置' })
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置检查服务地址、API Key、模型和额度，不会立即重试。')
    expect(describedByText(settings)).toBe('打开 AI 服务设置检查服务地址、API Key、模型和额度，不会立即重试。')
    expect(settings.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('explains shared quota blocks instead of allowing a no-op retry', () => {
    const session = createQueuedErrorSession()
    const { onRetry } = renderRetry(session, { retryBlockedReason: 'shared_quota' })

    screen.getByText('共享额度刷新后再重试，或改用自己的 API Key 立刻继续。')
    const blockedHint = screen.getByTestId('lesson-generation-retry-blocked-hint')
    const retry = screen.getByRole('button', { name: '重试准备下一步' })
    expect((retry as HTMLButtonElement).disabled).toBe(true)
    expect(retry.getAttribute('aria-describedby')?.split(' ')).toContain(blockedHint.id)
    expect(retry.getAttribute('title')).toContain('共享额度刷新后再重试，或改用自己的 API Key 立刻继续。')

    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()

    const settings = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会立即重试。')
    expect(describedByText(settings)).toBe('打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会立即重试。')
    expect(settings.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(settings)
    expect(onRetry).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('stays hidden without a queued error or retryable initial failure', () => {
    renderRetry(createInitialClassroomSession({ lang: 'zh' }))

    expect(screen.queryByText('课堂准备失败')).toBeNull()
  })
})
