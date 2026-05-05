import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { classroomProgressStyles } from '@/features/tour-ai/styles/ai-classroom-design'
import type { LessonAuthorProgressState, LessonAuthorProgressStatus } from '@/features/tour-ai/state/lesson-author-progress-state'

export function LessonAuthorProgressPanel({
  progress,
  visible,
  onToggle,
}: {
  progress: LessonAuthorProgressState
  visible: boolean
  onToggle: () => void
}) {
  if (!visible)
    return null

  const statusLabel = lessonAuthorProgressStatusLabel(progress.status)
  const bodyText = progress.text.trim() || (progress.status === 'running' ? '等待 agent 输出进度...' : '暂无进度详情')

  return (
    <section data-testid="lesson-author-progress-panel" className={classroomProgressStyles.root}>
      <button
        type="button"
        aria-expanded={progress.expanded}
        aria-controls="lesson-author-progress-body"
        aria-label="LessonAuthor 编写进度"
        onClick={onToggle}
        className={classroomProgressStyles.trigger}
      >
        <span className={classroomProgressStyles.triggerContent}>
          <ChevronDown className={cn(classroomProgressStyles.chevron, !progress.expanded && '-rotate-90')} />
          {progress.status === 'running' && <Loader2 className={classroomProgressStyles.spinner} />}
          <span className={classroomProgressStyles.title}>LessonAuthor 编写进度</span>
        </span>
        <span className={classroomProgressStyles.status}>{statusLabel}</span>
      </button>
      {progress.expanded && (
        <div id="lesson-author-progress-body" className={classroomProgressStyles.body}>
          <pre className={classroomProgressStyles.pre}>
            {bodyText}
          </pre>
        </div>
      )}
    </section>
  )
}

function lessonAuthorProgressStatusLabel(status: LessonAuthorProgressStatus): string {
  if (status === 'running')
    return '正在编写课程'
  if (status === 'completed')
    return '课程内容已生成'
  if (status === 'failed')
    return '生成失败'
  return '等待开始'
}
