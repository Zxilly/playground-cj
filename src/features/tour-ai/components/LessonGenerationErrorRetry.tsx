import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { cn } from '@/lib/utils'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'

export function AuthorErrorRetry({ session, onRetry }: { session: ClassroomSession, onRetry: () => void }) {
  const lastError = [...session.stream].reverse().find(
    item => item.type === 'system_event' && item.event.type === 'lesson_author_error',
  )

  if (!lastError || lastError.type !== 'system_event' || lastError.event.type !== 'lesson_author_error' || session.eventQueue.length === 0)
    return null

  return (
    <section className={cn(aiClassroomStyles.surface.warning, 'mt-4')}>
      <div className="mb-2">
        LessonAuthor 失败：
        {lastError.event.summary}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={aiClassroomStyles.button.warning}
      >
        重试 LessonAuthor
      </button>
    </section>
  )
}
