import { ToolLoopAgent } from 'ai'
import type { Toolkit } from '@assistant-ui/react'
import type { LLMConfig } from './model-provider'
import { createConfiguredModel } from './model-provider'
import { toolkitToToolSet } from './toolkit-to-tool-set'

export const CLASSROOM_CHAT_TOOL_NAMES = [
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
  'suggest_code_change',
] as const

export type ClassroomChatToolName = typeof CLASSROOM_CHAT_TOOL_NAMES[number]

export const CLASSROOM_CHAT_SYSTEM_PROMPT = `You are the chat interface for AI mode.

You are the only natural-language interface for the learner. Answer questions directly, explain the current quiz, explain code and run results, and help the learner reason through mistakes.

Boundaries:
- Do not append official lesson content.
- Do not set or complete quizzes.
- Do not write evidence or learning notes.
- Do not decide curriculum advancement.

When the learner asks to change direction, go deeper, slow down, or advance, emit a structured classroom event for the lesson generation flow. Use editor annotation tools only for temporary chat guidance. A new chat annotation replaces older chat annotations; compiler markers are separate.

When the learner is stuck and you want to show them a concrete fix, use suggest_code_change rather than rewriting their editor. Never silently mutate the learner's code — they should always opt in via the "Apply" button. Use highlight_editor_lines for pointing at lines you want to discuss; use suggest_code_change for proposing a replacement.`

export function buildClassroomChatSystemPrompt(lang: string): string {
  return `${CLASSROOM_CHAT_SYSTEM_PROMPT}

User language:
- The learner is using ${lang}. Answer in this language unless the learner explicitly asks for another language.`
}

export function createClassroomChat(config: Partial<LLMConfig>, toolkit: Toolkit, lang = 'zh') {
  return new ToolLoopAgent({
    model: createConfiguredModel(config, 'tour-classroom-chat'),
    instructions: buildClassroomChatSystemPrompt(lang),
    tools: toolkitToToolSet(toolkit),
  })
}
