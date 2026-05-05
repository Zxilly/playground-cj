import { describe, expect, it } from 'vitest'
import { CHAT_AGENT_SYSTEM_PROMPT, CHAT_AGENT_TOOL_NAMES } from './chat-agent'

describe('chatAgent contract', () => {
  it('is the only natural-language user interface and cannot author official lesson content', () => {
    expect(CHAT_AGENT_SYSTEM_PROMPT).toContain('ChatAgent')
    expect(CHAT_AGENT_SYSTEM_PROMPT).toContain('only natural-language')

    expect(CHAT_AGENT_TOOL_NAMES).toEqual([
      'read_classroom_state',
      'read_current_quiz',
      'read_editor_code',
      'read_last_run',
      'read_concepts',
      'mcp_call_tool',
      'emit_classroom_event',
      'highlight_editor_lines',
      'underline_editor_range',
      'reveal_editor_line',
      'clear_editor_annotations',
    ])
    expect(CHAT_AGENT_TOOL_NAMES).not.toContain('append_lesson_content')
    expect(CHAT_AGENT_TOOL_NAMES).not.toContain('set_current_quiz')
    expect(CHAT_AGENT_TOOL_NAMES).not.toContain('set_learning_notes')
  })
})
