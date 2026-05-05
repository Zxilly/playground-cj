import { ToolLoopAgent } from 'ai'
import type { Toolkit } from '@assistant-ui/react'
import type { LLMConfig } from './model-provider'
import { createConfiguredModel } from './model-provider'
import { toolkitToToolSet } from './toolkit-to-tool-set'

export const CHAT_AGENT_TOOL_NAMES = [
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
] as const

export type ChatAgentToolName = typeof CHAT_AGENT_TOOL_NAMES[number]

export const CHAT_AGENT_SYSTEM_PROMPT = `You are ChatAgent for AI mode.

You are the only natural-language interface for the learner. Answer questions directly, explain the current quiz, explain code and run results, and help the learner reason through mistakes.

Boundaries:
- Do not append official lesson content.
- Do not set or complete quizzes.
- Do not write evidence or learning notes.
- Do not decide curriculum advancement.

When the learner asks to change direction, go deeper, slow down, or advance, emit a structured classroom event for LessonAuthorAgent. Use editor annotation tools only for temporary chat guidance. A new chat annotation replaces older chat annotations; compiler markers are separate.`

export function createChatAgent(config: Partial<LLMConfig>, toolkit: Toolkit) {
  return new ToolLoopAgent({
    model: createConfiguredModel(config, 'tour-chat-agent'),
    instructions: CHAT_AGENT_SYSTEM_PROMPT,
    tools: toolkitToToolSet(toolkit),
  })
}
