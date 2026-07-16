import { AuiIf, ComposerPrimitive } from '@assistant-ui/react'
import { t } from '@lingui/core/macro'
import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
            className="aui-composer-send size-9 rounded-xl shadow-sm"
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
            className="aui-composer-cancel size-9 rounded-xl shadow-sm"
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
      className="flex w-full flex-col gap-2 rounded-(--composer-radius) border border-border/80 bg-card/96 p-(--composer-padding) shadow-[0_14px_38px_-24px_rgba(9,57,45,0.5)] transition-[border-color,box-shadow] focus-within:border-ring/70 focus-within:ring-3 focus-within:ring-ring/15 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50"
    >
      {allowAttachments && <ComposerAttachments />}
      <ComposerPrimitive.Input
        placeholder={tPlaceholder()}
        className="aui-composer-input max-h-36 min-h-10 w-full resize-none bg-transparent px-1.5 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/75"
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
