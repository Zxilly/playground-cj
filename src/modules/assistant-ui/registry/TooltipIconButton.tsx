'use client'

import type { ComponentPropsWithRef } from 'react'
import { Slot } from 'radix-ui'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function TooltipIconButton({
  children,
  tooltip,
  side = 'bottom',
  className,
  ref,
  ...rest
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          {...rest}
          className={cn('aui-button-icon size-6 p-1', className)}
          ref={ref}
        >
          <span aria-hidden="true" className="aui-button-icon-visual inline-flex items-center justify-center">
            <Slot.Slottable>{children}</Slot.Slottable>
          </span>
          <span className="aui-sr-only sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
