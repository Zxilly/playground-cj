'use client'

import type { HeadingBlockProps } from './block-props'

/**
 * Knowledge block: a section heading. Levels are constrained to 2 or 3 by the
 * schema so lesson structure stays shallow.
 */
export function HeadingBlock({ block }: HeadingBlockProps) {
  if (block.level === 3) {
    return (
      <h3 data-testid="heading-block" className="mt-3 mb-1 text-base font-semibold text-foreground first:mt-0">
        {block.text}
      </h3>
    )
  }
  return (
    <h2 data-testid="heading-block" className="mt-4 mb-1.5 text-lg font-semibold text-foreground first:mt-0">
      {block.text}
    </h2>
  )
}
