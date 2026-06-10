export const LESSON_GENERATION_READING_TOOL_NAMES = [
  'read_classroom_state',
  'read_lesson_outline',
  'read_review_artifact_groups',
  'read_course_content_pack',
  'read_concepts',
] as const

export const LESSON_GENERATION_REFERENCE_TOOL_NAMES = [
  'mcp_call_tool',
] as const

export const LESSON_ORCHESTRATION_TOOL_NAME_LIST = [
  'append_content_reference_group',
  'append_bridge_note',
  'append_skip_marker',
  'create_exercise_instance',
  'save_clarification',
  'save_remediation',
] as const

export const LESSON_GENERATION_TOOL_NAMES = [
  ...LESSON_GENERATION_READING_TOOL_NAMES,
  ...LESSON_GENERATION_REFERENCE_TOOL_NAMES,
  ...LESSON_ORCHESTRATION_TOOL_NAME_LIST,
] as const

export type LessonGenerationToolName = typeof LESSON_GENERATION_TOOL_NAMES[number]
export type LessonOrchestrationToolName = typeof LESSON_ORCHESTRATION_TOOL_NAME_LIST[number]

export const LESSON_ORCHESTRATION_TOOL_NAMES = new Set<LessonGenerationToolName>(
  LESSON_ORCHESTRATION_TOOL_NAME_LIST,
)

export const LESSON_MUTATING_TOOL_NAMES = LESSON_ORCHESTRATION_TOOL_NAMES

export type ClassroomToolStatusCategory
  = | 'orchestration'
    | 'exercise'
    | 'planning'
    | 'reading_state'
    | 'reading_code'
    | 'annotation'
    | 'intent'
    | 'reference'

export type ClassroomToolStatusLabelKey
  = | 'selecting_reusable_content'
    | 'connecting_learning_path'
    | 'recording_skipped_content'
    | 'preparing_exercise'
    | 'saving_clarification'
    | 'saving_remediation'
    | 'reading_progress'
    | 'reading_code'
    | 'annotating_code'
    | 'preparing_code_suggestion'
    | 'organizing_request'
    | 'looking_up_reference'

export interface ClassroomToolStatusMetadata {
  category: ClassroomToolStatusCategory
  labelKey: ClassroomToolStatusLabelKey
}

export const CLASSROOM_TOOL_STATUS_METADATA_BY_NAME = {
  read_classroom_state: { category: 'reading_state', labelKey: 'reading_progress' },
  read_current_exercise: { category: 'reading_state', labelKey: 'reading_progress' },
  read_last_run: { category: 'reading_state', labelKey: 'reading_progress' },
  read_concepts: { category: 'reading_state', labelKey: 'reading_progress' },
  read_lesson_outline: { category: 'reading_state', labelKey: 'reading_progress' },
  read_review_artifact_groups: { category: 'reading_state', labelKey: 'reading_progress' },
  read_course_content_pack: { category: 'reading_state', labelKey: 'reading_progress' },
  read_editor_code: { category: 'reading_code', labelKey: 'reading_code' },
  mcp_call_tool: { category: 'reference', labelKey: 'looking_up_reference' },
  mcp_call: { category: 'reference', labelKey: 'looking_up_reference' },
  emit_classroom_event: { category: 'intent', labelKey: 'organizing_request' },
  highlight_editor_lines: { category: 'annotation', labelKey: 'annotating_code' },
  underline_editor_range: { category: 'annotation', labelKey: 'annotating_code' },
  reveal_editor_line: { category: 'annotation', labelKey: 'annotating_code' },
  clear_editor_annotations: { category: 'annotation', labelKey: 'annotating_code' },
  suggest_code_change: { category: 'annotation', labelKey: 'preparing_code_suggestion' },
  append_content_reference_group: { category: 'orchestration', labelKey: 'selecting_reusable_content' },
  append_bridge_note: { category: 'orchestration', labelKey: 'connecting_learning_path' },
  append_skip_marker: { category: 'orchestration', labelKey: 'recording_skipped_content' },
  save_clarification: { category: 'orchestration', labelKey: 'saving_clarification' },
  save_remediation: { category: 'orchestration', labelKey: 'saving_remediation' },
  create_exercise_instance: { category: 'exercise', labelKey: 'preparing_exercise' },
} as const satisfies Record<string, ClassroomToolStatusMetadata>

export function getClassroomToolStatusMetadata(toolName: string): ClassroomToolStatusMetadata | undefined {
  return CLASSROOM_TOOL_STATUS_METADATA_BY_NAME[toolName as keyof typeof CLASSROOM_TOOL_STATUS_METADATA_BY_NAME]
}

export function isLessonGenerationToolName(name: string): name is LessonGenerationToolName {
  return (LESSON_GENERATION_TOOL_NAMES as readonly string[]).includes(name)
}

export function isLessonOrchestrationTool(name: string): name is LessonOrchestrationToolName {
  return (LESSON_ORCHESTRATION_TOOL_NAMES as Set<string>).has(name)
}

export type LessonOrchestrationToolResultEvaluation
  = | { orchestration: false }
    | { orchestration: true, succeeded: true }
    | { orchestration: true, succeeded: false, failureDetail?: unknown }

export function evaluateLessonOrchestrationToolResult(toolName: string, output: unknown): LessonOrchestrationToolResultEvaluation {
  if (!isLessonOrchestrationTool(toolName))
    return { orchestration: false }

  if (isOkToolResult(output))
    return { orchestration: true, succeeded: true }

  return {
    orchestration: true,
    succeeded: false,
    failureDetail: readToolResultError(output),
  }
}

function isOkToolResult(output: unknown): boolean {
  return Boolean(output && typeof output === 'object' && (output as { ok?: unknown }).ok === true)
}

function readToolResultError(output: unknown): unknown {
  if (!output || typeof output !== 'object')
    return undefined
  return (output as { error?: unknown }).error
}
