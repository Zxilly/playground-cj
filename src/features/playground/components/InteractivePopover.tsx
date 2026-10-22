import { cloneElement, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DeferredPopoverProps } from './DeferredPopover'

export default function InteractivePopover({
  trigger,
  children,
  open,
  onOpenChange,
  className,
  preventOpenAutoFocus,
}: DeferredPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  // eslint-disable-next-line react/no-clone-element -- Attach focus restoration to the single Button trigger.
  const button = cloneElement(trigger, { ref: triggerRef })
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent
        className={className}
        onOpenAutoFocus={(event) => {
          if (preventOpenAutoFocus) {
            event.preventDefault()
            triggerRef.current?.focus({ preventScroll: true })
          }
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
