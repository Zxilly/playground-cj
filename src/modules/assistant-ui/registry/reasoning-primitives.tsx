/* eslint-disable react-refresh/only-export-components */
'use client'

import { useCallback, useRef, useState } from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { BrainIcon, ChevronDownIcon } from 'lucide-react'
import { useScrollLock } from '@assistant-ui/react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

// Presentational primitives split out of Reasoning.tsx so they can be reused
// outside an AssistantRuntimeProvider (e.g. the lesson-generation progress
// panel) without dragging in the markdown bundle and its CSS side-effect.

const ANIMATION_DURATION = 200

const reasoningVariants = cva('aui-reasoning-root mb-4 w-full', {
  variants: {
    variant: {
      outline: 'rounded-lg border px-3 py-2',
      ghost: '',
      muted: 'rounded-lg bg-muted/50 px-3 py-2',
    },
  },
  defaultVariants: {
    variant: 'outline',
  },
})

export type ReasoningRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  'open' | 'onOpenChange'
>
& VariantProps<typeof reasoningVariants> & {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

export function ReasoningRoot({
  className,
  variant,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ReasoningRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open)
        lockScroll()
      if (!isControlled)
        setUncontrolledOpen(open)
      controlledOnOpenChange?.(open)
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  )

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="reasoning-root"
      data-variant={variant}
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        'group/reasoning-root',
        reasoningVariants({ variant, className }),
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

export function ReasoningFade({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="reasoning-fade"
      className={cn(
        'aui-reasoning-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8',
        'bg-[linear-gradient(to_top,var(--color-background),transparent)]',
        'group-data-[variant=muted]/reasoning-root:bg-[linear-gradient(to_top,hsl(var(--muted)/0.5),transparent)]',
        'fade-in-0 animate-in',
        'group-data-[state=open]/collapsible-content:animate-out',
        'group-data-[state=open]/collapsible-content:fade-out-0',
        'group-data-[state=open]/collapsible-content:delay-[calc(var(--animation-duration)*0.75)]',
        'group-data-[state=open]/collapsible-content:fill-mode-forwards',
        'duration-(--animation-duration)',
        'group-data-[state=open]/collapsible-content:duration-(--animation-duration)',
        className,
      )}
      {...props}
    />
  )
}

export function ReasoningTrigger({
  active,
  duration,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  active?: boolean
  duration?: number
}) {
  const durationText = duration ? ` (${duration}s)` : ''

  return (
    <CollapsibleTrigger
      data-slot="reasoning-trigger"
      className={cn(
        'aui-reasoning-trigger group/trigger flex max-w-[75%] items-center gap-2 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground',
        className,
      )}
      {...props}
    >
      <BrainIcon
        data-slot="reasoning-trigger-icon"
        className="aui-reasoning-trigger-icon size-4 shrink-0"
      />
      <span
        data-slot="reasoning-trigger-label"
        className="aui-reasoning-trigger-label-wrapper relative inline-block leading-none"
      >
        <span>
          Reasoning
          {durationText}
        </span>
        {active
          ? (
              <span
                aria-hidden
                data-slot="reasoning-trigger-shimmer"
                className="aui-reasoning-trigger-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
              >
                Reasoning
                {durationText}
              </span>
            )
          : null}
      </span>
      <ChevronDownIcon
        data-slot="reasoning-trigger-chevron"
        className={cn(
          'aui-reasoning-trigger-chevron mt-0.5 size-4 shrink-0',
          'transition-transform duration-(--animation-duration) ease-out',
          'group-data-[state=closed]/trigger:-rotate-90',
          'group-data-[state=open]/trigger:rotate-0',
        )}
      />
    </CollapsibleTrigger>
  )
}

export function ReasoningContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="reasoning-content"
      className={cn(
        'aui-reasoning-content relative overflow-hidden text-muted-foreground text-sm outline-none',
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
      {children}
      <ReasoningFade />
    </CollapsibleContent>
  )
}

export function ReasoningText({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="reasoning-text"
      className={cn(
        'aui-reasoning-text relative z-0 max-h-64 space-y-4 overflow-y-auto ps-6 pt-2 pb-2 leading-relaxed',
        'transform-gpu transition-[transform,opacity]',
        'group-data-[state=open]/collapsible-content:animate-in',
        'group-data-[state=closed]/collapsible-content:animate-out',
        'group-data-[state=open]/collapsible-content:fade-in-0',
        'group-data-[state=closed]/collapsible-content:fade-out-0',
        'group-data-[state=open]/collapsible-content:slide-in-from-top-4',
        'group-data-[state=closed]/collapsible-content:slide-out-to-top-4',
        'group-data-[state=open]/collapsible-content:duration-(--animation-duration)',
        'group-data-[state=closed]/collapsible-content:duration-(--animation-duration)',
        className,
      )}
      {...props}
    />
  )
}

export { reasoningVariants }
