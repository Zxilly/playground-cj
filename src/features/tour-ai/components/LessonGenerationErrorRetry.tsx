import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'
import { Trans } from '@lingui/react/macro'

export function LessonGenerationErrorRetry({ session, onRetry }: { session: ClassroomSession, onRetry: () => void }) {
  if (session.eventQueue.length === 0)
    return null

  const lastError = session.stream.findLast(
    item => item.type === 'system_event' && item.event.type === 'lesson_generation_error',
  )
  if (!lastError || lastError.type !== 'system_event' || lastError.event.type !== 'lesson_generation_error')
    return null

  const errorSummary = lastError.event.summary

  return (
    <section className={cn('rounded-md border border-classroom-warning-border bg-classroom-warning-bg p-3 text-sm text-classroom-warning-fg', 'mt-4')}>
      <div className="mb-2">
        <Trans>
          课程生成失败：
          {errorSummary}
        </Trans>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg"
      >
        <Trans>重试课程生成</Trans>
      </button>
    </section>
  )
}
