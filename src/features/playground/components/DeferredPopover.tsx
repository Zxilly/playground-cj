'use client'

import { cloneElement, lazy, Suspense, useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import type { Button } from '@/components/ui/button'

export interface DeferredPopoverProps {
  trigger: ReactElement<ComponentProps<typeof Button>>
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  preventOpenAutoFocus?: boolean
}

let pending: Promise<typeof import('./InteractivePopover')> | undefined
function loadPopover() {
  pending ??= import('./InteractivePopover').catch((error) => {
    pending = undefined
    throw error
  })
  return pending
}
const InteractivePopover = lazy(loadPopover)
function prefetch() {
  void loadPopover().catch(() => {})
}

export function DeferredPopover(props: DeferredPopoverProps) {
  const [activated, setActivated] = useState(false)
  const { trigger, open, onOpenChange } = props
  // eslint-disable-next-line react/no-clone-element -- The trigger contract is a single Button, preserving its SSR markup.
  const button = cloneElement(trigger, {
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'onPointerEnter': prefetch,
    'onFocus': prefetch,
    'onClick': (event) => {
      trigger.props.onClick?.(event)
      if (!event.defaultPrevented) {
        setActivated(true)
        onOpenChange(!open)
      }
    },
    'onKeyDown': (event) => {
      trigger.props.onKeyDown?.(event)
      if (event.key === 'Escape')
        onOpenChange(false)
    },
  })
  // Keep the loaded root mounted after closing, so Radix restores trigger focus
  // and subsequent openings do not replace the button again.
  return activated || open
    ? <Suspense fallback={button}><InteractivePopover {...props} /></Suspense>
    : button
}
