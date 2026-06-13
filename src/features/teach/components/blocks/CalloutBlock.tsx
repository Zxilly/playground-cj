'use client'

import { Info, Lightbulb, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CalloutBlockProps } from './block-props'
import { TeachMarkdown } from './TeachMarkdown'
import { cn } from '@/lib/utils'

type Variant = CalloutBlockProps['block']['variant']

const variantStyles: Record<Variant, { container: string, icon: LucideIcon, iconClass: string }> = {
  note: {
    container: 'border-border/60 bg-muted/40 text-foreground',
    icon: Info,
    iconClass: 'text-muted-foreground',
  },
  warning: {
    container: 'border-amber-300/60 bg-amber-50/60 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
    icon: TriangleAlert,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  insight: {
    container: 'border-primary/40 bg-primary/5 text-foreground',
    icon: Lightbulb,
    iconClass: 'text-primary',
  },
}

/**
 * Knowledge block: a highlighted aside (note / warning / insight). The variant
 * drives both the icon and the colour treatment.
 */
export function CalloutBlock({ block }: CalloutBlockProps) {
  const style = variantStyles[block.variant]
  const Icon = style.icon
  return (
    <div
      data-testid="callout-block"
      data-variant={block.variant}
      className={cn('flex gap-3 rounded-md border px-4 py-3', style.container)}
    >
      <Icon aria-hidden="true" className={cn('mt-1 size-4 shrink-0', style.iconClass)} />
      <div className="min-w-0 flex-1">
        <TeachMarkdown markdown={block.markdown} />
      </div>
    </div>
  )
}
