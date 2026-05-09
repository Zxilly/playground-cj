'use client'

import { X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { TourAIChat } from '@/features/tour-ai/components/TourAIChat'

export function ClassroomChatSidebar({ onClose }: { onClose: () => void }) {
  return (
    <aside className="flex h-full w-[390px] shrink-0 flex-col border-l border-tour-border bg-tour-surface shadow-[-12px_0_32px_rgba(31,27,22,.12)] dark:shadow-[-12px_0_32px_rgba(0,0,0,.4)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border px-4">
        <div className="text-sm font-semibold text-tour-text"><Trans>聊天</Trans></div>
        <button
          type="button"
          aria-label={t`关闭聊天`}
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <TourAIChat />
      </div>
    </aside>
  )
}
