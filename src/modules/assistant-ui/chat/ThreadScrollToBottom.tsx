import { ThreadPrimitive } from '@assistant-ui/react'
import { ArrowDownIcon } from 'lucide-react'
import type { FC } from 'react'
import { t } from '@lingui/core/macro'
import { TooltipIconButton } from '@/modules/assistant-ui/registry/TooltipIconButton'

export const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip={t`回到最新内容`}
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:border-border dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}
