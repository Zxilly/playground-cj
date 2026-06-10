import type { ReactNode } from 'react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonGenerationProgressPanel } from './LessonGenerationProgressPanel'
import { appendLessonGenerationProgress } from '@/features/tour-ai/state/lesson-generation-progress-state'
import type { LessonGenerationProgressState } from '@/features/tour-ai/state/lesson-generation-progress-state'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { useLLMConfigStore } from '@/stores/llmConfig'

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
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

describe('lessonGenerationProgressPanel', () => {
  beforeEach(() => {
    globalI18n.load({ zh: {} })
    globalI18n.activate('zh')
  })

  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().setSettingsDialogOpen(false)
  })

  it('exposes collapsible streaming progress without depending on style classes', () => {
    const onToggle = vi.fn()

    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '读取课堂状态',
          items: [{ id: 'text-1', type: 'text', text: '读取课堂状态' }],
        }}
        onToggle={onToggle}
      />,
    )

    const panel = screen.getByTestId('lesson-generation-progress-panel')
    const trigger = screen.getByRole('button', { name: /课堂准备进度/ })
    const body = document.getElementById(trigger.getAttribute('aria-controls')!)
    const status = document.getElementById(trigger.getAttribute('aria-describedby')!)

    expect(panel.getAttribute('aria-busy')).toBe('true')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(body).toBeTruthy()
    expect(body?.getAttribute('role')).toBe('region')
    expect(body?.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(body?.hasAttribute('hidden')).toBe(false)
    expect(status?.textContent).toBe('正在准备课堂')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.getAttribute('aria-atomic')).toBe('true')
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByText('读取课堂状态')).toBeNull()

    fireEvent.click(trigger)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('keeps the controlled progress body mounted while collapsed', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: false,
          text: '',
          items: [],
        }}
        onToggle={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: /课堂准备进度/ })
    const body = document.getElementById(trigger.getAttribute('aria-controls')!)
    const status = document.getElementById(trigger.getAttribute('aria-describedby')!)

    expect(screen.getByTestId('lesson-generation-progress-panel').getAttribute('aria-busy')).toBe('true')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(body).toBeTruthy()
    expect(body?.getAttribute('role')).toBe('region')
    expect(body?.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(body?.hasAttribute('hidden')).toBe(true)
    expect(status?.textContent).toBe('正在准备课堂')
    expect(status).toBe(screen.getByTestId('lesson-generation-progress-status'))
    expect(screen.queryByText('正在连接课堂内容和练习规划，通常需要几秒。若长时间没有变化，请检查网络或 API 设置。')).toBeNull()
  })

  it('uses unique disclosure ids when multiple progress panels render', () => {
    render(
      <>
        <LessonGenerationProgressPanel
          visible
          progress={{ status: 'running', expanded: false, text: '', items: [] }}
          onToggle={vi.fn()}
        />
        <LessonGenerationProgressPanel
          visible
          progress={{ status: 'failed', expanded: false, text: '', items: [] }}
          onToggle={vi.fn()}
        />
      </>,
    )

    const triggers = screen.getAllByRole('button', { name: /课堂准备进度/ })
    const bodyIds = triggers.map(trigger => trigger.getAttribute('aria-controls'))

    expect(new Set(bodyIds).size).toBe(2)
    for (const trigger of triggers) {
      const body = document.getElementById(trigger.getAttribute('aria-controls')!)
      const status = document.getElementById(trigger.getAttribute('aria-describedby')!)
      expect(body).toBeTruthy()
      expect(body?.getAttribute('aria-labelledby')).toBe(trigger.id)
      expect(status).toBeTruthy()
    }
  })

  it('does not reopen a completed panel when a late stream chunk arrives', () => {
    const state = appendLessonGenerationProgress({
      status: 'completed',
      expanded: false,
      text: 'old',
      items: [],
    }, 'new')

    expect(state).toMatchObject({
      status: 'completed',
      expanded: false,
      text: 'oldnew',
    })
  })

  it('hides completed collapsed progress instead of keeping stale status visible', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{ status: 'completed', expanded: false, text: 'done', items: [] }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('lesson-generation-progress-panel')).toBeNull()
  })

  it('shows an explicit AI service config waiting state for queued generation', () => {
    const onToggle = vi.fn()
    render(
      <LessonGenerationProgressPanel
        visible
        blockedReason="api_key"
        progress={{ status: 'idle', expanded: true, text: '', items: [] }}
        onToggle={onToggle}
      />,
    )

    screen.getByText('等待 AI 服务配置')
    const trigger = screen.getByRole('button', { name: '课堂准备进度' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-disabled')).toBe('true')
    expect(trigger.getAttribute('title')).toBe('完成 AI 服务配置前，进度面板会保持展开。')
    expect(describedByText(trigger)).toContain('等待 AI 服务配置')
    expect(describedByText(trigger)).toContain('完成 AI 服务配置前，进度面板会保持展开。')
    fireEvent.click(trigger)
    expect(onToggle).not.toHaveBeenCalled()
    expect(screen.getByTestId('lesson-generation-progress-panel').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByTestId('lesson-generation-progress-status').textContent).toBe('等待 AI 服务配置')
    screen.getByText('请先完成 AI 服务配置后继续准备下一步。')
    const cta = screen.getByTestId('lesson-generation-api-key-cta')
    const status = within(cta).getByRole('status')
    expect(cta.getAttribute('role')).toBeNull()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('请先完成 AI 服务配置后继续准备下一步。')
    expect(cta.className).toContain('flex-col')
    const settings = screen.getByRole('button', { name: '打开设置' })
    expect(settings.className).toContain('w-full')
    expect(describedByText(settings)).toBe('请先完成 AI 服务配置后继续准备下一步。')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置完成服务地址、API Key 和模型配置；不会立即重试或清除已生成内容。')

    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('shows an explicit shared quota waiting state for queued generation', () => {
    const onToggle = vi.fn()
    render(
      <LessonGenerationProgressPanel
        visible
        blockedReason="shared_quota"
        progress={{ status: 'idle', expanded: true, text: '', items: [] }}
        onToggle={onToggle}
      />,
    )

    screen.getByText('等待共享额度')
    const trigger = screen.getByRole('button', { name: '课堂准备进度' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-disabled')).toBe('true')
    expect(trigger.getAttribute('title')).toBe('等待共享额度期间，进度面板会保持展开。')
    expect(describedByText(trigger)).toContain('等待共享额度')
    expect(describedByText(trigger)).toContain('等待共享额度期间，进度面板会保持展开。')
    fireEvent.click(trigger)
    expect(onToggle).not.toHaveBeenCalled()
    screen.getByText('共享额度已用完。刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。')
    const cta = screen.getByTestId('lesson-generation-shared-quota-cta')
    const status = within(cta).getByRole('status')
    expect(cta.getAttribute('role')).toBeNull()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('共享额度已用完。刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。')
    expect(cta.className).toContain('flex-col')
    const settings = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(settings.className).toContain('w-full')
    expect(describedByText(settings)).toBe('共享额度已用完。刷新后课堂会自动继续准备下一步；使用自己的 API Key 可立刻继续。')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的课堂任务或清除已生成内容。')

    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for shared quota waiting recovery', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        blockedReason="shared_quota"
        progress={{ status: 'idle', expanded: true, text: '', items: [] }}
        onToggle={vi.fn()}
      />,
      { wrapper: EnWrapper },
    )

    screen.getByText('Waiting for shared quota')
    const trigger = screen.getByRole('button', { name: 'Classroom preparation progress' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-disabled')).toBe('true')
    expect(trigger.getAttribute('title')).toBe('The progress panel stays expanded while waiting for shared quota.')
    expect(describedByText(trigger)).toContain('Waiting for shared quota')
    expect(describedByText(trigger)).toContain('The progress panel stays expanded while waiting for shared quota.')

    const cta = screen.getByTestId('lesson-generation-shared-quota-cta')
    const status = within(cta).getByRole('status')
    expect(status.textContent).toBe('Shared quota is exhausted. After it refreshes, the classroom will automatically continue preparing the next step; use your own API Key to continue immediately.')
    const settings = screen.getByRole('button', { name: 'Use your own API Key' })
    expect(describedByText(settings)).toBe('Shared quota is exhausted. After it refreshes, the classroom will automatically continue preparing the next step; use your own API Key to continue immediately.')
    expect(settings.getAttribute('title')).toBe('Open AI service settings and switch to your own API Key to continue immediately. This will not queue a new classroom task or clear generated content.')
    expect(cta.textContent).not.toContain('共享额度')
  })

  it('announces automatic continuation after shared quota recovers', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        recoveryReason="shared_quota_auto"
        progress={{ status: 'running', expanded: true, text: '', items: [] }}
        onToggle={vi.fn()}
      />,
    )

    screen.getByText('共享额度已恢复，课堂正在继续准备 AI 内容。')
    const hint = screen.getByTestId('lesson-generation-recovery-hint')
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.getAttribute('aria-live')).toBe('polite')
    expect(hint.getAttribute('aria-atomic')).toBe('true')
    expect(hint.className).toContain('classroom-success')
    expect(hint.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByText('正在连接课堂内容和练习规划，通常需要几秒。若长时间没有变化，请检查网络或 API 设置。')).toBeNull()
  })

  it('announces continuation after the learner switches to a user key', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        recoveryReason="shared_quota_user_key"
        progress={{ status: 'running', expanded: true, text: '', items: [] }}
        onToggle={vi.fn()}
      />,
    )

    screen.getByText('已切换到你的 API Key，课堂正在继续准备 AI 内容。')
    expect(screen.getByTestId('lesson-generation-recovery-hint').className).toContain('classroom-success')
  })

  it('surfaces a long-running generation as a recoverable waiting state', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        stalled
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [{ id: 'tool-read', type: 'tool', toolName: 'read_classroom_state', status: 'running' }],
        }}
        onToggle={vi.fn()}
      />,
    )

    screen.getByText('等待 AI 响应')
    screen.getByText('AI 响应时间比预期更久。已生成内容不会丢失，你可以继续等待，或检查网络和 AI 设置。')
    screen.getByText('正在了解你的学习进度')
    const hint = screen.getByTestId('lesson-generation-stalled-hint')
    const status = within(hint).getByRole('status')
    expect(hint.getAttribute('role')).toBeNull()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(screen.queryByText('正在连接课堂内容和练习规划，通常需要几秒。若长时间没有变化，请检查网络或 API 设置。')).toBeNull()

    const settings = screen.getByRole('button', { name: '检查 AI 设置' })
    const describedBy = settings.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toBe('AI 响应时间比预期更久。已生成内容不会丢失，你可以继续等待，或检查网络和 AI 设置。')
    expect(settings.getAttribute('title')).toBe('打开 AI 服务设置检查服务地址、API Key、模型和额度；不会立即重试或清除已生成内容。')
    expect(settings.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('keeps progress header and tool summaries readable on narrow screens', () => {
    const longSummary = `summary-${'x'.repeat(96)}`
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [
            {
              id: 'tool-long',
              type: 'tool',
              toolName: 'append_content_reference_group',
              status: 'completed',
              summary: longSummary,
            },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '课堂准备进度' })
    expect(screen.getByText('课堂准备进度').className).toContain('break-words')
    const status = screen.getByTestId('lesson-generation-progress-status')
    expect(status.className).toContain('max-w-[45%]')
    expect(status.className).toContain('break-words')
    expect(describedByText(trigger)).toContain('正在准备课堂')

    const summary = screen.getByTestId('lesson-generation-tool-summary')
    expect(summary.textContent).toBe(longSummary)
    expect(summary.className).toContain('break-words')
  })

  it('uses compiled English copy for stalled and recovered generation states', () => {
    const { rerender } = render(
      <LessonGenerationProgressPanel
        visible
        stalled
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [{ id: 'tool-read', type: 'tool', toolName: 'read_classroom_state', status: 'running' }],
        }}
        onToggle={vi.fn()}
      />,
      { wrapper: EnWrapper },
    )

    screen.getByText('Waiting for AI response')
    screen.getByText('AI is taking longer than expected. Generated content will not be lost; you can keep waiting or check your network and AI settings.')
    const settings = screen.getByRole('button', { name: 'Check AI settings' })
    expect(settings.getAttribute('title')).toBe('Open AI service settings to check service address, API Key, model, and quota. This will not retry immediately or clear generated content.')
    expect(document.getElementById(settings.getAttribute('aria-describedby')!)?.textContent).toBe('AI is taking longer than expected. Generated content will not be lost; you can keep waiting or check your network and AI settings.')

    rerender(
      <LessonGenerationProgressPanel
        visible
        recoveryReason="shared_quota_user_key"
        progress={{ status: 'running', expanded: true, text: '', items: [] }}
        onToggle={vi.fn()}
      />,
    )

    screen.getByText('Switched to your API Key. The classroom is continuing to prepare AI content.')
    expect(screen.getByTestId('lesson-generation-recovery-hint').textContent).not.toContain('已切换')
  })

  it('keeps only the latest progress text when the stream is too long', () => {
    const oldChunk = 'a'.repeat(12000)
    const latestChunk = 'latest'

    const state = appendLessonGenerationProgress({
      status: 'running',
      expanded: true,
      text: oldChunk,
      items: [{ id: 'text-1', type: 'text', text: oldChunk }],
    }, latestChunk)

    expect(state.text).toHaveLength(12000)
    expect(state.text.endsWith(latestChunk)).toBe(true)
    expect(state.text.startsWith('a'.repeat(10))).toBe(true)
  })

  it('stores tool progress as an updatable item instead of appending tool text', () => {
    const running = appendLessonGenerationProgress({
      status: 'idle',
      expanded: false,
      text: '',
      items: [],
    }, {
      type: 'tool-start',
      toolCallId: 'tool-1',
      toolName: 'append_content_reference_group',
    })

    expect(running.text).toBe('')
    expect(running.items).toEqual([
      { id: 'tool-1', type: 'tool', toolName: 'append_content_reference_group', status: 'running' },
    ])

    const completed = appendLessonGenerationProgress(running, {
      type: 'tool-result',
      toolCallId: 'tool-1',
      toolName: 'append_content_reference_group',
      output: { ok: true, appended: 1 },
    })

    expect(completed.text).toBe('')
    expect(completed.items).toEqual([
      {
        id: 'tool-1',
        type: 'tool',
        toolName: 'append_content_reference_group',
        status: 'completed',
        summary: '讲解内容已准备',
      },
    ])
  })

  it('summarizes completed orchestration tools by learner-facing action', () => {
    let state: LessonGenerationProgressState = {
      status: 'running',
      expanded: true,
      text: '',
      items: [],
    }
    for (const [toolName, output] of [
      ['append_content_reference_group', { ok: true, appended: 2 }],
      ['append_bridge_note', { ok: true }],
      ['append_skip_marker', { ok: true }],
      ['create_exercise_instance', { ok: true, templateId: 'template-1' }],
      ['save_clarification', { ok: true }],
      ['save_remediation', { ok: true }],
    ] as const) {
      state = appendLessonGenerationProgress(state, {
        type: 'tool-result',
        toolCallId: `tool-${toolName}`,
        toolName,
        output,
      })
    }

    expect(state.items).toEqual([
      expect.objectContaining({ toolName: 'append_content_reference_group', summary: '讲解内容已准备' }),
      expect.objectContaining({ toolName: 'append_bridge_note', summary: '路径说明已加入' }),
      expect.objectContaining({ toolName: 'append_skip_marker', summary: '跳过内容已记录' }),
      expect.objectContaining({ toolName: 'create_exercise_instance', summary: '练习题已准备' }),
      expect.objectContaining({ toolName: 'save_clarification', summary: '复习说明已保存' }),
      expect.objectContaining({ toolName: 'save_remediation', summary: '练习提示已保存' }),
    ])
  })

  it('localizes generated tool summaries for English classrooms', () => {
    const state = appendLessonGenerationProgress({
      status: 'running',
      expanded: true,
      text: '',
      items: [],
    }, {
      type: 'tool-result',
      toolCallId: 'tool-1',
      toolName: 'append_content_reference_group',
      output: { ok: true, appended: 2 },
    }, 'en')

    expect(state.items).toEqual([
      {
        id: 'tool-1',
        type: 'tool',
        toolName: 'append_content_reference_group',
        status: 'completed',
        summary: 'Content prepared',
      },
    ])
  })

  it('folds consecutive reasoning-delta chunks with the same id into a single item', () => {
    let state = appendLessonGenerationProgress({
      status: 'idle',
      expanded: false,
      text: '',
      items: [],
    }, { type: 'reasoning', reasoningId: 'r-1', text: '先思考一下 ' })
    state = appendLessonGenerationProgress(state, { type: 'reasoning', reasoningId: 'r-1', text: '应该读课堂状态。' })

    expect(state.text).toBe('') // reasoning is tracked as items, not in the text buffer
    expect(state.items).toEqual([
      { id: 'reasoning-r-1-0', reasoningKey: 'r-1', type: 'reasoning', text: '先思考一下 应该读课堂状态。' },
    ])
    expect(state.status).toBe('running')
    expect(state.expanded).toBe(true)
  })

  it('starts a new reasoning item when the reasoningId changes', () => {
    let state = appendLessonGenerationProgress({
      status: 'running',
      expanded: true,
      text: '',
      items: [],
    }, { type: 'reasoning', reasoningId: 'r-1', text: '想法 A' })
    state = appendLessonGenerationProgress(state, {
      type: 'tool-result',
      toolCallId: 'tool-1',
      toolName: 'read_classroom_state',
      output: { ok: true },
    })
    state = appendLessonGenerationProgress(state, { type: 'reasoning', reasoningId: 'r-2', text: '想法 B' })

    expect(state.items).toEqual([
      { id: 'reasoning-r-1-0', reasoningKey: 'r-1', type: 'reasoning', text: '想法 A' },
      { id: 'tool-1', type: 'tool', toolName: 'read_classroom_state', status: 'completed', summary: '已完成' },
      { id: 'reasoning-r-2-2', reasoningKey: 'r-2', type: 'reasoning', text: '想法 B' },
    ])
  })

  it('starts a new reasoning item even when the reasoningId is reused, if a non-reasoning item has been appended since', () => {
    // Some models keep emitting reasoning-delta with the same id across the
    // whole turn, even after tool calls. The UI must split these into separate
    // blocks so the chronological interleaving with tools is preserved.
    let state = appendLessonGenerationProgress({
      status: 'running',
      expanded: true,
      text: '',
      items: [],
    }, { type: 'reasoning', reasoningId: 'r-0', text: '先想想' })
    state = appendLessonGenerationProgress(state, {
      type: 'tool-result',
      toolCallId: 'tool-1',
      toolName: 'read_classroom_state',
      output: { ok: true },
    })
    state = appendLessonGenerationProgress(state, { type: 'reasoning', reasoningId: 'r-0', text: '现在读到了，继续' })

    expect(state.items).toEqual([
      { id: 'reasoning-r-0-0', reasoningKey: 'r-0', type: 'reasoning', text: '先想想' },
      { id: 'tool-1', type: 'tool', toolName: 'read_classroom_state', status: 'completed', summary: '已完成' },
      { id: 'reasoning-r-0-2', reasoningKey: 'r-0', type: 'reasoning', text: '现在读到了，继续' },
    ])
  })

  it('does not expose reasoning text in learner-visible progress', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [
            { id: 'tool-1', type: 'tool', toolName: 'read_classroom_state', status: 'completed' },
            { id: 'reasoning-r-1-0', reasoningKey: 'r-1', type: 'reasoning', text: '我应该先调用 read_classroom_state' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('lesson-generation-reasoning')).toBeNull()
    expect(screen.queryByText('我应该先调用 read_classroom_state')).toBeNull()
  })

  it('keeps historical reasoning hidden when later tool progress arrives', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [
            { id: 'reasoning-r-1-0', reasoningKey: 'r-1', type: 'reasoning', text: '过往的思考过程内容，应该收起。' },
            { id: 'tool-1', type: 'tool', toolName: 'append_content_reference_group', status: 'running' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('lesson-generation-reasoning')).toBeNull()
    expect(screen.queryByText('过往的思考过程内容，应该收起。')).toBeNull()
  })

  it('renders tool calls as structured components instead of progress text', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [
            { id: 'text-1', type: 'text', text: '正在规划课程' },
            { id: 'tool-read', type: 'tool', toolName: 'read_classroom_state', status: 'running' },
            { id: 'tool-append', type: 'tool', toolName: 'append_content_reference_group', status: 'completed', summary: '已追加引用' },
            { id: 'tool-fail', type: 'tool', toolName: 'create_exercise_instance', status: 'failed', summary: '参数不符合 schema' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('lesson-generation-tool-call')).toHaveLength(3)
    for (const toolCall of screen.getAllByTestId('lesson-generation-tool-call'))
      expect(toolCall.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByTestId('lesson-generation-tool-call')[0].querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(screen.getAllByTestId('lesson-generation-tool-call')[1].querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    expect(screen.getAllByTestId('lesson-generation-tool-call')[2].querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    // Raw tool names should NOT appear as visible text — they're noise for
    // learners. They remain available via the `data-tool-name` attribute so
    // developer-facing tooling can still pick them out.
    expect(screen.queryByText('read_classroom_state')).toBeNull()
    expect(screen.queryByText('append_content_reference_group')).toBeNull()
    expect(screen.queryByText('create_exercise_instance')).toBeNull()
    expect(document.querySelector('[data-tool-name="read_classroom_state"]')).not.toBeNull()
    expect(document.querySelector('[data-tool-name="append_content_reference_group"]')).not.toBeNull()
    expect(document.querySelector('[data-tool-name="create_exercise_instance"]')).not.toBeNull()
    // Learner-facing friendly labels show in place of the raw tool names.
    screen.getByText('正在了解你的学习进度')
    screen.getByText('正在准备讲解内容')
    screen.getByText('正在准备练习题')
    screen.getByText('运行中')
    screen.getByText('已完成')
    screen.getByText('已追加引用')
    screen.getByText('失败')
    screen.getByText('这一步未完成。已有内容会保留；如果准备失败，可以重试。')
    expect(screen.queryByText('这一步未完成，AI 会尝试修正。')).toBeNull()
    expect(screen.queryByText('参数不符合 schema')).toBeNull()
    expect(screen.queryByText('正在规划课程')).toBeNull()
    expect(screen.queryByText(/调用工具/)).toBeNull()
    expect(screen.queryByText(/完成工具/)).toBeNull()
  })

  it('renders specific labels for lesson orchestration tools', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [
            { id: 'content', type: 'tool', toolName: 'append_content_reference_group', status: 'running' },
            { id: 'bridge', type: 'tool', toolName: 'append_bridge_note', status: 'running' },
            { id: 'skip', type: 'tool', toolName: 'append_skip_marker', status: 'running' },
            { id: 'exercise', type: 'tool', toolName: 'create_exercise_instance', status: 'running' },
            { id: 'clarification', type: 'tool', toolName: 'save_clarification', status: 'running' },
            { id: 'remediation', type: 'tool', toolName: 'save_remediation', status: 'running' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    screen.getByText('正在准备讲解内容')
    screen.getByText('正在连接学习路径')
    screen.getByText('正在记录跳过内容')
    screen.getByText('正在准备练习题')
    screen.getByText('正在保存复习说明')
    screen.getByText('正在保存练习提示')
    expect(screen.queryByText('AI 正在处理…')).toBeNull()
  })
})
