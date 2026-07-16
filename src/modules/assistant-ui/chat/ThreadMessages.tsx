import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  useAuiState,
} from '@assistant-ui/react'
import {
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  LoaderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import type { FC, PropsWithChildren } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { BranchPicker } from '@/modules/assistant-ui/chat/BranchPicker'
import { MarkdownText } from '@/modules/assistant-ui/registry/MarkdownText'
import { ToolFallback } from '@/modules/assistant-ui/registry/ToolFallback'
import { TooltipIconButton } from '@/modules/assistant-ui/registry/TooltipIconButton'
import { UserMessageAttachments } from '@/modules/assistant-ui/registry/Attachment'

export const ThreadMessage: FC = () => {
  const role = useAuiState(s => s.message.role)
  const isEditing = useAuiState(s => s.message.composer.isEditing)

  if (isEditing)
    return <EditComposer />
  if (role === 'user')
    return <UserMessage />
  return <AssistantMessage />
}

export function MessageError() {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root role="alert" className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <ErrorPrimitive.Message className="aui-message-error-message min-w-0 flex-1 whitespace-pre-wrap break-words leading-5" />
          <ActionBarPrimitive.Root hideWhenRunning className="aui-message-error-action shrink-0">
            <ActionBarPrimitive.Reload asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 rounded-md border-destructive/30 bg-background px-2.5 text-destructive hover:bg-destructive/10 dark:text-red-200"
                aria-label={t`重新生成`}
              >
                <RefreshCwIcon aria-hidden="true" className="size-3.5" />
                <span><Trans>重新生成</Trans></span>
              </Button>
            </ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        </div>
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

function AssistantMessage() {
  const ACTION_BAR_PT = 'pt-1.5'
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 relative animate-in duration-150 motion-reduce:animate-none"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="wrap-break-word px-1 text-[15px] leading-relaxed text-foreground sm:px-2"
      >
        <MessagePrimitive.GroupedParts
          groupBy={(part) => {
            if (part.type === 'reasoning')
              return ['group-chainOfThought', 'group-reasoning']
            if (part.type === 'tool-call')
              return ['group-chainOfThought', 'group-tool']
            return null
          }}
        >
          {({ part, children }) => {
            switch (part.type) {
              // Reasoning + tool calls are rendered faithfully (collapsed under a
              // "思考过程" disclosure) so the learner can see what the teacher is
              // thinking and doing, and so a tool-heavy turn shows live activity
              // instead of a frozen gap.
              case 'group-chainOfThought':
                return <ChainOfThought>{children}</ChainOfThought>
              case 'group-reasoning':
                return (
                  <div className="space-y-1 text-sm leading-relaxed text-muted-foreground [&_.aui-md]:text-muted-foreground">
                    {children}
                  </div>
                )
              case 'group-tool':
                return <div className="flex flex-col gap-2">{children}</div>
              case 'text':
                return <MarkdownText />
              case 'reasoning':
                return <MarkdownText />
              case 'tool-call':
                return <ToolFallback {...part} />
              default:
                return null
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn('ms-2 flex items-center', ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  )
}

/**
 * Collapsible "思考过程" disclosure wrapping a turn's reasoning and tool calls.
 * Open while the turn is still running so the learner sees live reasoning/tool
 * activity (otherwise a tool-heavy turn looks like a frozen gap before the
 * answer streams); it auto-collapses once the turn completes, and the learner
 * can toggle it either way.
 */
function ChainOfThought({ children }: PropsWithChildren) {
  const running = useAuiState(s => s.message.status?.type === 'running')
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? running

  return (
    <Collapsible
      open={open}
      onOpenChange={setUserOpen}
      data-slot="aui_chain-of-thought"
      className="mb-3 rounded-md border border-border bg-background"
    >
      <CollapsibleTrigger className="group/cot flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        {running
          ? <LoaderIcon aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
          : <BrainIcon aria-hidden="true" className="size-3.5 shrink-0" />}
        <span className="grow">
          {running ? <Trans>正在思考…</Trans> : <Trans>思考过程</Trans>}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=closed]/cot:-rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ms-1 flex gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip={t`复制`}>
          <AuiIf condition={s => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={s => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip={t`重新生成`}>
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip={t`更多`}
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
              <DownloadIcon aria-hidden="true" className="size-4" />
              <Trans>导出为 Markdown</Trans>
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 grid animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-1 duration-150 motion-reduce:animate-none sm:px-2 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word peer rounded-md border border-border bg-muted px-4 py-2.5 text-[15px] leading-6 text-foreground empty:hidden">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  )
}

function UserActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip={t`编辑`} className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

function EditComposer() {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root ms-auto flex w-full max-w-[85%] flex-col rounded-md border border-border bg-background">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
          aria-label={t`编辑消息`}
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              <Trans>取消</Trans>
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm"><Trans>更新</Trans></Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}
