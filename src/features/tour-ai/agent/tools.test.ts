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

let session: ClassroomSession = createInitialClassroomSession({ lang: 'zh', now: 1000 })
const dispatch = vi.fn((action: ClassroomAction) => {
  session = { ...session, pendingAction: action.type === 'EMIT_CHAT_INTENT' ? 'lesson_author' : session.pendingAction }
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
  allSections: [],
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
  session = createInitialClassroomSession({ lang: 'zh', now: 1000 })
  dispatch.mockClear()
  replaceChatAnnotations.mockClear()
  clearChatAnnotations.mockClear()
  editor.revealLineInCenter.mockClear()
})

describe('ai classroom toolkits', () => {
  it('chatAgent toolkit exposes only chat-safe tools', async () => {
    const { createChatAgentToolkit } = await import('./tools')
    const toolkit = createChatAgentToolkit(bridge)

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

  it('lessonAuthor toolkit can append content and set quiz', async () => {
    const { createLessonAuthorToolkit } = await import('./tools')
    const toolkit = createLessonAuthorToolkit(bridge)

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

  it('chatAgent can emit intent and replace editor annotations without writing evidence', async () => {
    const { createChatAgentToolkit } = await import('./tools')
    const toolkit = createChatAgentToolkit(bridge)

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
})
