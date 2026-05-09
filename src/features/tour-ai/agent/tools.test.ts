import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'

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
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
}))

const listMcpToolsMock = vi.hoisted(() => vi.fn())
const callMcpToolMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/mcp/client', () => ({
  listMcpTools: listMcpToolsMock,
  callMcpTool: callMcpToolMock,
}))

let session: ClassroomSession = createInitialClassroomSession({ lang: 'zh' })
const dispatch = vi.fn((_action: ClassroomAction) => {
  // no-op; pendingAction is derived now
})
const replaceChatAnnotations = vi.fn()
const clearChatAnnotations = vi.fn()

const model = {
  getValue: () => 'main() {\n    println(3)\n}',
  getLineCount: () => 3,
  getLineContent: (line: number) => line === 2 ? '    println(3)' : '',
  getLineMaxColumn: () => 15,
  getLanguageId: () => 'cangjie',
  getVersionId: () => 7,
  uri: 'inmemory://test.cj',
}

const editor = {
  getModel: () => model,
  revealLineInCenter: vi.fn(),
}

const bridge = {
  lang: 'zh',
  uiLang: 'zh',
  editor: {
    getEditor: () => editor,
    setEditor: vi.fn(),
  },
  classroom: {
    getSession: () => session,
    dispatch,
    replaceChatAnnotations,
    clearChatAnnotations,
  },
} as unknown as AIClassroomBridgeValue

afterEach(() => {
  session = createInitialClassroomSession({ lang: 'zh' })
  dispatch.mockClear()
  replaceChatAnnotations.mockClear()
  clearChatAnnotations.mockClear()
  editor.revealLineInCenter.mockClear()
  listMcpToolsMock.mockReset()
  callMcpToolMock.mockReset()
})

