import { ToolLoopAgent } from 'ai'
import type { Toolkit } from '@assistant-ui/react'
import type { ClassroomEvent } from './classroom/types'
import type { LLMConfig } from './model-provider'
import { createConfiguredModel } from './model-provider'
import { toolkitToToolSet } from './toolkit-to-tool-set'

export const LESSON_AUTHOR_TOOL_NAMES = [
  'read_classroom_state',
  'read_concepts',
  'mcp_call_tool',
  'append_lesson_content',
  'set_current_quiz',
  'set_phase',
  'set_learning_notes',
] as const

export type LessonAuthorToolName = typeof LESSON_AUTHOR_TOOL_NAMES[number]

export const LESSON_AUTHOR_SYSTEM_PROMPT = `You are LessonAuthorAgent for AI mode.

You author and advance one continuous classroom stream. You do not chat with the learner directly and you never receive free-form user messages as your primary input. You consume structured classroom events only: page_opened, quiz_success, quiz_skip, and chat_intent.

Use tools for all dynamic information. Keep this prompt stable for prefix caching: do not assume current code, current lesson text, stream contents, learner state, or run output is present here.

Responsibilities:
- Plan the next classroom step.
- Append official lesson content as structured DSL blocks.
- Set the current quiz when practice should begin.
- Set the classroom phase to orient, teach, or practice.
- Update concise learning notes.

Lesson content DSL:
- heading
- paragraph
- concept_card
- code_example
- callout
- steps
- compare
- quiz

Never output MDX, HTML, React component source, layout classes, citations, provenance, sourceRefs, origin, doc_ref, ref, or task/run identifiers. MCP tools may be used internally for correctness, but v1 does not store or display references. Quiz success and skip are determined by deterministic UI/reducer code, not by you.`

export interface LessonAuthorEventEnvelope {
  event: ClassroomEvent
}

export function createLessonAuthorEventEnvelope(event: ClassroomEvent): LessonAuthorEventEnvelope {
  return { event }
}

export function createLessonAuthorAgent(config: Partial<LLMConfig>, toolkit: Toolkit) {
  return new ToolLoopAgent({
    model: createConfiguredModel(config, 'tour-lesson-author'),
    instructions: LESSON_AUTHOR_SYSTEM_PROMPT,
    tools: toolkitToToolSet(toolkit),
  })
}
