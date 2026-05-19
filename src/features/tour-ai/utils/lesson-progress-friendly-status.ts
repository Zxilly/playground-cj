import { t } from '@lingui/core/macro'

// Maps internal tool names emitted by the lesson-generation agent to plain,
// learner-facing status strings. The raw tool name (e.g. `append_concept_card`)
// leaks implementation detail and produces visual noise when each call is
// surfaced separately; the friendly label answers "what is the AI doing for me
// right now?" instead of "which function did it call?".
//
// Unknown tool names fall through to a generic "AI 正在处理…" — the caller can
// inspect `category` to decide if the raw name is worth showing as a tooltip.

export type LessonGenerationToolCategory
  = | 'authoring'
    | 'quiz'
    | 'planning'
    | 'reading_state'
    | 'reading_code'
    | 'annotation'
    | 'intent'
    | 'reference'
    | 'unknown'

export interface FriendlyToolStatus {
  category: LessonGenerationToolCategory
  label: string
}

const AUTHORING_TOOLS = new Set([
  'append_heading',
  'append_paragraph',
  'append_concept_card',
  'append_code_example',
  'append_callout',
  'append_steps',
  'append_compare',
])

const ANNOTATION_TOOLS = new Set([
  'highlight_editor_lines',
  'underline_editor_range',
  'reveal_editor_line',
  'clear_editor_annotations',
])

const SUGGESTION_TOOLS = new Set([
  'suggest_code_change',
])

const STATE_READING_TOOLS = new Set([
  'read_classroom_state',
  'read_current_quiz',
  'read_last_run',
  'read_concepts',
  'read_lesson_outline',
])

export function friendlyToolStatus(toolName: string): FriendlyToolStatus {
  if (AUTHORING_TOOLS.has(toolName))
    return { category: 'authoring', label: t`正在编写讲解内容` }
  if (toolName === 'set_current_quiz')
    return { category: 'quiz', label: t`正在准备练习题` }
  if (toolName === 'set_phase')
    return { category: 'planning', label: t`正在调整教学节奏` }
  if (toolName === 'set_learning_notes')
    return { category: 'planning', label: t`正在记录学习笔记` }
  if (STATE_READING_TOOLS.has(toolName))
    return { category: 'reading_state', label: t`正在了解你的学习进度` }
  if (toolName === 'read_editor_code')
    return { category: 'reading_code', label: t`正在查看你的代码` }
  if (ANNOTATION_TOOLS.has(toolName))
    return { category: 'annotation', label: t`正在为你标注代码` }
  if (SUGGESTION_TOOLS.has(toolName))
    return { category: 'annotation', label: t`正在准备代码建议` }
  if (toolName === 'emit_classroom_event')
    return { category: 'intent', label: t`正在整理你的请求` }
  if (toolName === 'mcp_call_tool' || toolName === 'mcp_call')
    return { category: 'reference', label: t`正在查找参考资料` }
  return { category: 'unknown', label: t`AI 正在处理…` }
}