describe('ai classroom toolkits', () => {
  it('classroomChat toolkit exposes only chat-safe tools', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    expect(Object.keys(toolkit).sort()).toEqual([
      'clear_editor_annotations',
      'emit_classroom_event',
      'highlight_editor_lines',
      'mcp_call_tool',
      'read_classroom_state',
      'read_concepts',
      'read_current_quiz',
      'read_editor_code',
      'read_last_run',
      'reveal_editor_line',
      'underline_editor_range',
    ].sort())
    expect(toolkit.append_lesson_content).toBeUndefined()
    expect(toolkit.set_current_quiz).toBeUndefined()
    expect(toolkit.set_learning_notes).toBeUndefined()
  })

  it('lessonGeneration toolkit can append content and set quiz', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    await toolkit.append_lesson_content!.execute!({
      blocks: [{ type: 'heading', text: 'Bindings', level: 2 }],
    }, { toolCallId: 't1', abortSignal: new AbortController().signal, human: async () => undefined })
    await toolkit.set_current_quiz!.execute!({
      quiz: {
        type: 'quiz',
        conceptId: 'cj.bindings.let',
        prompt: [{ text: 'Print 3.' }],
        starterCode: 'main() {\n    println(0)\n}',
        expectedOutput: '3',
      },
    }, { toolCallId: 't2', abortSignal: new AbortController().signal, human: async () => undefined })

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPEND_LESSON_CONTENT',
    }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_CURRENT_QUIZ',
      quiz: expect.objectContaining({ conceptId: 'cj.bindings.let' }),
    }))
  })

  it('lessonGeneration toolkit exposes only generation-safe tools', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    expect(Object.keys(toolkit).sort()).toEqual([
      'append_lesson_content',
      'mcp_call_tool',
      'read_classroom_state',
      'read_concepts',
      'set_current_quiz',
      'set_learning_notes',
      'set_phase',
    ].sort())
    expect(toolkit.highlight_editor_lines).toBeUndefined()
    expect(toolkit.underline_editor_range).toBeUndefined()
    expect(toolkit.emit_classroom_event).toBeUndefined()
  })

  it('reads editor code with line numbers for line-specific chat help', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    const result = await toolkit.read_editor_code!.execute!({ withLineNumbers: true }, toolOptions())

    expect(result).toMatchObject({
      ok: true,
      code: '   1  main() {\n   2      println(3)\n   3  }',
      lineCount: 3,
      language: 'cangjie',
    })
  })

  it('classroomChat can emit intent and replace editor annotations without writing evidence', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    await toolkit.emit_classroom_event!.execute!({
      intent: 'go_deeper',
      summary: 'Learner asked for a deeper explanation.',
    }, { toolCallId: 't1', abortSignal: new AbortController().signal, human: async () => undefined })
    await toolkit.highlight_editor_lines!.execute!({
      startLine: 2,
      label: 'print statement',
    }, { toolCallId: 't2', abortSignal: new AbortController().signal, human: async () => undefined })

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
    }))
    expect(replaceChatAnnotations).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'highlight',
        startLine: 2,
        modelVersionId: 7,
        targetSnippet: 'println(3)',
      }),
    ])
    expect(session.learner.evidence).toEqual([])
  })

  it('returns failures when classroom or editor bridge dependencies are missing', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit({
      ...bridge,
      classroom: undefined,
      editor: { getEditor: () => null, setEditor: vi.fn() },
    } as unknown as AIClassroomBridgeValue)

    await expect(toolkit.read_classroom_state!.execute!({}, toolOptions())).resolves.toEqual({
      ok: false,
      error: 'Classroom state is not ready yet',
    })
    await expect(toolkit.read_editor_code!.execute!({}, toolOptions())).resolves.toEqual({
      ok: false,
      error: 'Editor is not ready yet',
    })
  })

  it('underlines a range using the selected line snippet and clears chat markers', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)
    const monaco = await import('@codingame/monaco-vscode-editor-api')

    await toolkit.underline_editor_range!.execute!({
      startLine: 2,
      startColumn: 5,
      endLine: 2,
      endColumn: 12,
      label: 'call',
    }, toolOptions())
    await toolkit.clear_editor_annotations!.execute!({}, toolOptions())

    expect(replaceChatAnnotations).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'underline',
        targetSnippet: 'println',
      }),
    ])
    expect(clearChatAnnotations).toHaveBeenCalled()
    expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(model, 'chat', [])
  })

  it('rejects non-quiz blocks when setting the current quiz', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.set_current_quiz!.execute!({
      quiz: { type: 'heading', text: 'Not a quiz', level: 2 },
    }, toolOptions())

    expect(result).toEqual({
      ok: false,
      error: 'set_current_quiz requires a quiz block.',
    })
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_CURRENT_QUIZ' }))
  })

  it('loads MCP tools with safe names and isolates call failures', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: 'docs.search', description: 'Search docs', inputSchema: { type: 'object' } },
      { name: 'docs/read', inputSchema: undefined },
    ])
    callMcpToolMock
      .mockResolvedValueOnce({ hits: 1 })
      .mockRejectedValueOnce(new Error('offline'))
    const { loadMcpToolkit } = await import('./tools')

    const toolkit = await loadMcpToolkit()

    expect(Object.keys(toolkit).sort()).toEqual(['mcp_docs_x2e_search', 'mcp_docs_x2f_read'])
    await expect(toolkit.mcp_docs_x2e_search!.execute!({ q: 'let' }, toolOptions())).resolves.toEqual({ hits: 1 })
    await expect(toolkit.mcp_docs_x2f_read!.execute!({}, toolOptions())).resolves.toEqual({
      ok: false,
      error: 'offline',
    })
  })

  it('returns an empty MCP toolkit when tool discovery fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    listMcpToolsMock.mockRejectedValueOnce(new Error('not connected'))
    const { loadMcpToolkit } = await import('./tools')

    await expect(loadMcpToolkit()).resolves.toEqual({})
    expect(warn).toHaveBeenCalledWith('[MCP] failed to load tools', expect.any(Error))
    warn.mockRestore()
  })

  it('safeMcpName produces collision-free names for distinct separators', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: 'a:b', inputSchema: { type: 'object' } },
      { name: 'a/b', inputSchema: { type: 'object' } },
      { name: 'a.b', inputSchema: { type: 'object' } },
    ])
    const { loadMcpToolkit } = await import('./tools')

    const toolkit = await loadMcpToolkit()
    const keys = Object.keys(toolkit)

    expect(keys).toHaveLength(3)
    expect(new Set(keys).size).toBe(3)
  })

  it('safeMcpName encodes multi-byte unicode reversibly with hex escapes', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: '中文工具', inputSchema: { type: 'object' } },
      { name: '🎉tool', inputSchema: { type: 'object' } },
    ])
    const { loadMcpToolkit } = await import('./tools')

    const toolkit = await loadMcpToolkit()
    const keys = Object.keys(toolkit)

    expect(keys).toHaveLength(2)
    // BMP CJK: each char encoded as a single _xHHHH_
    expect(keys[0]).toMatch(/^mcp_(_x[0-9a-f]+_)+$/)
    // Supplementary-plane (emoji) must encode as single 6-hex code point, not surrogate pair
    expect(keys[1]).toBe('mcp__x01f389_tool')
  })

  it('safeMcpName preserves alphanumeric and underscore unchanged', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: 'foo_bar', inputSchema: { type: 'object' } },
    ])
    const { loadMcpToolkit } = await import('./tools')

    const toolkit = await loadMcpToolkit()
    expect(Object.keys(toolkit)).toEqual(['mcp_foo_bar'])
  })

  it('safeMcpName truncates and hashes when raw name exceeds 64 chars', async () => {
    const longName = 'a'.repeat(80)
    listMcpToolsMock.mockResolvedValueOnce([
      { name: longName, inputSchema: { type: 'object' } },
    ])
    const { loadMcpToolkit } = await import('./tools')

    const toolkit = await loadMcpToolkit()
    const keys = Object.keys(toolkit)

    expect(keys).toHaveLength(1)
    expect(keys[0].length).toBeLessThanOrEqual(64)
    expect(keys[0]).toMatch(/__[0-9a-f]{8}$/)
  })
})

function toolOptions() {
  return {
    toolCallId: 'tool-call',
    abortSignal: new AbortController().signal,
    human: async () => undefined,
  }
}
