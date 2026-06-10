'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, Eraser } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'

export function ClassroomStaleChatAnnotationsNotice({
  staleCount,
  onClear,
}: {
  staleCount: number
  onClear: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const [clearedCount, setClearedCount] = useState(0)
  const successRef = useRef<HTMLDivElement | null>(null)
  const clearedVisible = staleCount <= 0 && clearedCount > 0

  useEffect(() => {
    if (clearedCount <= 0)
      return
    const timer = window.setTimeout(setClearedCount, 3200, 0)
    return () => window.clearTimeout(timer)
  }, [clearedCount])

  useEffect(() => {
    if (clearedVisible)
      successRef.current?.focus()
  }, [clearedVisible])

  if (!clearedVisible && staleCount <= 0)
    return null

  if (clearedVisible) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        data-testid="classroom-stale-chat-annotations-cleared"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-3 flex items-start gap-2 rounded-md border border-classroom-success-border bg-classroom-success-bg px-3 py-2 text-xs leading-6 text-classroom-success-fg outline-none focus:ring-2 focus:ring-tour-link/35 focus:ring-offset-2 focus:ring-offset-tour-bg"
      >
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {t`已清除 ${clearedCount} 个旧聊天代码标记。聊天内容、代码和学习进度都没有改变。`}
        </span>
      </div>
    )
  }

  const clearActionTitle = t`只清除 ${staleCount} 个失效的聊天代码标记；不会删除聊天内容、改动代码或改变学习进度。清除后聊天可以重新标注当前位置。`
  const clear = () => {
    setClearedCount(staleCount)
    onClear()
  }

  return (
    <div
      data-testid="classroom-stale-chat-annotations-notice"
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="mt-3 flex flex-col gap-2 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:flex-row sm:items-center sm:justify-between"
    >
      <div
        id={descriptionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 leading-6"
      >
        <span id={titleId} className="font-semibold text-tour-heading">
          <Trans>聊天里的代码提示可能不是最新的。</Trans>
        </span>
        <span className="ml-1 text-muted-foreground">
          {t`代码已变化，${staleCount} 个聊天标记不再匹配当前位置。清除后可让聊天重新标注。`}
        </span>
      </div>
      <button
        type="button"
        aria-describedby={descriptionId}
        title={clearActionTitle}
        onClick={clear}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-1.5 text-xs font-semibold text-classroom-warning-fg hover:bg-tour-bg sm:w-auto"
      >
        <Eraser aria-hidden="true" className="size-3.5" />
        <Trans>清除旧标记</Trans>
      </button>
    </div>
  )
}
