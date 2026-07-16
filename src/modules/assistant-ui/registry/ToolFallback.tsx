'use client'

import { memo, useCallback, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  XCircleIcon,
} from 'lucide-react'
import { useScrollLock } from '@assistant-ui/react'
import { Trans } from '@lingui/react/macro'
import type { ToolCallMessagePartComponent, ToolCallMessagePartStatus } from '@assistant-ui/react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const ANIMATION_DURATION = 200

export type ToolFallbackRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  'open' | 'onOpenChange'
> & {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

function ToolFallbackRoot({
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ToolFallbackRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        lockScroll()
      }
      if (!isControlled) {
        setUncontrolledOpen(open)
      }
      controlledOnOpenChange?.(open)
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  )

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="tool-fallback-root"
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        'aui-tool-fallback-root group/tool-fallback-root w-full rounded-xl border border-border/65 bg-muted/18 py-3',
        className,
      )}
      style={
        {
          '--animation-duration': `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Collapsible>
  )
}

type ToolStatus = ToolCallMessagePartStatus['type']

const statusIconMap: Record<ToolStatus, React.ElementType> = {
  'running': LoaderIcon,
  'complete': CheckIcon,
  'incomplete': XCircleIcon,
  'requires-action': AlertCircleIcon,
}

function ToolFallbackTrigger({
  toolName,
  status,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string
  status?: ToolCallMessagePartStatus
}) {
  const statusType = status?.type ?? 'complete'
  const isRunning = statusType === 'running'
  const isCancelled
    = status?.type === 'incomplete' && status.reason === 'cancelled'
  const isFailed = status?.type === 'incomplete' && !isCancelled

  const Icon = statusIconMap[statusType]
  const label = isRunning
    ? <Trans>正在调用工具</Trans>
    : isCancelled
      ? <Trans>已取消工具调用</Trans>
      : isFailed
        ? <Trans>工具调用失败</Trans>
        : <Trans>已调用工具</Trans>

  return (
    <CollapsibleTrigger
      data-slot="tool-fallback-trigger"
      className={cn(
        'aui-tool-fallback-trigger group/trigger flex w-full items-center gap-2 px-3.5 text-xs transition-colors hover:text-foreground',
        className,
      )}
      {...props}
    >
      <Icon
        data-slot="tool-fallback-trigger-icon"
        className={cn(
          'aui-tool-fallback-trigger-icon size-4 shrink-0',
          isCancelled && 'text-muted-foreground',
          isRunning && 'animate-spin motion-reduce:animate-none',
          isFailed && 'text-destructive',
        )}
      />
      <span
        data-slot="tool-fallback-trigger-label"
        className={cn(
          'aui-tool-fallback-trigger-label-wrapper relative inline-flex min-w-0 grow items-center gap-1.5 text-start leading-none',
          isCancelled && 'text-muted-foreground line-through',
        )}
      >
        <span className="shrink-0">{label}</span>
        <code className="truncate rounded bg-background/65 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80">{toolName}</code>
        {isRunning && (
          <span
            aria-hidden
            data-slot="tool-fallback-trigger-shimmer"
            className="aui-tool-fallback-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
          >
            <span>{label}</span>
          </span>
        )}
      </span>
      <ChevronDownIcon
        data-slot="tool-fallback-trigger-chevron"
        className={cn(
          'aui-tool-fallback-trigger-chevron size-4 shrink-0',
          'transition-transform duration-(--animation-duration) ease-out',
          'group-data-[state=closed]/trigger:-rotate-90',
          'group-data-[state=open]/trigger:rotate-0',
          'motion-reduce:transition-none',
        )}
      />
    </CollapsibleTrigger>
  )
}

function ToolFallbackContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-fallback-content"
      className={cn(
        'aui-tool-fallback-content relative overflow-hidden text-sm outline-none',
        'group/collapsible-content ease-out',
        'data-[state=closed]:animate-collapsible-up',
        'data-[state=open]:animate-collapsible-down',
        'data-[state=closed]:fill-mode-forwards',
        'data-[state=closed]:pointer-events-none',
        'data-[state=open]:duration-(--animation-duration)',
        'data-[state=closed]:duration-(--animation-duration)',
        className,
      )}
      {...props}
    >
      <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto border-t border-border/65 pt-2">{children}</div>
    </CollapsibleContent>
  )
}

function ToolFallbackArgs({
  argsText,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  argsText?: string
}) {
  if (!argsText)
    return null

  return (
    <div
      data-slot="tool-fallback-args"
      className={cn('aui-tool-fallback-args px-3.5', className)}
      {...props}
    >
      <pre className="aui-tool-fallback-args-value overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-background/65 p-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        {argsText}
      </pre>
    </div>
  )
}

function ToolFallbackResult({
  result,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  result?: unknown
}) {
  if (result === undefined)
    return null

  return (
    <div
      data-slot="tool-fallback-result"
      className={cn(
        'aui-tool-fallback-result border-t border-dashed border-border/70 px-3.5 pt-2',
        className,
      )}
      {...props}
    >
      <p className="aui-tool-fallback-result-header mb-1 text-xs font-semibold"><Trans>Result:</Trans></p>
      <pre className="aui-tool-fallback-result-content overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-background/65 p-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}

function ToolFallbackError({
  status,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  status?: ToolCallMessagePartStatus
}) {
  if (status?.type !== 'incomplete')
    return null

  const error = status.error
  const errorText = error
    ? typeof error === 'string'
      ? error
      : JSON.stringify(error)
    : null

  if (!errorText)
    return null

  const isCancelled = status.reason === 'cancelled'
  return (
    <div
      data-slot="tool-fallback-error"
      className={cn('aui-tool-fallback-error px-3.5', className)}
      {...props}
    >
      <p className="aui-tool-fallback-error-header font-semibold text-muted-foreground">
        {isCancelled ? <Trans>取消原因：</Trans> : <Trans>错误：</Trans>}
      </p>
      <p className="aui-tool-fallback-error-reason break-words text-muted-foreground">
        {errorText}
      </p>
    </div>
  )
}

const ToolFallbackImpl: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const isCancelled
    = status?.type === 'incomplete' && status.reason === 'cancelled'

  return (
    <ToolFallbackRoot
      className={cn(isCancelled && 'border-muted-foreground/30 bg-muted/30')}
    >
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        <ToolFallbackError status={status} />
        <ToolFallbackArgs
          argsText={argsText}
          className={cn(isCancelled && 'opacity-60')}
        />
        {!isCancelled && <ToolFallbackResult result={result} />}
      </ToolFallbackContent>
    </ToolFallbackRoot>
  )
}

const ToolFallback = memo(
  ToolFallbackImpl,
) as unknown as ToolCallMessagePartComponent & {
  Root: typeof ToolFallbackRoot
  Trigger: typeof ToolFallbackTrigger
  Content: typeof ToolFallbackContent
  Args: typeof ToolFallbackArgs
  Result: typeof ToolFallbackResult
  Error: typeof ToolFallbackError
}

ToolFallback.displayName = 'ToolFallback'
ToolFallback.Root = ToolFallbackRoot
ToolFallback.Trigger = ToolFallbackTrigger
ToolFallback.Content = ToolFallbackContent
ToolFallback.Args = ToolFallbackArgs
ToolFallback.Result = ToolFallbackResult
ToolFallback.Error = ToolFallbackError

export {
  ToolFallback,
  ToolFallbackArgs,
  ToolFallbackContent,
  ToolFallbackError,
  ToolFallbackResult,
  ToolFallbackRoot,
  ToolFallbackTrigger,
}
