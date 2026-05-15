import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LessonGenerationProgressPanel } from './LessonGenerationProgressPanel'
import { appendLessonGenerationProgress } from '@/features/tour-ai/state/lesson-generation-progress-state'

describe('lessonGenerationProgressPanel', () => {
  afterEach(() => {
    cleanup()
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

    expect(screen.getByRole('button', { name: /课程生成进度/ }).getAttribute('aria-expanded')).toBe('true')
    screen.getByText('读取课堂状态')

    fireEvent.click(screen.getByRole('button', { name: /课程生成进度/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
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

  it('shows an explicit API key waiting state for queued generation', () => {
    render(
      <LessonGenerationProgressPanel
        visible
        blockedReason="api_key"
        progress={{ status: 'idle', expanded: true, text: '', items: [] }}
        onToggle={vi.fn()}
      />,
    )

    screen.getByText('等待 API Key')
    screen.getByText('请在设置中配置 API Key 后继续生成课程。')
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
      toolName: 'append_paragraph',
    })

    expect(running.text).toBe('')
    expect(running.items).toEqual([
      { id: 'tool-1', type: 'tool', toolName: 'append_paragraph', status: 'running' },
    ])

    const completed = appendLessonGenerationProgress(running, {
      type: 'tool-result',
      toolCallId: 'tool-1',
      toolName: 'append_paragraph',
      output: { ok: true, appended: 1 },
    })

    expect(completed.text).toBe('')
    expect(completed.items).toEqual([
      {
        id: 'tool-1',
        type: 'tool',
        toolName: 'append_paragraph',
        status: 'completed',
        summary: '已追加 1 个内容块',
      },
    ])
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
            { id: 'tool-append', type: 'tool', toolName: 'append_paragraph', status: 'completed', summary: '已追加段落' },
            { id: 'tool-fail', type: 'tool', toolName: 'set_current_quiz', status: 'failed', summary: '参数不符合 schema' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('lesson-generation-tool-call')).toHaveLength(3)
    screen.getByText('read_classroom_state')
    screen.getByText('运行中')
    screen.getByText('append_paragraph')
    screen.getByText('已完成')
    screen.getByText('set_current_quiz')
    screen.getByText('失败')
    expect(screen.queryByText(/调用工具/)).toBeNull()
    expect(screen.queryByText(/完成工具/)).toBeNull()
  })
})
