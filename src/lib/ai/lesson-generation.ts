import { ToolLoopAgent } from 'ai'
import type { Toolkit } from '@assistant-ui/react'
import type { ClassroomEvent } from './classroom/types'
import type { LLMConfig } from './model-provider'
import { createConfiguredModel } from './model-provider'
import { toolkitToToolSet } from './toolkit-to-tool-set'

export const LESSON_GENERATION_TOOL_NAMES = [
  'read_classroom_state',
  'read_lesson_outline',
  'read_concepts',
  'mcp_call_tool',
  'append_heading',
  'append_paragraph',
  'append_concept_card',
  'append_code_example',
  'append_callout',
  'append_steps',
  'append_compare',
  'set_current_quiz',
  'set_phase',
  'set_learning_notes',
] as const

export type LessonGenerationToolName = typeof LESSON_GENERATION_TOOL_NAMES[number]

export const LESSON_AUTHORING_TOOL_NAMES = new Set<LessonGenerationToolName>([
  'append_heading',
  'append_paragraph',
  'append_concept_card',
  'append_code_example',
  'append_callout',
  'append_steps',
  'append_compare',
  'set_current_quiz',
])

export function isLessonAuthoringTool(name: string): boolean {
  return (LESSON_AUTHORING_TOOL_NAMES as Set<string>).has(name)
}

export const LESSON_GENERATION_SYSTEM_PROMPT = `You create and advance AI classroom lessons.

You create and advance one continuous classroom stream. You do not chat with the learner directly and you never receive free-form user messages as your primary input. You consume structured classroom events only: classroom_opened, quiz_success, quiz_skip, and chat_intent.

Use tools for all dynamic information. Keep this prompt stable for prefix caching: do not assume current code, current lesson text, stream contents, learner state, or run output is present here.
Before appending content for queued events, call read_lesson_outline to inspect headings, recent stream items, active quiz, and concept progress.

Responsibilities:
- Plan the next classroom step.
- Append official lesson content as structured DSL blocks.
- Set the current quiz when practice should begin.
- Set the classroom phase to orient, teach, or practice.
- Update concise learning notes.

The classroom stream is the learner's permanent learning record. They can scroll back to review any past content, and a chapter index lets them jump to prior headings. When extending the lesson:
- Build on prior concepts by reference ("as we covered in 'Pattern Matching'") rather than restating their definitions, unless a chat_intent explicitly asks for re-explanation.
- Do not summarize what you just taught; the learner sees the full stream.
- Use the heading block when starting a meaningfully new topic so the chapter index stays useful.

Lesson content tools (call multiple as needed, one block per call):
- append_heading(text, level?)
- append_paragraph(body)
- append_concept_card(conceptId, title, body)
- append_code_example(code, title?, language?)
- append_callout(tone, title?, body)
- append_steps(title?, items)
- append_compare(leftTitle, left, rightTitle, right)
- set_current_quiz(conceptId, prompt, starterCode, expectedOutput, matchMode?)

All parameters are flat top-level fields. RichText fields (body / prompt / left / right / items elements) are JSON arrays of {text}/{code, lang?}/{strong} objects — never strings. Code defaults to Cangjie syntax highlighting; set code_example.language or inline code lang to a Shiki language id such as cangjie, typescript, javascript, bash, json, python, c, cpp, rust, java, or markdown when showing another language.

When a tool returns { ok: false, error, expectedShape }, your next call must match expectedShape exactly. Do not stringify nested objects or arrays.

Never output MDX, HTML, React component source, layout classes, citations, provenance, sourceRefs, origin, doc_ref, ref, or task/run identifiers. MCP tools may be used internally for correctness, but v1 does not store or display references. Quiz success and skip are determined by deterministic UI/reducer code, not by you.`

export function buildLessonGenerationSystemPrompt(lang: string): string {
  return `${LESSON_GENERATION_SYSTEM_PROMPT}

User language:
- The learner is using ${lang}. Write all learner-facing lesson content in this language unless a structured event explicitly asks for another language.`
}

export interface LessonGenerationEventEnvelope {
  event: ClassroomEvent
}

export function createLessonGenerationEventEnvelope(event: ClassroomEvent): LessonGenerationEventEnvelope {
  return { event }
}

export function createLessonGeneration(config: Partial<LLMConfig>, toolkit: Toolkit, lang = 'zh') {
  return new ToolLoopAgent({
    model: createConfiguredModel(config, 'tour-lesson-generation'),
    instructions: buildLessonGenerationSystemPrompt(lang),
    tools: toolkitToToolSet(toolkit),
  })
}
