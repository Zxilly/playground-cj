import { t } from '@lingui/core/macro'

export function ClassroomLoadingSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label={t`正在加载课程内容`} className="space-y-5">
      <div className="h-6 w-48 animate-shimmer rounded bg-tour-border-soft" />
      <div className="space-y-2">
        <div className="h-4 w-full animate-shimmer rounded bg-tour-border-soft" />
        <div className="h-4 w-11/12 animate-shimmer rounded bg-tour-border-soft" />
        <div className="h-4 w-9/12 animate-shimmer rounded bg-tour-border-soft" />
      </div>
      <div className="h-32 w-full animate-shimmer rounded-md bg-tour-border-soft" />
      <div className="h-4 w-full animate-shimmer rounded bg-tour-border-soft" />
    </div>
  )
}
