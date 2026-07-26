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
        ['--thread-max-width' as string]: '46rem',
        ['--composer-radius' as string]: '14px',
        ['--composer-padding' as string]: '8px',
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        // Keep the scrollbar gutter stable while assistant-ui animates tool
        // and reasoning sections.
        className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-scroll scroll-smooth motion-reduce:scroll-auto [&]:[scrollbar-gutter:stable] [&]:[scrollbar-width:auto!important]"
      >
        <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-3 pt-3 sm:px-4 sm:pt-4">
          <AuiIf condition={s => s.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-8 flex flex-col gap-y-7 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-3 overflow-visible border-t border-border bg-background pb-3 pt-3 sm:pb-4">
            <ThreadScrollToBottom />
            <ThreadComposer allowAttachments={allowAttachments} />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}
