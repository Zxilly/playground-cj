'use client'

import { AuiIf, ComposerPrimitive, useAuiState } from '@assistant-ui/react'
import type { ThreadMessage } from '@assistant-ui/react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ComposerAddAttachment,
  ComposerAttachments,
} from '@/modules/assistant-ui/registry/Attachment'
import { TooltipIconButton } from '@/modules/assistant-ui/registry/TooltipIconButton'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'

const tPlaceholder = () => t`向 AI 课堂提问…`

function latestUserText(messages: readonly ThreadMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'user')
      continue
    const text = message.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n')
      .trim()
    return text || null
  }
  return null
}

interface ThreadComposerProps {
  allowAttachments?: boolean
}

function ComposerAction({
  allowAttachments,
  onCancel,
  onSend,
}: Required<ThreadComposerProps> & {
  onCancel: () => void
  onSend: () => void
}) {
  return (
    <div className={cn('aui-composer-action-wrapper relative flex items-center', allowAttachments ? 'justify-between' : 'justify-end')}>
      {allowAttachments && <ComposerAddAttachment />}
      <AuiIf condition={s => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={t`发送消息`}
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-11 rounded-md lg:size-9"
            aria-label={t`发送消息`}
            onClick={onSend}
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={s => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-11 rounded-md lg:size-9"
            aria-label={t`停止生成`}
            onClick={onCancel}
          >
            <SquareIcon aria-hidden="true" className="aui-composer-cancel-icon size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  )
}

export const ThreadComposer: FC<ThreadComposerProps> = ({ allowAttachments = true }) => {
  const lastUserText = useAuiState(state => latestUserText(state.thread.messages))
  const cancelledDraft = useWorkspaceStore(state => state.cancelledDraft)
  const setCancelledDraft = useWorkspaceStore(state => state.setCancelledDraft)
  const clearComposerDraft = useWorkspaceStore(state => state.clearComposerDraft)
  const composerShell = (
    <div
      data-slot="aui_composer-shell"
      className="flex w-full flex-col gap-2 rounded-md border border-border bg-background p-(--composer-padding) transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30 data-[dragging=true]:border-primary data-[dragging=true]:border-dashed data-[dragging=true]:bg-muted"
    >
      {allowAttachments && <ComposerAttachments />}
      <ComposerPrimitive.Input
        placeholder={tPlaceholder()}
        className="aui-composer-input max-h-36 min-h-11 w-full resize-none bg-transparent px-1.5 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/75 lg:min-h-10"
        rows={1}
        aria-label={t`输入消息`}
        onChange={clearComposerDraft}
      />
      <ComposerAction
        allowAttachments={allowAttachments}
        onCancel={() => {
          if (lastUserText !== null)
            setCancelledDraft(lastUserText)
        }}
        onSend={clearComposerDraft}
      />
    </div>
  )

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      {cancelledDraft !== null && (
        <p
          role="status"
          className="mb-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground"
        >
          <Trans>已停止生成。消息已放回输入框，你可以修改后重新发送。</Trans>
        </p>
      )}
      {allowAttachments
        ? <ComposerPrimitive.AttachmentDropzone asChild>{composerShell}</ComposerPrimitive.AttachmentDropzone>
        : composerShell}
    </ComposerPrimitive.Root>
  )
}
