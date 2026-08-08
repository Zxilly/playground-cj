'use client'

import { useAuiState } from '@assistant-ui/react'
import { Trans } from '@lingui/react/macro'

export function ThreadStatusAnnouncer() {
  const running = useAuiState(state => state.thread.isRunning)
  const lastAssistantStatusType = useAuiState((state) => {
    const message = state.thread.messages.at(-1)
    return message?.role === 'assistant' ? message.status?.type : undefined
  })
  const lastAssistantIncompleteReason = useAuiState((state) => {
    const message = state.thread.messages.at(-1)
    return message?.role === 'assistant' && message.status?.type === 'incomplete'
      ? message.status.reason
      : undefined
  })
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="thread-status-announcer"
      className="sr-only"
    >
      {running
        ? <Trans>老师正在生成回复…</Trans>
        : lastAssistantIncompleteReason === 'cancelled'
          ? <Trans>老师回复已停止</Trans>
          : lastAssistantStatusType === 'complete'
            ? <Trans>老师回复已完成</Trans>
            : null}
    </p>
  )
}
