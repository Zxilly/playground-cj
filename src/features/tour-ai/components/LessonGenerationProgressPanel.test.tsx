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

  it('renders reasoning items with a distinct visual treatment', () => {
    // Reasoning is the *latest* item here, so the panel auto-opens it as the
    // active streaming block. Older reasoning items collapse by default.
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

    expect(screen.getAllByTestId('lesson-generation-reasoning')).toHaveLength(1)
    screen.getByText('我应该先调用 read_classroom_state')
  })

  it('collapses past reasoning items so the panel does not become a wall of inner monologue', () => {
    // Reasoning is no longer the latest item — it's been superseded by a tool
    // call. The reasoning block stays in the DOM via its trigger but the body
    // text is collapsed.
    render(
      <LessonGenerationProgressPanel
        visible
        progress={{
          status: 'running',
          expanded: true,
          text: '',
          items: [
            { id: 'reasoning-r-1-0', reasoningKey: 'r-1', type: 'reasoning', text: '过往的思考过程内容，应该收起。' },
            { id: 'tool-1', type: 'tool', toolName: 'append_paragraph', status: 'running' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('lesson-generation-reasoning')).toHaveLength(1)
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
            { id: 'tool-append', type: 'tool', toolName: 'append_paragraph', status: 'completed', summary: '已追加段落' },
            { id: 'tool-fail', type: 'tool', toolName: 'set_current_quiz', status: 'failed', summary: '参数不符合 schema' },
          ],
        }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('lesson-generation-tool-call')).toHaveLength(3)
    // Raw tool names should NOT appear as visible text — they're noise for
    // learners. They remain available via the `data-tool-name` attribute so
    // developer-facing tooling can still pick them out.
    expect(screen.queryByText('read_classroom_state')).toBeNull()
    expect(screen.queryByText('append_paragraph')).toBeNull()
    expect(screen.queryByText('set_current_quiz')).toBeNull()
    expect(document.querySelector('[data-tool-name="read_classroom_state"]')).not.toBeNull()
    expect(document.querySelector('[data-tool-name="append_paragraph"]')).not.toBeNull()
    expect(document.querySelector('[data-tool-name="set_current_quiz"]')).not.toBeNull()
    // Learner-facing friendly labels show in place of the raw tool names.
    screen.getByText('正在了解你的学习进度')
    screen.getByText('正在编写讲解内容')
    screen.getByText('正在准备练习题')
    screen.getByText('运行中')
    screen.getByText('已完成')
    screen.getByText('失败')
    expect(screen.queryByText(/调用工具/)).toBeNull()
    expect(screen.queryByText(/完成工具/)).toBeNull()
  })
})
