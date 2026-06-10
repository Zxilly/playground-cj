import { t } from '@lingui/core/macro'
import type {
  ClassroomToolStatusCategory,
  ClassroomToolStatusLabelKey,
} from '@/features/tour-ai/agent/toolkit/lesson-toolkit-metadata'
import { getClassroomToolStatusMetadata } from '@/features/tour-ai/agent/toolkit/lesson-toolkit-metadata'

// Maps internal tool names emitted by the lesson-generation agent to plain,
// learner-facing status strings. The raw tool name (e.g. `append_content_reference_group`)
// leaks implementation detail and produces visual noise when each call is
// surfaced separately; the friendly label answers "what is the AI doing for me
// right now?" instead of "which function did it call?".
//
// Unknown tool names fall through to a generic "AI 正在处理…" — the caller can
// inspect `category` to decide if the raw name is worth showing as a tooltip.

export type LessonGenerationToolCategory
  = | ClassroomToolStatusCategory
    | 'unknown'

export interface FriendlyToolStatus {
  category: LessonGenerationToolCategory
  label: string
}

export function friendlyToolStatus(toolName: string): FriendlyToolStatus {
  const metadata = getClassroomToolStatusMetadata(toolName)
  if (metadata)
    return { category: metadata.category, label: friendlyToolStatusLabel(metadata.labelKey) }
  return { category: 'unknown', label: t`AI 正在处理…` }
}

function friendlyToolStatusLabel(labelKey: ClassroomToolStatusLabelKey): string {
  switch (labelKey) {
    case 'selecting_reusable_content':
      return t`正在准备讲解内容`
    case 'connecting_learning_path':
      return t`正在连接学习路径`
    case 'recording_skipped_content':
      return t`正在记录跳过内容`
    case 'preparing_exercise':
      return t`正在准备练习题`
    case 'saving_clarification':
      return t`正在保存复习说明`
    case 'saving_remediation':
      return t`正在保存练习提示`
    case 'reading_progress':
      return t`正在了解你的学习进度`
    case 'reading_code':
      return t`正在查看你的代码`
    case 'annotating_code':
      return t`正在标出相关代码`
    case 'preparing_code_suggestion':
      return t`正在准备代码建议`
    case 'organizing_request':
      return t`正在整理你的请求`
    case 'looking_up_reference':
      return t`正在查找参考资料`
    default: {
      const _exhaustive: never = labelKey
      void _exhaustive
      return t`AI 正在处理…`
    }
  }
}
