'use client'

import { useId } from 'react'
import { t } from '@lingui/core/macro'

const skeletonLineClasses = [
  'h-4 w-full animate-shimmer rounded bg-tour-border-soft',
  'h-4 w-11/12 animate-shimmer rounded bg-tour-border-soft',
  'h-4 w-9/12 animate-shimmer rounded bg-tour-border-soft',
]

export function ClassroomLoadingSkeleton({
  labelledBy,
  describedBy,
  label,
}: {
  labelledBy?: string
  describedBy?: string
  label?: string
}) {
  const fallbackLabelId = useId()
  const statusLabel = label ?? t`正在加载课堂内容`

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby={labelledBy ?? fallbackLabelId}
      aria-describedby={describedBy}
      className="space-y-5"
    >
      {!labelledBy && <span id={fallbackLabelId} className="sr-only">{statusLabel}</span>}
      <div className="h-6 w-48 animate-shimmer rounded bg-tour-border-soft" />
      <div className="space-y-2">
        {skeletonLineClasses.map(className => (
          <div key={className} className={className} />
        ))}
      </div>
      <div className="h-32 w-full animate-shimmer rounded-md bg-tour-border-soft" />
      <div className="h-4 w-full animate-shimmer rounded bg-tour-border-soft" />
    </div>
  )
}
