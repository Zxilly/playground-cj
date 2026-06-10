import { AuiIf, ThreadPrimitive } from '@assistant-ui/react'
import type { FC } from 'react'
import { ThreadComposer } from '@/modules/assistant-ui/chat/ThreadComposer'
import { ThreadMessage } from '@/modules/assistant-ui/chat/ThreadMessages'
import { ThreadScrollToBottom } from '@/modules/assistant-ui/chat/ThreadScrollToBottom'
import { ThreadWelcome } from '@/modules/assistant-ui/chat/ThreadWelcome'

interface ThreadProps {
  allowAttachments?: boolean
}

export const Thread: FC<ThreadProps> = ({ allowAttachments = true }) => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{
        ['--thread-max-width' as string]: '44rem',
        ['--composer-radius' as string]: '24px',
        ['--composer-padding' as string]: '10px',
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        // Keep the scrollbar gutter stable while assistant-ui animates tool
        // and reasoning sections.
        className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-scroll scroll-smooth [&]:[scrollbar-width:auto!important]"
      >
        <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
          <AuiIf condition={s => s.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-10 flex flex-col gap-y-8 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) bg-background pb-4 md:pb-6">
            <ThreadScrollToBottom />
            <ThreadComposer allowAttachments={allowAttachments} />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}
