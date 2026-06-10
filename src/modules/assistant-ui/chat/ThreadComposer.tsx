import { AuiIf, ComposerPrimitive } from '@assistant-ui/react'
import { t } from '@lingui/core/macro'
import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  ComposerAddAttachment,
  ComposerAttachments,
} from '@/modules/assistant-ui/registry/Attachment'
import { TooltipIconButton } from '@/modules/assistant-ui/registry/TooltipIconButton'

const tPlaceholder = () => t`向 AI 课堂提问…`

interface ThreadComposerProps {
  allowAttachments?: boolean
}

function ComposerAction({ allowAttachments }: Required<ThreadComposerProps>) {
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      {allowAttachments && <ComposerAddAttachment />}
      <AuiIf condition={s => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={t`发送消息`}
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-8 rounded-full"
            aria-label={t`发送消息`}
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
            className="aui-composer-cancel size-8 rounded-full"
            aria-label={t`停止生成`}
          >
            <SquareIcon aria-hidden="true" className="aui-composer-cancel-icon size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  )
}

export const ThreadComposer: FC<ThreadComposerProps> = ({ allowAttachments = true }) => {
  const composerShell = (
    <div
      data-slot="aui_composer-shell"
      className="flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-background p-(--composer-padding) transition-shadow focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50"
    >
      {allowAttachments && <ComposerAttachments />}
      <ComposerPrimitive.Input
        placeholder={tPlaceholder()}
        className="aui-composer-input max-h-32 min-h-10 w-full resize-none bg-transparent px-1.75 py-1 text-sm outline-none placeholder:text-muted-foreground/80"
        rows={1}
        autoFocus
        aria-label={t`输入消息`}
      />
      <ComposerAction allowAttachments={allowAttachments} />
    </div>
  )

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      {allowAttachments
        ? <ComposerPrimitive.AttachmentDropzone asChild>{composerShell}</ComposerPrimitive.AttachmentDropzone>
        : composerShell}
    </ComposerPrimitive.Root>
  )
}
